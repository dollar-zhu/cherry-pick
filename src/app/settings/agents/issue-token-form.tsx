"use client";

import { useActionState } from "react";
import { createAgentToken, type TokenFormState } from "./actions";

const initial: TokenFormState = null;

export function IssueTokenForm() {
  const [state, action, pending] = useActionState(createAgentToken, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Claude Code on this laptop"
          className="rounded-2xl border border-rule bg-card px-3.5 py-2.5 text-ink outline-none focus:border-ink"
        />
      </label>
      <button
        disabled={pending}
        className="self-start rounded-full bg-ink px-4 py-2 text-sm text-paper font-medium transition-[transform,opacity] duration-[var(--dur-micro)] active:scale-[0.98] disabled:opacity-50"
      >
        Create token
      </button>
      {state?.error && <p role="alert" className="text-sm text-brand">{state.error}</p>}
      {state?.token && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Copy this token now. It will not be shown again.</p>
          <pre className="overflow-x-auto rounded-2xl border border-rule bg-paper-2 p-3 text-xs">
            {state.token}
          </pre>
        </div>
      )}
    </form>
  );
}
