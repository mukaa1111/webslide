import type { SlideData, ContentBlock } from "@/types/slide";
import { CodeBlock } from "./blocks/CodeBlock";
import { MermaidDiagram } from "./MermaidDiagram";

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(block.depth ?? 1, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const sizes: Record<number, string> = { 1: "2em", 2: "1.5em", 3: "1.25em" };
      return (
        <Tag style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: sizes[block.depth ?? 1] || "1.1em",
          letterSpacing: "-0.025em",
          color: "var(--label-strong)",
          lineHeight: 1.25,
          marginBottom: "0.5em",
        }}>
          {block.text}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p style={{ lineHeight: 1.7, color: "var(--label-normal)", marginBottom: "1em" }}>
          {block.text}
        </p>
      );

    case "code":
      return <div style={{ marginBottom: "1em" }}><CodeBlock lang={block.lang} code={block.text ?? ""} /></div>;

    case "list":
      return (
        <ul
          style={{
            paddingLeft: 24,
            marginBottom: "1em",
            listStyle: block.ordered ? "decimal" : "disc",
          }}
        >
          {(block.items ?? []).map((item, i) => (
            <li key={i} style={{ lineHeight: 1.6, marginBottom: 6, color: "var(--label-normal)" }}>
              {item.text}
            </li>
          ))}
        </ul>
      );

    case "blockquote":
      return (
        <blockquote style={{
          borderLeft: "3px solid var(--primary-normal)",
          paddingLeft: 16,
          marginLeft: 0,
          marginBottom: "1em",
          color: "var(--label-alternative)",
          fontStyle: "italic",
        }}>
          {block.text}
        </blockquote>
      );

    case "table":
      return (
        <div style={{ overflowX: "auto", marginBottom: "1em" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {(block.headers ?? []).map((h, i) => (
                  <th key={i} style={{
                    padding: "8px 12px",
                    borderBottom: "2px solid var(--line-default)",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "var(--label-strong)",
                    background: "var(--surface-subtle)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows ?? []).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--line-subtle)",
                      color: "var(--label-normal)",
                    }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "image":
      return (
        <figure style={{ marginBottom: "1em", textAlign: "center" }}>
          <img src={block.url} alt={block.alt ?? ""} style={{ maxWidth: "100%", borderRadius: "var(--radius-lg)" }} />
          {block.alt && <figcaption style={{ marginTop: 8, fontSize: 12, color: "var(--label-alternative)" }}>{block.alt}</figcaption>}
        </figure>
      );

    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid var(--line-subtle)", margin: "1.5em 0" }} />;

    default:
      return null;
  }
}

// ── Layout-specific renderers ─────────────────────────────────────────────────

function DiagramLayout({ slide }: { slide: SlideData }) {
  const titleBlock = slide.blocks.find((b) => b.type === "heading");
  const mermaidBlock = slide.blocks.find((b) => b.type === "code" && b.lang === "mermaid");
  const captionBlock = slide.blocks.find((b) => b.type === "paragraph");

  return (
    <div style={{ padding: "40px 48px", minHeight: 400, display: "flex", flexDirection: "column", gap: 24 }}>
      {titleBlock && (
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5em", color: "var(--label-strong)", margin: 0 }}>
          {titleBlock.text}
        </h2>
      )}
      {mermaidBlock ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-subtle)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <MermaidDiagram code={mermaidBlock.text ?? ""} />
        </div>
      ) : (
        slide.blocks.filter((b) => b.type === "code").map((b, i) => (
          <CodeBlock key={i} lang={b.lang} code={b.text ?? ""} />
        ))
      )}
      {captionBlock && (
        <p style={{ textAlign: "center", fontSize: 14, color: "var(--label-alternative)", margin: 0 }}>
          {captionBlock.text}
        </p>
      )}
    </div>
  );
}

function StatementLayout({ slide }: { slide: SlideData }) {
  const textBlocks = slide.blocks.filter((b) => b.type === "heading" || b.type === "paragraph");

  return (
    <div style={{
      padding: "40px 48px",
      minHeight: 400,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      gap: 20,
    }}>
      {textBlocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h2 key={i} style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(1.8em, 4vw, 2.8em)",
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              color: "var(--label-strong)",
              margin: 0,
              whiteSpace: "pre-line",
            }}
              dangerouslySetInnerHTML={{ __html: b.text?.replace(/<br\s*\/?>/gi, "\n") ?? "" }}
            />
          );
        }
        return (
          <p key={i} style={{ fontSize: "1.1em", lineHeight: 1.7, color: "var(--label-alternative)", maxWidth: 640, margin: 0 }}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

function CompareLayout({ slide }: { slide: SlideData }) {
  const titleBlock = slide.blocks.find((b) => b.type === "heading");
  const tableBlock = slide.blocks.find((b) => b.type === "table");
  const otherBlocks = slide.blocks.filter((b) => b.type !== "heading" && b.type !== "table");

  const colColors = ["var(--primary-normal, #0066FF)", "var(--c-violet-500, #6541F2)", "var(--c-cyan-500, #0098B2)"];

  return (
    <div style={{ padding: "40px 48px", minHeight: 400, display: "flex", flexDirection: "column", gap: 24 }}>
      {titleBlock && (
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5em", color: "var(--label-strong)", margin: 0 }}>
          {titleBlock.text}
        </h2>
      )}
      {tableBlock && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${(tableBlock.headers ?? []).length}, 1fr)`, gap: 16 }}>
          {(tableBlock.headers ?? []).map((header, ci) => (
            <div key={ci} style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line-subtle)" }}>
              <div style={{ background: colColors[ci % colColors.length], padding: "12px 16px" }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{header}</span>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {(tableBlock.rows ?? []).map((row, ri) => (
                  <div key={ri} style={{ fontSize: 14, color: "var(--label-normal)", lineHeight: 1.5 }}>
                    {row[ci] ?? ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {otherBlocks.map((b, i) => <BlockRenderer key={i} block={b} />)}
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

interface Props {
  slide: SlideData;
}

export function SlideRenderer({ slide }: Props) {
  if (slide.layout === "diagram") return <DiagramLayout slide={slide} />;
  if (slide.layout === "statement") return <StatementLayout slide={slide} />;
  if (slide.layout === "compare") return <CompareLayout slide={slide} />;

  return (
    <div
      style={{
        padding: "40px 48px",
        minHeight: 400,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
      aria-label={`슬라이드 ${slide.index + 1}`}
    >
      {slide.blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}
