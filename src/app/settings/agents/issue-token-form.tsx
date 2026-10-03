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
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-black"
        />
      </label>
      <button
        disabled={pending}
        className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        Create token
      </button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.token && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Copy this token now. It will not be shown again.</p>
          <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950">
            {state.token}
          </pre>
        </div>
      )}
    </form>
  );
}
