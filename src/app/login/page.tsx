"use client";

import { useActionState } from "react";
import { buttonPrimary, buttonQuiet, input } from "@/components/ui";
import { authenticate } from "./actions";

export default function LoginPage() {
  const [message, action, pending] = useActionState(authenticate, null);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <header className="reveal flex flex-col gap-2">
        <h1 className="font-display text-5xl tracking-[-0.02em]">Welcome</h1>
        <p className="text-ink-2">Plan events with partner companies.</p>
      </header>
      <form action={action} className="reveal flex flex-col gap-4" style={{ "--i": 1 } as React.CSSProperties}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
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
        {message && <p role="alert" className="text-sm text-accent">{message}</p>}
        <div className="mt-2 flex flex-col gap-2">
          <button
            name="mode"
            value="signin"
            disabled={pending}
            className={`${buttonPrimary} py-2.5`}
          >
            Sign in
          </button>
          <button
            name="mode"
            value="signup"
            disabled={pending}
            className={`${buttonQuiet} py-2.5`}
          >
            Create account
          </button>
        </div>
      </form>
    </main>
  );
}
