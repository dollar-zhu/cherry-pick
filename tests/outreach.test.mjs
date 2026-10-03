import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createUnsubscribeToken,
  readUnsubscribeToken,
  verifyWebhookSignature,
} from "../src/lib/outreach/crypto.ts";
import { debitKeyFor, handleAgentMailEvent } from "../src/lib/outreach/events.ts";
import { DAILY_SEND_LIMIT, EMAIL_CREDIT_COST, sendApprovedBatch, startOfUtcDay, withUnsubscribe } from "../src/lib/outreach/send.ts";

const SECRET = "test-unsubscribe-secret";
const unsubscribe = { siteUrl: "https://app.example/", secret: SECRET };

// ---------- unsubscribe tokens ----------

test("unsubscribe token round-trips and normalizes the address", () => {
  const token = createUnsubscribeToken("  Jane@Example.com ", SECRET);
  assert.equal(readUnsubscribeToken(token, SECRET), "jane@example.com");
});

test("forged, tampered or wrongly signed tokens are rejected", () => {
  const token = createUnsubscribeToken("jane@example.com", SECRET);
  const [, sig] = token.split(".");
  const other = Buffer.from("victim@example.com").toString("base64url");
  assert.equal(readUnsubscribeToken(`${other}.${sig}`, SECRET), null);
  assert.equal(readUnsubscribeToken(token, "other-secret"), null);
  assert.equal(readUnsubscribeToken(`${token}.extra`, SECRET), null);
  assert.equal(readUnsubscribeToken("garbage", SECRET), null);
  assert.equal(readUnsubscribeToken("", SECRET), null);
});

// ---------- webhook signatures (Svix scheme) ----------

const key = Buffer.from("webhook-key-bytes").toString("base64");
const whsec = `whsec_${key}`;
const sign = (id, ts, body) =>
  `v1,${createHmac("sha256", Buffer.from(key, "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;

test("valid webhook signature passes, including among rotated keys", () => {
  const body = '{"eventType":"message.sent"}';
  const ts = "1700000000";
  assert.equal(
    verifyWebhookSignature({ secret: whsec, id: "msg_1", timestamp: ts, signature: `v1,old ${sign("msg_1", ts, body)}`, body, nowSeconds: 1700000010 }),
    true,
  );
});

test("tampered body, stale timestamp or missing headers fail verification", () => {
  const body = '{"eventType":"message.sent"}';
  const ts = "1700000000";
  const signature = sign("msg_1", ts, body);
  const base = { secret: whsec, id: "msg_1", timestamp: ts, signature, nowSeconds: 1700000010 };
  assert.equal(verifyWebhookSignature({ ...base, body: body + " " }), false);
  assert.equal(verifyWebhookSignature({ ...base, body, nowSeconds: 1700000000 + 301 }), false);
  assert.equal(verifyWebhookSignature({ ...base, body, id: null }), false);
  assert.equal(verifyWebhookSignature({ ...base, body, signature: "v1,AAAA" }), false);
  assert.equal(verifyWebhookSignature({ ...base, body, timestamp: "abc" }), false);
});

// ---------- unsubscribe link in outgoing mail ----------

test("outgoing mail gets a visible link and one-click headers for the recipient", () => {
  const out = withUnsubscribe({ text: "Hello\n\n", email: "jane@example.com" }, unsubscribe);
  const token = createUnsubscribeToken("jane@example.com", SECRET);
  assert.ok(out.text.startsWith("Hello\n\n--\n"));
  assert.ok(out.text.endsWith(`https://app.example/unsubscribe?t=${token}`));
  assert.equal(out.headers["List-Unsubscribe"], `<https://app.example/api/unsubscribe?t=${token}>`);
  assert.equal(out.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("the daily window starts at UTC midnight", () => {
  assert.equal(startOfUtcDay(new Date("2026-10-03T23:59:00-05:00")).toISOString(), "2026-10-04T00:00:00.000Z");
});

// ---------- sending a batch ----------

const msg = (id, overrides = {}) => ({
  id,
  batchId: "b1",
  userId: "u1",
  eventId: "e1",
  recipientEmail: `${id}@example.com`,
  subject: "Co-host?",
  bodyText: "Hi there",
  status: "approved",
  ...overrides,
});

function sendFakes({ messages, suppressed = [], balance = 10, slotsLeft = DAILY_SEND_LIMIT, failFor = [], spendDuringSend = 0 } = {}) {
  const marks = [];
  const sends = [];
  const audits = [];
  const ledger = new Map(); // idempotency key -> amount
  let slots = slotsLeft;
  const sum = () => balance + [...ledger.values()].reduce((a, b) => a + b, 0);
  const store = {
    approveBatch: async () => messages,
    isSuppressed: async (email) => suppressed.includes(email),
    creditBalance: async () => sum(),
    debit: async (_u, amount, key) => {
      if (!ledger.has(key)) ledger.set(key, -amount);
      if (spendDuringSend) { balance -= spendDuringSend; spendDuringSend = 0; } // concurrent spend
    },
    refundIfDebited: async (_u, amount, key) => {
      if (ledger.has(key) && !ledger.has(`${key}:refund`)) ledger.set(`${key}:refund`, amount);
    },
    claimSendSlot: async () => (slots-- > 0),
    markMessage: async (id, patch) => { marks.push({ id, ...patch }); },
    audit: async (e) => { audits.push(e); },
  };
  const mailer = {
    send: async (message, idempotencyKey) => {
      if (failFor.includes(message.to)) throw new Error("mailbox unavailable");
      sends.push({ message, idempotencyKey });
      return { messageId: `am-${idempotencyKey}` };
    },
  };
  return { store, mailer, marks, sends, audits, ledger, balance: sum };
}

const send = (f) => sendApprovedBatch({ batchId: "b1", userId: "u1", store: f.store, mailer: f.mailer, unsubscribe });

test("approved messages are sent once each, keyed by message id, with the opt-out link", async () => {
  const f = sendFakes({ messages: [msg("m1"), msg("m2")] });
  const res = await send(f);
  assert.equal(res.status, "success");
  assert.equal(res.data.sent, 2);
  assert.deepEqual(f.sends.map((s) => s.idempotencyKey), ["m1", "m2"]);
  assert.ok(f.sends.every((s) => s.message.text.includes("/unsubscribe?t=")));
  assert.ok(f.sends.every((s) => s.message.headers["List-Unsubscribe"]));
  assert.deepEqual(f.marks.map((m) => [m.id, m.status, m.agentmailMessageId]), [
    ["m1", "sent", "am-m1"],
    ["m2", "sent", "am-m2"],
  ]);
});

test("suppressed recipients are never emailed", async () => {
  const f = sendFakes({ messages: [msg("m1"), msg("m2")], suppressed: ["m1@example.com"] });
  const res = await send(f);
  assert.equal(res.data.suppressed, 1);
  assert.deepEqual(f.sends.map((s) => s.message.to), ["m2@example.com"]);
  assert.equal(f.marks[0].status, "suppressed");
});

test("the daily limit defers the rest instead of sending", async () => {
  const f = sendFakes({ messages: [msg("m1"), msg("m2"), msg("m3")], slotsLeft: 2 });
  const res = await send(f);
  assert.equal(res.data.sent, 2);
  assert.equal(res.data.deferred, 1);
  assert.equal(f.sends.length, 2);
  assert.ok(res.nextActions.some((a) => /tomorrow/.test(a)));
});

test("each sent email is charged the server-side price before sending", async () => {
  const f = sendFakes({ messages: [msg("m1", { credit_cost: 0, creditCost: -50 }), msg("m2")], balance: 5 });
  await send(f);
  assert.equal(f.balance(), 5 - 2 * EMAIL_CREDIT_COST); // draft-row prices are ignored
  assert.deepEqual([...f.ledger.keys()], ["outreach:m1", "outreach:m2"]);
});

test("running out of credits stops sending without charging, and is retryable", async () => {
  const f = sendFakes({ messages: [msg("m1"), msg("m2")], balance: EMAIL_CREDIT_COST });
  const res = await send(f);
  assert.equal(res.data.sent, 1);
  assert.equal(res.data.insufficientCredits, 1);
  assert.equal(f.ledger.has("outreach:m2"), false); // never debited, so a retry charges normally
  assert.equal(f.balance(), 0);

  const retry = sendFakes({ messages: [msg("m2", { status: "insufficient_credits" })], balance: 3 });
  assert.equal((await send(retry)).data.sent, 1);
  assert.equal(retry.balance(), 3 - EMAIL_CREDIT_COST);
});

test("a concurrent spend that overdraws is refunded and the email is not sent", async () => {
  const f = sendFakes({ messages: [msg("m1")], balance: EMAIL_CREDIT_COST, spendDuringSend: EMAIL_CREDIT_COST });
  const res = await send(f);
  assert.equal(res.data.sent, 0);
  assert.equal(f.sends.length, 0);
  assert.equal(f.ledger.get("outreach:m1:refund"), EMAIL_CREDIT_COST);
  assert.equal(f.marks.at(-1).status, "failed");
});

test("a failed send is recorded and does not stop the batch", async () => {
  const f = sendFakes({ messages: [msg("m1"), msg("m2")], failFor: ["m1@example.com"] });
  const res = await send(f);
  assert.equal(res.data.failed, 1);
  assert.equal(res.data.sent, 1);
  assert.equal(f.marks.find((m) => m.id === "m1").status, "failed");
  assert.equal(f.balance(), 10 - EMAIL_CREDIT_COST); // the failed send was refunded
});

test("already-handled messages are skipped, so approving twice never resends", async () => {
  const f = sendFakes({ messages: [msg("m1", { status: "sent" }), msg("m2", { status: "suppressed" })] });
  const res = await send(f);
  assert.equal(res.status, "success");
  assert.equal(res.summary, "Nothing left to send in this batch.");
  assert.equal(f.sends.length, 0);
});

test("a deferred message is sent on a later run", async () => {
  const f = sendFakes({ messages: [msg("m1", { status: "deferred" })] });
  assert.equal((await send(f)).data.sent, 1);
});

test("unknown or foreign batch fails without sending", async () => {
  const f = sendFakes({ messages: null });
  const res = await send(f);
  assert.equal(res.status, "failed");
  assert.equal(f.sends.length, 0);
});

test("nothing sent because every send failed reports failed", async () => {
  const f = sendFakes({ messages: [msg("m1")], failFor: ["m1@example.com"] });
  assert.equal((await send(f)).status, "failed");
});

// ---------- delivery events ----------

function eventFakes(message) {
  const calls = { marks: [], debits: [], refunds: [], suppressed: [], audits: [] };
  const store = {
    findByAgentMailId: async (id) => (message && id === "am-1" ? message : null),
    markMessage: async (id, patch) => { calls.marks.push({ id, ...patch }); },
    debit: async (...args) => { calls.debits.push(args); },
    refundIfDebited: async (...args) => { calls.refunds.push(args); },
    suppress: async (email, reason) => { calls.suppressed.push([email, reason]); },
    audit: async (e) => { calls.audits.push(e); },
  };
  return { store, calls };
}

const tracked = (status = "sent") => ({
  id: "m1", userId: "u1", eventId: "e1", recipientEmail: "jane@example.com", status,
});

test("message.sent confirms the same idempotent debit the send reserved", async () => {
  const { store, calls } = eventFakes(tracked());
  await handleAgentMailEvent({ eventType: "message.sent", eventId: "ev1", send: { messageId: "am-1", recipients: [] } }, store);
  assert.deepEqual(calls.debits, [["u1", EMAIL_CREDIT_COST, debitKeyFor("m1"), "m1"]]);
});

test("a permanent bounce suppresses the address and refunds", async () => {
  const { store, calls } = eventFakes(tracked());
  await handleAgentMailEvent({
    eventType: "message.bounced",
    eventId: "ev2",
    bounce: { messageId: "am-1", type: "Permanent", subType: "General", recipients: [{ address: "jane@example.com" }] },
  }, store);
  assert.deepEqual(calls.suppressed, [["jane@example.com", "bounced"]]);
  assert.deepEqual(calls.refunds, [["u1", EMAIL_CREDIT_COST, debitKeyFor("m1"), "m1"]]);
  assert.equal(calls.marks[0].status, "bounced");
});

test("a transient bounce refunds but does not suppress", async () => {
  const { store, calls } = eventFakes(tracked());
  await handleAgentMailEvent({
    eventType: "message.bounced",
    eventId: "ev3",
    bounce: { messageId: "am-1", type: "Transient", recipients: [{ address: "jane@example.com" }] },
  }, store);
  assert.deepEqual(calls.suppressed, []);
  assert.equal(calls.refunds.length, 1);
});

test("a rejection refunds; a complaint suppresses without refunding", async () => {
  const rejected = eventFakes(tracked());
  await handleAgentMailEvent({ eventType: "message.rejected", eventId: "ev4", reject: { messageId: "am-1", reason: "spam" } }, rejected.store);
  assert.equal(rejected.calls.refunds.length, 1);
  assert.equal(rejected.calls.marks[0].status, "failed");

  const complained = eventFakes(tracked("delivered"));
  await handleAgentMailEvent({ eventType: "message.complained", eventId: "ev5", complaint: { messageId: "am-1", recipients: ["jane@example.com"] } }, complained.store);
  assert.deepEqual(complained.calls.suppressed, [["jane@example.com", "complained"]]);
  assert.equal(complained.calls.refunds.length, 0);
});

test("a late sent event after a bounce does not charge", async () => {
  const { store, calls } = eventFakes(tracked("bounced"));
  await handleAgentMailEvent({ eventType: "message.sent", eventId: "ev6", send: { messageId: "am-1", recipients: [] } }, store);
  assert.equal(calls.debits.length, 0);
  assert.equal(calls.marks.length, 0);
});

test("status never moves backwards (late delivered after bounced)", async () => {
  const { store, calls } = eventFakes(tracked("bounced"));
  await handleAgentMailEvent({ eventType: "message.delivered", eventId: "ev7", delivery: { messageId: "am-1", recipients: [] } }, store);
  assert.equal(calls.marks.length, 0);
});

test("events for unknown messages or unknown types are ignored", async () => {
  const { store, calls } = eventFakes(null);
  assert.equal(await handleAgentMailEvent({ eventType: "message.sent", eventId: "ev8", send: { messageId: "am-x", recipients: [] } }, store), "ignored");
  assert.equal(await handleAgentMailEvent({ eventType: "domain.verified", eventId: "ev9" }, store), "ignored");
  assert.equal(calls.debits.length, 0);
});
