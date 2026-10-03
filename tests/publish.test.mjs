import assert from "node:assert/strict";
import test from "node:test";
import { approvePublish, publishStatus } from "../src/lib/publish/approve.ts";
import { buildLumaPackage, contentHash, isOwnAsset, MAX_ASSETS, MAX_ATTACHMENT_BYTES, PACKAGE_SCHEMA, sha256Hex } from "../src/lib/publish/package.ts";

const FILES = { "lp1/v2/cover.png": Buffer.from("cover-bytes"), "lp1/v2/brief.pdf": Buffer.from("brief-bytes") };
const file = (kind, storagePath, filename, contentType) => ({
  kind, storagePath, filename, contentType, sha256: sha256Hex(FILES[storagePath]), size: FILES[storagePath].length,
});

const intent = {
  title: "Berlin Founders Dinner",
  topic: "B2B SaaS",
  goal: "Networking",
  format: "dinner",
  city: "Berlin",
  date_start: "2026-11-14T19:00:00+01:00",
  date_end: "2026-11-14T23:00:00+01:00",
  guest_count: 20,
  budget_cap_cents: 300000,
  currency: "EUR",
  sales_boundary: "No pitching",
  partner_criteria: "B2B SaaS communities",
};

const content = (overrides = {}) => ({
  launchPackageId: "lp1",
  version: 2,
  lumaTitle: "Berlin Founders Dinner",
  lumaDescription: "An evening for SaaS founders.",
  linkedinCopy: "Join us",
  xCopy: "Join us!",
  assets: [
    file("cover_image", "lp1/v2/cover.png", "cover.png", "image/png"),
    file("document", "lp1/v2/brief.pdf", "brief.pdf", "application/pdf"),
  ],
  ...overrides,
});

const cohosts = { company: "Acme", community: "Berlin SaaS Circle" };
const ORGANIZER = "organizer@example.com";

// ---------- package and fingerprint ----------

test("the package carries every Luma field, the cover image and the approval trail", () => {
  const approvals = [
    { party: "community", approvedBy: "u2", approvedAt: "2026-10-03T10:00:00Z" },
    { party: "company", approvedBy: "u1", approvedAt: "2026-10-03T09:00:00Z" },
  ];
  const pkg = buildLumaPackage({ intent, content: content(), cohosts, organizerEmail: ORGANIZER, approvals });
  assert.equal(pkg.schema, PACKAGE_SCHEMA);
  assert.equal(pkg.event.name, "Berlin Founders Dinner");
  assert.equal(pkg.event.startAt, intent.date_start);
  assert.equal(pkg.event.capacity, 20);
  assert.equal(pkg.event.coverImage, "cover.png");
  assert.deepEqual(pkg.approvals.map((a) => a.party), ["community", "company"]);
  assert.equal(pkg.contentHash, contentHash(intent, content(), cohosts, ORGANIZER));
  assert.match(pkg.instructions, /not been posted/);
});

test("the fingerprint is stable and changes when anything approved changes", () => {
  const base = contentHash(intent, content(), cohosts, ORGANIZER);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(contentHash(intent, content(), cohosts, " Organizer@Example.com "), base);
  assert.notEqual(contentHash(intent, content({ lumaTitle: "Other" }), cohosts, ORGANIZER), base);
  assert.notEqual(contentHash({ ...intent, city: "Munich" }, content(), cohosts, ORGANIZER), base);
  assert.notEqual(contentHash(intent, content({ version: 3 }), cohosts, ORGANIZER), base);
  assert.notEqual(contentHash(intent, content(), cohosts, "attacker@example.com"), base);
  const newImage = content().assets.map((a, i) => (i === 0 ? { ...a, storagePath: "lp1/v3/cover.png" } : a));
  assert.notEqual(contentHash(intent, content({ assets: newImage }), cohosts, ORGANIZER), base);
  const samePathNewBytes = content().assets.map((a, i) => (i === 0 ? { ...a, sha256: sha256Hex("other image") } : a));
  assert.notEqual(contentHash(intent, content({ assets: samePathNewBytes }), cohosts, ORGANIZER), base);
  const renamed = content().assets.map((a, i) => (i === 0 ? { ...a, filename: "invoice.png" } : a));
  assert.notEqual(contentHash(intent, content({ assets: renamed }), cohosts, ORGANIZER), base);
});

test("only assets inside the package's own folder are accepted", () => {
  assert.equal(isOwnAsset("lp1", "lp1/v2/cover.png"), true);
  assert.equal(isOwnAsset("lp1", "lp2/v1/secret.pdf"), false);
  assert.equal(isOwnAsset("lp1", "lp1/../lp2/secret.pdf"), false);
  assert.equal(isOwnAsset("lp1", "lp1//cover.png"), false);
  assert.equal(isOwnAsset("lp1", "lp10/cover.png"), false);
});

// ---------- approval gate ----------

function fakes({ ctx = {}, approvals = [], job = null, failSend = false, files = FILES } = {}) {
  const state = { approvals: [...approvals], job, sends: [], audits: [], finished: [] };
  const context = {
    eventId: "e1",
    intent,
    content: content(),
    cohosts,
    charterLocked: true,
    organizerEmail: "organizer@example.com",
    userParty: "company",
    ...ctx,
  };
  const store = {
    loadContext: async () => (ctx === null ? null : context),
    recordApproval: async (_id, hash, party, userId) => {
      if (!state.approvals.some((a) => a.hash === hash && a.party === party)) {
        state.approvals.push({ hash, party, approvedBy: userId, approvedAt: "2026-10-03T10:00:00Z" });
      }
    },
    listApprovals: async (_id, hash) => state.approvals.filter((a) => a.hash === hash),
    claimJob: async () => {
      if (state.job === "sent") return "sent";
      if (state.job === "sending") return "in_progress";
      state.job = "sending";
      return "claimed";
    },
    jobStatus: async () => state.job,
    finishJob: async (_id, _hash, result) => { state.job = result.status; state.finished.push(result); },
    fetchAssets: async (assets) => assets.map((asset) => ({ asset, bytes: files[asset.storagePath] })),
    audit: async (e) => { state.audits.push(e); },
  };
  const mailer = {
    send: async (message, key) => {
      if (failSend) throw new Error("smtp down");
      state.sends.push({ message, key });
      return { messageId: "am-1" };
    },
  };
  return { store, mailer, state, context };
}

const HASH = contentHash(intent, content(), cohosts, ORGANIZER);
const approve = (f, userId = "u1", expectedHash = HASH) =>
  approvePublish({ launchPackageId: "lp1", expectedHash, userId, store: f.store, mailer: f.mailer });

test("the first co-host's approval waits for the other and sends nothing", async () => {
  const f = fakes();
  const res = await approve(f);
  assert.equal(res.status, "pending_approval");
  assert.deepEqual(res.data.waitingFor, ["community"]);
  assert.match(res.summary, /Waiting for Berlin SaaS Circle/);
  assert.equal(f.state.sends.length, 0);
});

test("the second approval sends the package once, with JSON and every asset attached", async () => {
  const f = fakes({ ctx: { userParty: "community" }, approvals: [{ hash: HASH, party: "company", approvedBy: "u1", approvedAt: "t" }] });
  const res = await approve(f, "u2");
  assert.equal(res.status, "success");
  assert.equal(f.state.sends.length, 1);
  const { message, key } = f.state.sends[0];
  assert.equal(message.to, "organizer@example.com");
  assert.equal(key, `publish:lp1:${HASH}`);
  assert.deepEqual(message.attachments.map((a) => a.filename), ["luma-event.json", "cover.png", "brief.pdf"]);
  const pkg = JSON.parse(Buffer.from(message.attachments[0].content, "base64").toString());
  assert.equal(pkg.contentHash, HASH);
  assert.deepEqual(pkg.approvals.map((a) => a.party), ["community", "company"]);
  assert.equal(Buffer.from(message.attachments[1].content, "base64").toString(), "cover-bytes");
  assert.equal(pkg.attachments[0].sha256, sha256Hex(FILES["lp1/v2/cover.png"]));

  const job = f.state.audits.find((a) => a.action === "publish_job");
  assert.equal(job.outcome, "sent");
  assert.deepEqual(job.detail.assets, ["lp1/v2/cover.png", "lp1/v2/brief.pdf"]);
  assert.equal(job.detail.approvals.length, 2);
});

test("approving again after sending never sends a second email", async () => {
  const f = fakes({ approvals: [{ hash: HASH, party: "community", approvedBy: "u2", approvedAt: "t" }], job: "sent" });
  const res = await approve(f);
  assert.equal(res.status, "success");
  assert.match(res.summary, /already sent/);
  assert.equal(f.state.sends.length, 0);
});

test("a concurrent send in progress is not duplicated", async () => {
  const f = fakes({ approvals: [{ hash: HASH, party: "community", approvedBy: "u2", approvedAt: "t" }], job: "sending" });
  assert.equal((await approve(f)).status, "pending_approval");
  assert.equal(f.state.sends.length, 0);
});

test("approvals for an older version do not count after the content changes", async () => {
  const oldHash = contentHash(intent, content({ version: 1 }), cohosts, ORGANIZER);
  const f = fakes({ ctx: { userParty: "community" }, approvals: [{ hash: oldHash, party: "company", approvedBy: "u1", approvedAt: "t" }] });
  const res = await approve(f, "u2");
  assert.equal(res.status, "pending_approval");
  assert.deepEqual(res.data.waitingFor, ["company"]);
  assert.equal(f.state.sends.length, 0);
});

test("a file swapped at the same path after approval stops the send", async () => {
  const f = fakes({
    ctx: { userParty: "community" },
    approvals: [{ hash: HASH, party: "company", approvedBy: "u1", approvedAt: "t" }],
    files: { ...FILES, "lp1/v2/cover.png": Buffer.from("unapproved image") },
  });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await approve(f, "u2");
    assert.equal(res.status, "failed");
    assert.equal(f.state.sends.length, 0);
    assert.match(f.state.audits.find((a) => a.action === "publish_job").detail.error, /changed after it was approved/);
  } finally {
    console.error = original;
  }
});

test("assets over the email size limit are blocked before approval", async () => {
  const big = content().assets.map((a, i) => (i === 0 ? { ...a, size: MAX_ATTACHMENT_BYTES + 1 } : a));
  const f = fakes({ ctx: { content: content({ assets: big }) } });
  const res = await approve(f);
  assert.equal(res.status, "blocked");
  assert.match(res.summary, /email limit/);
  assert.equal(f.state.approvals.length, 0);
});

test("more files than the limit are blocked before approval", async () => {
  const many = Array.from({ length: MAX_ASSETS + 1 }, (_, i) => ({ ...content().assets[1], storagePath: `lp1/f${i}.pdf` }));
  const f = fakes({ ctx: { content: content({ assets: many }) } });
  const res = await approve(f);
  assert.equal(res.status, "blocked");
  assert.match(res.summary, /limit is 10/);
  assert.equal(f.state.approvals.length, 0);
});

test("changing the organizer email voids earlier approvals", async () => {
  const f = fakes({
    ctx: { userParty: "community", organizerEmail: "attacker@example.com" },
    approvals: [{ hash: HASH, party: "company", approvedBy: "u1", approvedAt: "t" }],
  });
  const newHash = contentHash(intent, content(), cohosts, "attacker@example.com");
  const res = await approve(f, "u2", newHash);
  assert.equal(res.status, "pending_approval");
  assert.deepEqual(res.data.waitingFor, ["company"]);
  assert.equal(f.state.sends.length, 0);
});

test("approving a version other than the one reviewed is refused", async () => {
  const f = fakes();
  const res = await approve(f, "u1", "0".repeat(64));
  assert.equal(res.status, "blocked");
  assert.match(res.summary, /changed since you reviewed/);
  assert.equal(f.state.approvals.length, 0);
});

test("non-co-hosts, an unlocked charter or a missing organizer email block approval", async () => {
  for (const [ctx, pattern] of [
    [{ userParty: null }, /Only the two co-hosts/],
    [{ charterLocked: false }, /charter is not locked/],
    [{ organizerEmail: null }, /organizer email/],
    [{ organizerEmail: "not-an-email" }, /organizer email/],
  ]) {
    const f = fakes({ ctx });
    const res = await approve(f);
    assert.equal(res.status, "blocked");
    assert.match(res.summary, pattern);
    assert.equal(f.state.approvals.length, 0);
    assert.equal(f.state.sends.length, 0);
  }
});

test("an unknown package fails", async () => {
  const f = fakes({ ctx: null });
  assert.equal((await approve(f)).status, "failed");
});

test("a failed send keeps the approvals and can be retried", async () => {
  const f = fakes({ ctx: { userParty: "community" }, approvals: [{ hash: HASH, party: "company", approvedBy: "u1", approvedAt: "t" }], failSend: true });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await approve(f, "u2");
    assert.equal(res.status, "failed");
    assert.equal(f.state.job, "failed");
    assert.equal(f.state.approvals.length, 2);
  } finally {
    console.error = original;
  }
});

test("status shows the version hash, who approved and whether it was sent", async () => {
  const f = fakes({ approvals: [{ hash: HASH, party: "company", approvedBy: "u1", approvedAt: "t" }] });
  const status = await publishStatus({ launchPackageId: "lp1", userId: "u1", store: f.store });
  assert.equal(status.contentHash, HASH);
  assert.deepEqual(status.approvedBy, ["company"]);
  assert.deepEqual(status.waitingFor, ["community"]);
  assert.equal(status.sent, false);
});
