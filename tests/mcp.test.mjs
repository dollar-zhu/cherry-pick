import assert from "node:assert/strict";
import test from "node:test";
import { missingProfileFields } from "../src/lib/contracts.ts";
import { rankCohosts } from "../src/lib/matching-constraints.ts";
import { deriveReadiness, emptyInviteCounts } from "../src/lib/mcp/readiness.ts";
import { safeNext } from "../src/lib/redirect.ts";
import { pendingApproval } from "../src/lib/tool-response.ts";

const base = {
  eventId: "11111111-1111-4111-8111-111111111111",
  eventUrl: "http://localhost:3000/events/11111111-1111-4111-8111-111111111111",
  title: "Thursday dinner",
  candidateCount: 0,
  invites: emptyInviteCounts(),
  pendingApprovals: [],
  credits: null,
};

test("readiness starts at intent when nothing else exists", () => {
  const response = deriveReadiness(base);
  assert.equal(response.status, "success");
  assert.equal(response.data.stage, "intent");
  assert.equal(response.data.blockers.length, 1);
  assert.match(response.nextActions[0], /Find matches/);
});

test("pending approval outranks match and invite progress", () => {
  const response = deriveReadiness({
    ...base,
    candidateCount: 4,
    invites: { ...emptyInviteCounts(), pending: 2, accepted: 1 },
    pendingApprovals: [{ id: "apr", action: "send_outreach", approveUrl: "http://localhost:3000/approvals/apr" }],
    credits: 50,
  });
  assert.equal(response.data.stage, "awaiting_approval");
  assert.equal(response.data.credits, 50);
  assert.ok(response.nextActions.includes("http://localhost:3000/approvals/apr"));
});

test("approved co-hosts move the event to partners_confirmed and point at the flier", () => {
  const response = deriveReadiness({
    ...base,
    candidateCount: 3,
    invites: { ...emptyInviteCounts(), approved: 1, pending: 1, declined: 1 },
  });
  assert.equal(response.data.stage, "partners_confirmed");
  assert.equal(response.data.blockers.length, 0);
  assert.ok(response.nextActions.some((action) => /generate_flier/.test(action)));
  assert.ok(response.nextActions.some((action) => /1 invite is still open/.test(action)));
});

test("accepted invites are a review stage when nothing is awaiting approval", () => {
  const response = deriveReadiness({
    ...base,
    candidateCount: 3,
    invites: { ...emptyInviteCounts(), accepted: 1, pending: 1 },
  });
  assert.equal(response.data.stage, "reviewing_partners");
});

test("partner applications wait on the host the same way", () => {
  const response = deriveReadiness({
    ...base,
    invites: { ...emptyInviteCounts(), applied: 2 },
  });
  assert.equal(response.data.stage, "reviewing_partners");
  assert.match(response.data.blockers[0], /2 applications waiting on you/);
});

test("safeNext keeps in-app paths and drops off-site targets", () => {
  assert.equal(safeNext("/oauth/consent?authorization_id=abc"), "/oauth/consent?authorization_id=abc");
  assert.equal(safeNext("https://evil.example"), null);
  assert.equal(safeNext("//evil.example"), null);
  assert.equal(safeNext("/\\evil"), null);
});

test("a new company is missing the intake fields", () => {
  assert.deepEqual(missingProfileFields(null), ["name", "description", "city", "audience", "topics"]);
  assert.deepEqual(
    missingProfileFields({ name: "Acme", description: "Tools", city: "San Francisco", audience: "Founders", topics: [] }),
    ["topics"],
  );
  assert.deepEqual(
    missingProfileFields({ name: "Acme", description: "Tools", city: "San Francisco", audience: "Founders", topics: ["AI"] }),
    [],
  );
});

test("cohost browse ranks shared topics first and keeps the rest of the city", () => {
  const ranked = rankCohosts(["AI", "founders"], [
    { id: "1", name: "Kitchen", city: "San Francisco", audience: "Chefs", topics: ["food"], description: "Suppers", hasVenue: true },
    { id: "2", name: "Lab", city: "San Francisco", audience: "Researchers", topics: ["AI", "founders"], description: "A lab for AI founders", hasVenue: false },
  ]);
  assert.equal(ranked[0].name, "Lab");
  assert.deepEqual(ranked[0].sharedTopics, ["AI", "founders"]);
  assert.equal(ranked[1].name, "Kitchen");
  assert.deepEqual(ranked[1].sharedTopics, []);
});

test("pending approval envelope names the exact scope and the approve link", () => {
  const response = pendingApproval({
    approvalId: "apr_123",
    action: "send_outreach_batch",
    exactScope: { recipients: 3 },
    estimatedCredits: 9,
    approveUrl: "http://localhost:3000/approvals/apr_123",
    summary: "Prepared outreach to 3 community organizers.",
  });
  assert.equal(response.status, "pending_approval");
  assert.equal(response.approvalRequired.approvalId, "apr_123");
  assert.equal(response.approvalRequired.estimatedCredits, 9);
  assert.equal(response.approvalRequired.approveUrl, "http://localhost:3000/approvals/apr_123");
  assert.deepEqual(response.approvalRequired.exactScope, { recipients: 3 });
});
