export type NodeShape = "rect" | "round" | "diamond" | "circle";

export interface ParsedNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface ParsedEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

export interface ParsedGraph {
  direction: "LR" | "TD" | "RL" | "BT";
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

const SHAPE_PATTERNS: Array<{ open: string; close: string; shape: NodeShape }> = [
  { open: "((", close: "))", shape: "circle" },
  { open: "{",  close: "}",  shape: "diamond" },
  { open: "(",  close: ")",  shape: "round" },
  { open: "[",  close: "]",  shape: "rect" },
];

function extractNodeDef(token: string): { id: string; label: string; shape: NodeShape } | null {
  for (const p of SHAPE_PATTERNS) {
    const oi = token.indexOf(p.open);
    const ci = token.lastIndexOf(p.close);
    if (oi !== -1 && ci > oi) {
      const id = token.slice(0, oi).trim();
      const label = token.slice(oi + p.open.length, ci).trim();
      if (id) return { id, label: label || id, shape: p.shape };
    }
  }
  // plain id with no brackets
  const id = token.trim();
  if (id && /^\w+$/.test(id)) return { id, label: id, shape: "rect" };
  return null;
}

export function parseMermaid(code: string): ParsedGraph {
  const lines = code.split("\n").map((l) => l.trim()).filter(Boolean);

  let direction: ParsedGraph["direction"] = "LR";
  const nodesMap = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let edgeIdx = 0;

  const addNode = (def: { id: string; label: string; shape: NodeShape }) => {
    if (!nodesMap.has(def.id)) nodesMap.set(def.id, def);
  };

  for (const line of lines) {
    // direction header
    if (/^(flowchart|graph)\s+/i.test(line)) {
      const m = line.match(/^(?:flowchart|graph)\s+(LR|TD|RL|BT)/i);
      if (m) direction = m[1].toUpperCase() as ParsedGraph["direction"];
      continue;
    }

    // skip style / classDef / class lines
    if (/^(style|classDef|class|linkStyle|subgraph|end)\b/.test(line)) continue;

    // Edge pattern: source [arrow] target  (arrow types: -->, ---, -.->)
    // Also handles: A -->|label| B  and  A -- label --> B
    const edgeRe = /^(.+?)\s*(-->|---|-\.->|==>)(?:\|([^|]*)\|)?\s*(.+)$/;
    const m = line.match(edgeRe);

    if (m) {
      const rawSrc = m[1].trim();
      const arrowType = m[2];
      const edgeLabel = m[3]?.trim();
      const rawTgt = m[4].trim();

      const srcDef = extractNodeDef(rawSrc);
      const tgtDef = extractNodeDef(rawTgt);

      if (srcDef && tgtDef) {
        addNode(srcDef);
        addNode(tgtDef);
        edges.push({
          id: `e${edgeIdx++}`,
          source: srcDef.id,
          target: tgtDef.id,
          label: edgeLabel,
          dashed: arrowType === "-.->" || arrowType === "-.->",
        });
      }
      continue;
    }

    // Standalone node definition
    const nodeDef = extractNodeDef(line);
    if (nodeDef) addNode(nodeDef);
  }

  return {
    direction,
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}
