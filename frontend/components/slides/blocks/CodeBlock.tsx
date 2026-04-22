"use client";

import { useState } from "react";

interface Props {
  lang?: string | null;
  code: string;
}

export function CodeBlock({ lang, code }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--c-neutral-900)" }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "var(--c-neutral-850)",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}>
        {lang && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 600, letterSpacing: "0.05em" }}>
            {lang}
          </span>
        )}
        <button
          onClick={handleCopy}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: copied ? "var(--c-green-400)" : "rgba(255,255,255,.45)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
            transition: "color .15s",
            padding: "2px 0",
          }}
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      {/* Code */}
      <pre style={{
        margin: 0,
        padding: "16px 20px",
        overflowX: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "rgb(230,235,242)",
        tabSize: 2,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
