import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { emailFromToken, maskEmail, unsubscribeByToken } from "@/lib/outreach/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe · Cherry Pick", robots: { index: false } };

async function unsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const email = await unsubscribeByToken(token);
  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&${email ? "done=1" : "error=1"}`);
}

export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : null;
  const email = emailFromToken(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-16 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Unsubscribe</h1>
      {!email ? (
        <p className="text-zinc-600">This unsubscribe link is invalid or incomplete.</p>
      ) : params.done ? (
        <p>
          Done. <strong>{maskEmail(email)}</strong> will not receive outreach emails from Cherry Pick again.
        </p>
      ) : (
        <form action={unsubscribe} className="flex flex-col gap-4">
          <input type="hidden" name="t" value={token ?? ""} />
          <p>
            Stop all outreach emails from Cherry Pick to <strong>{maskEmail(email)}</strong>?
          </p>
          {params.error && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}
          <button className="self-start rounded-full bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black">
            Unsubscribe
          </button>
        </form>
      )}
    </main>
  );
}
