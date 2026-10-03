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
          className="rounded-field glass-inset px-3 py-2 outline-none focus:border-ring focus:outline-none"
        />
      </label>
      <button
        disabled={pending}
        className="self-start rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
      >
        Create token
      </button>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.token && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Copy this token now. It will not be shown again.</p>
          <pre className="overflow-x-auto rounded-field glass-inset p-3 font-mono text-xs">
            {state.token}
          </pre>
        </div>
      )}
    </form>
  );
}
