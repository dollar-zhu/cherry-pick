"use client";

import { useState } from "react";

export function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
        {value}
      </pre>
    </section>
  );
}
