import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { ParseTreeNode } from "@/lib/cyk";

interface Props {
  tree: ParseTreeNode | null;
}

const NODE_W = 70;
const NODE_H = 40;
const H_GAP = 18;
const V_GAP = 70;

type Layout = {
  x: number;
  width: number;
  node: ParseTreeNode;
  children: Layout[];
};

function layout(tree: ParseTreeNode): Layout {
  if (tree.children.length === 0) {
    return { x: 0, width: NODE_W, node: tree, children: [] };
  }
  const children = tree.children.map(layout);
  let cursor = 0;
  for (const c of children) {
    c.x = cursor;
    cursor += c.width + H_GAP;
  }
  const totalWidth = cursor - H_GAP;
  // shift children so parent is centered
  return {
    x: 0,
    width: Math.max(totalWidth, NODE_W),
    node: tree,
    children,
  };
}

function flatten(
  l: Layout,
  depth: number,
  offsetX: number,
  nodes: Node[],
  edges: Edge[],
  parentId?: string
) {
  const isTerminal = l.children.length === 0;
  const cx = offsetX + l.x + l.width / 2 - NODE_W / 2;
  const isRoot = !parentId;

  nodes.push({
    id: l.node.id,
    position: { x: cx, y: depth * V_GAP },
    data: { label: l.node.label },
    style: {
      width: NODE_W,
      height: NODE_H,
      borderRadius: 8,
      border: isRoot
        ? "2px solid var(--primary)"
        : isTerminal
          ? "1px solid oklch(0.65 0.18 150 / 0.5)"
          : "1px solid var(--border)",
      background: isRoot
        ? "var(--gradient-primary)"
        : isTerminal
          ? "oklch(0.95 0.06 150)"
          : "var(--card)",
      color: isRoot ? "white" : isTerminal ? "oklch(0.3 0.15 150)" : "var(--foreground)",
      fontWeight: 600,
      fontFamily: "ui-monospace, monospace",
      fontSize: 13,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: isRoot ? "var(--shadow-elegant)" : "var(--shadow-card)",
    },
    sourcePosition: "bottom" as any,
    targetPosition: "top" as any,
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${l.node.id}`,
      source: parentId,
      target: l.node.id,
      type: "smoothstep",
      style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" } as any,
    });
  }

  for (const c of l.children) {
    flatten(c, depth + 1, offsetX + l.x, nodes, edges, l.node.id);
  }
}

export function ParseTree({ tree }: Props) {
  const { nodes, edges } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [] };
    const root = layout(tree);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    flatten(root, 0, 0, nodes, edges);
    return { nodes, edges };
  }, [tree]);

  if (!tree) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-8">
        Parse tree will appear here when the string is accepted.
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-lg border bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="oklch(0.85 0.01 260)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}