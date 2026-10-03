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
import { buttonDark, buttonQuiet } from "@/components/styles";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/intent";
import { IntentCard } from "./intent-card";

// Fill the composer; the host edits before sending.
const EXAMPLES = [
  "A dinner for 20 founders in San Francisco next month, budget $3,000",
  "An AI agents hackathon for 150 developers, and we need a venue",
  "A breakfast talk on fundraising for 40 people, any weekday",
];

const Text: TextMessagePartComponent = ({ text }) => (
  <p className="whitespace-pre-wrap leading-7 text-ink">{text}</p>
);

function UserMessage() {
  return (
    <MessagePrimitive.Root className="reveal flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2 text-paper [&_p]:text-paper">
        <MessagePrimitive.Parts components={{ Text }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="reveal flex flex-col gap-2">
      <MessagePrimitive.Parts
        components={{
          Text,
          tools: { by_name: { propose_event_intent: IntentCard }, Fallback: () => null },
        }}
      />
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root role="alert" className="text-sm text-brand">
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
            <div className="flex flex-col gap-4">
              <p className="text-ink-2">
                Describe the event you want to host: what it&apos;s about, where, when, how many
                guests, and your budget.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((prompt) => (
                  <ThreadPrimitive.Suggestion
                    key={prompt}
                    prompt={prompt}
                    send={false}
                    className="rounded-full border border-rule bg-card px-3.5 py-1.5 text-left text-sm text-ink transition-[background-color,transform] duration-[var(--dur-micro)] hover:bg-paper-2 active:scale-[0.98]"
                  >
                    {prompt}
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            </div>
          </AuiIf>

          <ThreadPrimitive.Messages>
            {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
          </ThreadPrimitive.Messages>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-background pb-6 pt-2">
            <ComposerPrimitive.Root className="flex items-end gap-2 rounded-3xl border border-rule bg-card p-2 shadow-[var(--shadow-pop)] transition-colors duration-[var(--dur-micro)] focus-within:border-ink-2/50">
              <ComposerPrimitive.Input
                autoFocus
                maxLength={CHAT_MAX_MESSAGE_CHARS}
                placeholder="Plan a dinner for 20 founders in Berlin…"
                className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-ink outline-none placeholder:text-ink-2/60 focus-visible:outline-none"
              />
              <AuiIf condition={(s) => !s.thread.isRunning}>
                <ComposerPrimitive.Send className={buttonDark}>
                  Send
                </ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel className={buttonQuiet}>
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
