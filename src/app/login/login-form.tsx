"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticate, type AuthActionState } from "./actions";

const initialState: AuthActionState = { message: null, kind: null };

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(authenticate, initialState);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const signingUp = mode === "signup";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{signingUp ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {signingUp
            ? "Use your work email and a password to create an account."
            : "Enter your email and password to continue."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-5">
          <input type="hidden" name="mode" value={mode} />
          {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={6}
              required
              disabled={pending}
            />
          </div>

          {state.message && (
            <Alert variant={state.kind === "error" ? "destructive" : "default"}>
              <AlertDescription role={state.kind === "error" ? "alert" : "status"}>
                {state.message}
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending
              ? signingUp ? "Creating account…" : "Signing in…"
              : signingUp ? "Create account" : "Sign in"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {signingUp ? "Already have an account?" : "New to Cherry Pick?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => setMode(signingUp ? "signin" : "signup")}
              disabled={pending}
            >
              {signingUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
