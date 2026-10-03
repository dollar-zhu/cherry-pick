"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Thread } from "./thread";

const VoiceChat = dynamic(() => import("./voice-chat").then((mod) => mod.VoiceChat), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-2">Loading voice chat…</p>,
});

export function Intake() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");

  return (
    <div className="reveal flex min-h-0 flex-1 flex-col gap-6" style={{ "--i": 1 } as React.CSSProperties}>
      <div
        role="tablist"
        aria-label="How to plan"
        className="relative grid w-56 grid-cols-2 rounded-full bg-paper-2 p-1 text-sm"
      >
        {/* Slides under the selected tab. */}
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm transition-transform duration-[var(--dur-short)] ease-[var(--ease-out)] ${
            mode === "voice" ? "translate-x-full" : ""
          }`}
        />
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
      className={`relative z-10 rounded-full px-3 py-1.5 font-medium transition-colors duration-[var(--dur-short)] ${
        selected ? "text-ink" : "text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
