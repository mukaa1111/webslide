"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { parseMermaid } from "@/lib/parseMermaid";

// ── Node widths/heights for dagre ─────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 56;

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TD" | "RL" | "BT"
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 110,
    marginx: 32,
    marginy: 32,
  });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

// ── Custom node component ─────────────────────────────────────────────────────
function FlowNode({ data }: NodeProps) {
  const label = data.label as string;
  const shape = data.shape as string;

  const isDiamond = shape === "diamond";
  const isCircle = shape === "circle";

  const base: React.CSSProperties = {
    fontFamily: "var(--font-sans, sans-serif)",
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.35,
    textAlign: "center",
    padding: "10px 14px",
    background: "var(--surface-elevated, #fff)",
    border: "1.5px solid var(--line-default, #d0d5dd)",
    color: "var(--label-strong, #111)",
    width: NODE_W,
    minHeight: NODE_H,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
    wordBreak: "keep-all",
  };

  if (isCircle) {
    base.borderRadius = "50%";
    base.background = "var(--primary-normal, #0066FF)";
    base.color = "#fff";
    base.border = "none";
  } else if (isDiamond) {
    base.borderRadius = 6;
    base.background = "color-mix(in oklab, var(--primary-normal) 12%, var(--surface-elevated))";
    base.border = "1.5px solid color-mix(in oklab, var(--primary-normal) 40%, transparent)";
    base.color = "var(--primary-normal, #0066FF)";
  } else if (shape === "round") {
    base.borderRadius = 100;
  } else {
    base.borderRadius = 8;
  }

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div style={base}>{label}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
}

const nodeTypes = { custom: FlowNode };

// ── Inner component (needs ReactFlow context) ─────────────────────────────────
function FlowInner({ code }: { code: string }) {
  const parsed = parseMermaid(code);
  const { fitView } = useReactFlow();

  const initNodes: Node[] = parsed.nodes.map((n) => ({
    id: n.id,
    type: "custom",
    position: { x: 0, y: 0 },
    data: { label: n.label, shape: n.shape },
  }));

  const initEdges: Edge[] = parsed.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
    style: {
      stroke: "var(--line-default, #d0d5dd)",
      strokeWidth: 1.5,
      strokeDasharray: e.dashed ? "5 4" : undefined,
    },
    labelStyle: {
      fontFamily: "var(--font-sans, sans-serif)",
      fontSize: 10,
      fontWeight: 600,
      fill: "var(--label-alternative, #6b7280)",
    },
    labelBgStyle: {
      fill: "var(--surface-subtle, #f5f6f7)",
      rx: 4,
      ry: 4,
    },
    labelBgPadding: [4, 6] as [number, number],
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "var(--line-default, #d0d5dd)",
      width: 14,
      height: 14,
    },
  }));

  const laid = applyDagreLayout(initNodes, initEdges, parsed.direction);
  const [nodes, , onNodesChange] = useNodesState(laid);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.25, duration: 200 }), 50);
    return () => clearTimeout(t);
  }, [fitView]);

  const onInit = useCallback(() => {
    fitView({ padding: 0.25, duration: 0 });
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={onInit}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnScroll={false}
      panOnScroll={false}
      panOnDrag={false}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <Background color="var(--line-subtle, #e8eaed)" gap={20} size={1} />
    </ReactFlow>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export function FlowDiagram({ code }: { code: string }) {
  return (
    <div style={{ width: "100%", height: 420, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line-subtle)" }}>
      <ReactFlowProvider>
        <FlowInner code={code} />
      </ReactFlowProvider>
    </div>
  );
}
