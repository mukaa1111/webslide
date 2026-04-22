"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
}

export function MermaidDiagram({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        fontFamily: "var(--font-sans, sans-serif)",
        fontSize: 14,
      });

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid
        .render(id, code)
        .then(({ svg }) => {
          el.innerHTML = svg;
        })
        .catch((err) => {
          setError(String(err));
        });
    });
  }, [code]);

  if (error) {
    return (
      <pre style={{ color: "var(--status-error, #e53e3e)", fontSize: 12, whiteSpace: "pre-wrap" }}>
        {error}
      </pre>
    );
  }

  return <div ref={ref} style={{ width: "100%", textAlign: "center" }} />;
}
