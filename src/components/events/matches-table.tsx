import Link from "next/link";

export type MatchRow = {
  id: string;
  profileId: string;
  profileName: string;
  profileCity: string;
  score: number;
  reasons: string[];
};

type Props = {
  rows: MatchRow[];
};

export function MatchesTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No matching organizations yet.{" "}
        <Link href="/events/new" className="underline underline-offset-2">
          Refine your intent
        </Link>{" "}
        or click <strong>Find matches</strong> to search the directory.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Fit</th>
            <th className="px-4 py-3 font-medium">Reasons</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <td className="px-4 py-3 font-medium">{row.profileName}</td>
              <td className="px-4 py-3 text-zinc-500">{row.profileCity}</td>
              <td className="px-4 py-3">
                {row.score > 0 ? (
                  <span className="font-mono">{row.score.toFixed(1)}</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                {row.reasons.length > 0 ? (
                  <ul className="list-inside list-disc space-y-0.5">
                    {row.reasons.map((reason, index) => (
                      <li key={`${index}-${reason}`}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
