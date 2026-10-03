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
          className="rounded-full border border-rule px-3 py-1 text-xs"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-2xl border border-rule bg-paper-2 p-3 text-xs leading-relaxed">
        {value}
      </pre>
    </section>
  );
}
