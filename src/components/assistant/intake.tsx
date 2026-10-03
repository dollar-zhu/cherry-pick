"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Thread } from "./thread";

const VoiceChat = dynamic(() => import("./voice-chat").then((mod) => mod.VoiceChat), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading voice chat…</p>,
});

export function Intake() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        role="tablist"
        aria-label="How to plan"
        className="flex w-fit gap-1 rounded-full bg-muted p-1 text-sm"
      >
        <Tab selected={mode === "chat"} onClick={() => setMode("chat")}>
          Chat
        </Tab>
        <Tab selected={mode === "voice"} onClick={() => setMode("voice")}>
          Voice
        </Tab>
      </div>
      {mode === "chat" ? <Thread /> : <VoiceChat />}
    </div>
  );
}

function Tab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={
        selected
          ? "rounded-full bg-foreground/15 px-3 py-1 text-foreground"
          : "rounded-full px-3 py-1 text-muted-foreground"
      }
    >
      {children}
    </button>
  );
}
