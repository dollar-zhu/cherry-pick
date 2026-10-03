import { InviteStatusBadge, type InviteStatus } from "./invite-status";
import { DemoBadge } from "./matches-table";

export type InviteListRow = {
  id: string;
  profileName: string;
  isDemo: boolean;
  status: InviteStatus;
  note: string | null;
};

export function InviteList({ rows }: { rows: InviteListRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No invites yet</p>;
  }

  return (
    <ul className="glass rounded-lg divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 font-medium">
              {row.profileName}
              {row.isDemo && <DemoBadge />}
            </span>
            <InviteStatusBadge status={row.status} />
          </div>
          {row.note && <p className="text-muted-foreground">{row.note}</p>}
        </li>
      ))}
    </ul>
  );
}
