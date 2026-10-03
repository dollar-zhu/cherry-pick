import type { ToolResponse } from "../tool-response";

export type InviteCounts = {
  pending: number;
  accepted: number;
  applied: number;
  approved: number;
  declined: number;
  rejected: number;
};

export type PendingApproval = {
  id: string;
  action: string;
  approveUrl: string;
};

export type ReadinessState = {
  eventId: string;
  eventUrl: string;
  title: string;
  candidateCount: number;
  invites: InviteCounts;
  pendingApprovals: PendingApproval[];
  /** null when the credit ledger table is not there yet. */
  credits: number | null;
};

const emptyInvites: InviteCounts = {
  pending: 0,
  accepted: 0,
  applied: 0,
  approved: 0,
  declined: 0,
  rejected: 0,
};

export function emptyInviteCounts(): InviteCounts {
  return { ...emptyInvites };
}

export function deriveReadiness(state: ReadinessState): ToolResponse {
  const inviteTotal = Object.values(state.invites).reduce((n, c) => n + c, 0);
  const blockers: string[] = [];
  const nextActions: string[] = [];

  const waitingOnHost = state.invites.accepted + state.invites.applied;
  let stage = "intent";
  if (state.pendingApprovals.length > 0) stage = "awaiting_approval";
  else if (waitingOnHost > 0) stage = "reviewing_partners";
  else if (state.invites.approved > 0) stage = "partners_confirmed";
  else if (inviteTotal > 0) stage = "outreach";
  else if (state.candidateCount > 0) stage = "matched";

  if (stage === "intent") {
    blockers.push("No co-host matches yet.");
    nextActions.push(`Find matches on ${state.eventUrl}.`);
  } else if (stage === "matched") {
    nextActions.push(`Invite companies from ${state.eventUrl}.`);
  } else if (stage === "outreach") {
    nextActions.push("Wait for invited companies to accept or decline.");
  } else if (stage === "reviewing_partners") {
    const waiting = [
      state.invites.applied > 0
        ? `${state.invites.applied} application${state.invites.applied === 1 ? "" : "s"}`
        : null,
      state.invites.accepted > 0
        ? `${state.invites.accepted} accepted invite${state.invites.accepted === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean);
    blockers.push(`${waiting.join(" and ")} waiting on you.`);
    nextActions.push(`Approve or reject them on ${state.eventUrl}.`);
  } else if (stage === "partners_confirmed") {
    const n = state.invites.approved;
    nextActions.push(
      `${n} co-host${n === 1 ? " is" : "s are"} confirmed. Their contact emails are on ${state.eventUrl}.`,
      "Make the event flier with generate_flier.",
    );
    if (state.invites.pending > 0) {
      nextActions.push(`${state.invites.pending} invite${state.invites.pending === 1 ? " is" : "s are"} still open.`);
    }
  }

  for (const approval of state.pendingApprovals) {
    blockers.push(`Pending approval: ${approval.action}.`);
    nextActions.push(approval.approveUrl);
  }

  const credits =
    state.credits == null ? "Credits are not set up yet." : `Credit balance: ${state.credits}.`;

  return {
    status: "success",
    resourceId: state.eventId,
    summary: `${state.title} is at the ${stage.replaceAll("_", " ")} stage. ${state.candidateCount} candidate${state.candidateCount === 1 ? "" : "s"}, ${inviteTotal} invite${inviteTotal === 1 ? "" : "s"}.`,
    nextActions,
    data: {
      eventId: state.eventId,
      eventUrl: state.eventUrl,
      stage,
      blockers,
      pendingApprovals: state.pendingApprovals,
      invites: state.invites,
      candidateCount: state.candidateCount,
      credits: state.credits,
      creditsNote: credits,
    },
  };
}

export function eventNotFound(): ToolResponse {
  return {
    status: "blocked",
    summary: "Event not found.",
    nextActions: ["Check the event id, or create an intent first."],
  };
}
