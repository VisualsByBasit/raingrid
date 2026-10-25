"use client";

import { useState } from "react";
import { contactNumber, waLink } from "@/lib/whatsapp";

// The last step of a request: with the team's WhatsApp number configured,
// open WhatsApp with the message; without it (demo mode), preview the exact
// message with a Copy button.
export default function SendStep({ text, onBack, onDone }: { text: string; onBack: () => void; onDone: () => void }) {
  const number = contactNumber();
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  if (number) {
    return (
      <div className="space-y-3">
        <p className="text-muted">WhatsApp opens with this message. Nothing is sent until you press send.</p>
        <pre className="num max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink p-3 text-xs text-fg">{text}</pre>
        <a
          href={waLink(number, text)}
          target="_blank"
          rel="noreferrer"
          onClick={onDone}
          className="btn-primary block w-full rounded-xl px-4 py-3 text-center font-semibold"
        >
          Open WhatsApp
        </a>
        <button onClick={onBack} className="w-full text-xs text-muted underline underline-offset-4">
          Back to the form
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-drain/40 bg-drain/10 p-3">
        <p className="font-semibold text-drain-deep">Demo mode</p>
        <p className="mt-0.5 text-[13px] text-fg">
          This is the exact WhatsApp message RainGrid will send. It goes live when the team&apos;s number is added; for now
          nothing is sent.
        </p>
      </div>
      <pre className="num max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink p-3 text-xs text-fg">{text}</pre>
      <button onClick={copy} className="btn-primary w-full rounded-xl px-4 py-3 font-semibold">
        {copied === "copied" ? "Copied" : "Copy message"}
      </button>
      {copied === "failed" && <p className="text-xs text-muted">Copy didn&apos;t work in this browser. Select the text above and copy it.</p>}
      <button onClick={onBack} className="w-full text-xs text-muted underline underline-offset-4">
        Back to the form
      </button>
    </div>
  );
}
