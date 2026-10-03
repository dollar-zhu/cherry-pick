"use client";

import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/intent";
import { IntentCard } from "./intent-card";

const Text: TextMessagePartComponent = ({ text }) => (
  <p className="whitespace-pre-wrap leading-7">{text}</p>
);

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-brand-gradient-text px-4 py-2 text-primary">
        <MessagePrimitive.Parts components={{ Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col gap-2">
      <MessagePrimitive.Parts
        components={{
          Text,
          tools: { by_name: { propose_event_intent: IntentCard }, Fallback: () => null },
        }}
      />
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root role="alert" className="text-sm text-destructive">
          <ErrorPrimitive.Message />
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

export function Thread() {
  // Defaults to AssistantChatTransport posting to /api/chat.
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex w-full flex-1 flex-col">
        <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-6 overflow-y-auto">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <p className="text-muted-foreground">
              Describe the event you want to host: what it&apos;s about, where, when, how many
              guests, and your budget.
            </p>
          </AuiIf>

          <ThreadPrimitive.Messages>
            {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
          </ThreadPrimitive.Messages>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-background pb-6 pt-2">
            <ComposerPrimitive.Root className="flex gap-2">
              <ComposerPrimitive.Input
                autoFocus
                maxLength={CHAT_MAX_MESSAGE_CHARS}
                placeholder="Plan a dinner for 20 founders in Berlin…"
                className="flex-1 resize-none rounded-2xl glass-inset px-4 py-2 outline-none focus:border-ring"
              />
              <AuiIf condition={(s) => !s.thread.isRunning}>
                <ComposerPrimitive.Send className="rounded-full bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 hover:bg-primary/90">
                  Send
                </ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel className="rounded-full border border-border bg-secondary px-4 py-2 hover:bg-foreground/10">
                  Stop
                </ComposerPrimitive.Cancel>
              </AuiIf>
            </ComposerPrimitive.Root>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
