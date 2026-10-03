"use client";

import { useActionState } from "react";
import { authenticate } from "./actions";

const input =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-black";
const button = "flex-1 rounded-full px-4 py-2 disabled:opacity-50";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [message, action, pending] = useActionState(authenticate, null);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-10 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">Cherry Pick</h1>
      <form action={action} className="flex flex-col gap-3">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className={input}
          />
        </label>
        {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
        <div className="flex gap-2">
          <button
            name="mode"
            value="signin"
            disabled={pending}
            className={`${button} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black`}
          >
            Sign in
          </button>
          <button
            name="mode"
            value="signup"
            disabled={pending}
            className={`${button} border border-zinc-300 dark:border-zinc-700`}
          >
            Create account
          </button>
        </div>
      </form>
    </main>
  );
}
