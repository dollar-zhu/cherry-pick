"use client";

import { openConversationInputs, useEveAgent } from "eve/react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return {};
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function Chat() {
  const [input, setInput] = useState("");
  const { data, status, error, send, respond } = useEveAgent({ headers: authHeaders });
  const busy = status === "submitted" || status === "streaming" || status === "resuming";
  const pending = openConversationInputs(data);

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-4">
        {data.messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "self-end" : "self-start"}>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <p
                    key={index}
                    className={
                      message.role === "user"
                        ? "whitespace-pre-wrap rounded-2xl bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
                        : "whitespace-pre-wrap leading-7"
                    }
                  >
                    {part.text}
                  </p>
                );
              }
              if (part.type === "dynamic-tool") {
                return (
                  <p key={index} className="font-mono text-xs text-zinc-500">
                    {part.toolName} · {part.state}
                  </p>
                );
              }
              return null;
            })}
          </div>
        ))}

        {pending.map(({ request }) => (
          <div
            key={request.requestId}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-sm">{request.prompt}</p>
            <pre className="overflow-x-auto text-xs text-zinc-500">
              {JSON.stringify(request.action.input, null, 2)}
            </pre>
            <div className="flex gap-2">
              {request.options?.map((option) => (
                <button
                  key={option.id}
                  disabled={busy}
                  onClick={() => respond([{ requestId: request.requestId, optionId: option.id }])}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error.message}</p>}
      </div>

      <form
        className="sticky bottom-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = input.trim();
          if (!message || busy) return;
          setInput("");
          void send(message);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search the web, send an email, check Linear…"
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-black"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
        >
          Send
        </button>
      </form>
    </div>
  );
}
