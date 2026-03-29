import { motion } from "framer-motion";
import { useRef, useState } from "react";

interface Node {
  id: string;
  label: string;
  type: "entity" | "shell" | "beneficiary" | "account";
  x: number;
  y: number;
  risk: "high" | "mid" | "low";
}

interface Edge {
  from: string;
  to: string;
  label?: string;
}

const nodes: Node[] = [
  { id: "alpha", label: "ALPHA_NY", type: "entity", x: 50, y: 20, risk: "high" },
  { id: "shell1", label: "Shell Co A", type: "shell", x: 25, y: 45, risk: "high" },
  { id: "shell2", label: "Shell Co B", type: "shell", x: 75, y: 40, risk: "mid" },
  { id: "named1", label: "Named Acct", type: "account", x: 10, y: 70, risk: "low" },
  { id: "named2", label: "Named Acct 2", type: "account", x: 40, y: 75, risk: "low" },
  { id: "benef1", label: "Beneficiary", type: "beneficiary", x: 85, y: 70, risk: "mid" },
  { id: "benef2", label: "Beneficiary 2", type: "beneficiary", x: 60, y: 85, risk: "high" },
];

const edges: Edge[] = [
  { from: "alpha", to: "shell1", label: "Txns" },
  { from: "alpha", to: "shell2", label: "Txns" },
  { from: "shell1", to: "named1" },
  { from: "shell1", to: "named2" },
  { from: "shell2", to: "benef1", label: "Txns" },
  { from: "shell2", to: "benef2" },
  { from: "named2", to: "benef2" },
];

const riskColors = {
  high: "hsl(var(--risk-high))",
  mid: "hsl(var(--risk-mid))",
  low: "hsl(var(--compliance))",
};

const typeIcons: Record<string, string> = {
  entity: "⚠",
  shell: "🏢",
  beneficiary: "👤",
  account: "💳",
};

export function NetworkGraph() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const selectedEntity = selectedNode ? nodes.find((node) => node.id === selectedNode) : null;
  const connectedEntities = selectedNode
    ? edges
        .filter((edge) => edge.from === selectedNode || edge.to === selectedNode)
        .map((edge) => (edge.from === selectedNode ? edge.to : edge.from))
    : [];

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span>Interactive Entity Network</span>
        <span className="risk-badge-high text-[10px] px-2 py-0.5 rounded-sm font-mono">ALERT_CONFIRMED</span>
      </div>
      <div className="flex-1 relative p-4 min-h-[300px]">
        <div className="text-center mb-2">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            SUSPICIOUS ENTITY ALPHA_NY NETWORK
          </span>
        </div>
        <svg className="w-full h-full absolute inset-0" style={{ minHeight: 280 }}>
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from)!;
            const toNode = nodes.find(n => n.id === edge.to)!;
            return (
              <motion.line
                key={i}
                x1={`${fromNode.x}%`}
                y1={`${fromNode.y}%`}
                x2={`${toNode.x}%`}
                y2={`${toNode.y}%`}
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 p-4" onClick={() => setSelectedNode(null)}>
          {nodes.map((node, i) => {
            const isSelected = selectedNode === node.id;
            const isDimmed = selectedNode && !isSelected;
            return (
              <motion.div
                key={node.id}
                className="absolute"
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.3, type: "spring", stiffness: 300 }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("clicked node:", node);
                  setSelectedNode(node.id === selectedNode ? null : node.id);
                }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] border cursor-pointer transition-transform ${
                    isSelected ? "ring-2 ring-primary bg-primary/20 scale-110" : "hover:scale-110"
                  } ${isDimmed ? "opacity-40" : ""}`}
                  style={{
                    backgroundColor: `${riskColors[node.risk]}20`,
                    borderColor: `${riskColors[node.risk]}80`,
                  }}
                >
                  <span>{typeIcons[node.type]}</span>
                </div>
                <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-muted-foreground">
                  {node.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute bottom-3 left-4 flex gap-3">
          {[
            { label: "Threat Nodes", color: riskColors.high },
            { label: "Connections", color: "hsl(var(--primary))" },
            { label: "Risk Levels", color: riskColors.mid },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[9px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {selectedEntity && (
        <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-[11px] font-semibold">Selected Entity</div>
              <div className="text-[10px] text-muted-foreground">{selectedEntity.label}</div>
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {selectedEntity.type}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] text-muted-foreground">Risk Level</div>
              <div className="mt-1 text-[10px] font-semibold">{selectedEntity.risk.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground">Connections</div>
              <div className="mt-1 text-[10px] font-semibold">{connectedEntities.length}</div>
            </div>
          </div>
          {connectedEntities.length > 0 && (
            <div className="mt-3 text-[9px] text-muted-foreground">
              Connected to: {connectedEntities.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
