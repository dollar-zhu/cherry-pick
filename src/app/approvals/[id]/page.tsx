import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { createClient } from "@/lib/supabase/server";
import { DecideForm } from "./decide-form";

export const metadata: Metadata = { title: "Approval · Cherry Pick" };

export default async function ApprovalPage({ params }: PageProps<"/approvals/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect(`/login?next=${encodeURIComponent(`/approvals/${id}`)}`);

  const { data } = await supabase
    .from("approvals")
    .select("id, action, status, exact_scope, credits, requested_by, created_at, decided_at, result")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 pt-12 sm:px-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-ink sm:text-5xl">Approval</h1>
      <p className="text-sm text-ink-2">
        This is the exact action an agent asked for. Approving records your decision and runs the action when that tool is connected. Rejecting stops it.
      </p>
      <ApprovalCard
        approval={{
          id: data.id as string,
          action: data.action as string,
          status: data.status as string,
          exactScope: data.exact_scope,
          credits: data.credits as number | null,
          requestedBy: data.requested_by as string,
          createdAt: data.created_at as string,
          decidedAt: (data.decided_at as string | null) ?? null,
          result: data.result,
        }}
      />
      {data.status === "pending" && <DecideForm id={id} />}
      {data.status === "approved" && (
        <p className="text-sm text-ink-2">
          Approved. Nothing else runs until the tool that requested this is connected.
        </p>
      )}
    </main>
  );
}
