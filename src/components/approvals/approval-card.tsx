export type ApprovalCardData = {
  id: string;
  action: string;
  status: string;
  exactScope: unknown;
  credits: number | null;
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
  result: unknown;
};

const statusLabel: Record<string, string> = {
  pending: "Waiting for you",
  approved: "Approved",
  rejected: "Rejected",
  executed: "Done",
};

export function ApprovalCard({ approval }: { approval: ApprovalCardData }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{approval.action.replaceAll("_", " ")}</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
          {statusLabel[approval.status] ?? approval.status}
        </span>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <dt className="text-zinc-500">Requested by</dt>
        <dd>{approval.requestedBy}</dd>
        <dt className="text-zinc-500">Credits</dt>
        <dd>{approval.credits == null ? "None" : approval.credits}</dd>
        <dt className="text-zinc-500">Exact scope</dt>
        <dd>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
            {JSON.stringify(approval.exactScope, null, 2)}
          </pre>
        </dd>
        {approval.result != null && (
          <>
            <dt className="text-zinc-500">Result</dt>
            <dd>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(approval.result, null, 2)}
              </pre>
            </dd>
          </>
        )}
      </dl>
      <p className="text-xs text-zinc-500">
        Requested {new Date(approval.createdAt).toLocaleString("en")}
        {approval.decidedAt ? ` · decided ${new Date(approval.decidedAt).toLocaleString("en")}` : ""}
      </p>
    </article>
  );
}
