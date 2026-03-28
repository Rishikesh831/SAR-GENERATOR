/**
 * Global Transaction Heatmap - 2D World Map Visualization
 * Interactive world map displaying suspicious transactions with risk-based heat markers
 * Includes zoom, pan, hover tooltips, and clickable marker features
 */

import React, { useState, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from "react-simple-maps";

const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Transaction {
  id: string;
  lat: number;
  lng: number;
  riskScore: number;
  type?: string;
}

interface GlobalTransactionHeatmapProps {
  transactions?: Transaction[];
  onTransactionMarkerClick?: (transaction: Transaction) => void;
}

/**
 * Get marker color based on risk score
 */
const getColor = (risk: number): string => {
  if (risk >= 80) return "#ff2d2d";  // Red - High Risk
  if (risk >= 50) return "#ff8c00";  // Orange - Medium Risk
  if (risk >= 20) return "#ffd700";  // Yellow - Suspicious
  return "#00bfff";                  // Blue - Low Risk
};

/**
 * Get marker size based on risk score
 */
const getSize = (risk: number): number => {
  return Math.max(5, risk / 5);
};

/**
 * Generate default suspicious transactions for demo
 */
const generateDefaultTransactions = (): Transaction[] => {
  return [
    { id: "t1", lat: 4, lng: -74, riskScore: 94, type: "drug_trafficking" },
    { id: "t2", lat: 8.5, lng: -80.5, riskScore: 88, type: "money_laundering" },
    { id: "t3", lat: 19.3, lng: -81.3, riskScore: 92, type: "structuring" },
    { id: "t4", lat: 24, lng: 54, riskScore: 76, type: "sanctions_evasion" },
    { id: "t5", lat: 23, lng: -102, riskScore: 68, type: "drug_trafficking" },
    { id: "t6", lat: 22, lng: 114, riskScore: 64, type: "money_laundering" },
    { id: "t7", lat: 47, lng: 8, riskScore: 58, type: "structured_deposits" },
    { id: "t8", lat: -10, lng: -55, riskScore: 52, type: "trade_based_laundering" },
    { id: "t9", lat: 1.3, lng: 103.8, riskScore: 48, type: "cross_border_transactions" },
    { id: "t10", lat: 52, lng: 5, riskScore: 44, type: "beneficial_ownership" },
    { id: "t11", lat: 55, lng: -3, riskScore: 38, type: "wire_transfers" },
    { id: "t12", lat: 37, lng: -95, riskScore: 28, type: "cryptocurrency" },
  ];
};

/**
 * Format transaction type string for display
 */
const formatTransactionType = (type?: string): string => {
  if (!type) return "Unknown";
  return type
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Global Transaction Heatmap Component
 * 2D world map showing suspicious transaction markers with risk-based coloring
 * Features: Zoom, Pan, Hover Tooltips, Clickable Markers
 */
export const GlobalTransactionHeatmap: React.FC<GlobalTransactionHeatmapProps> = ({
  transactions,
  onTransactionMarkerClick,
}) => {
  const displayTransactions = transactions || generateDefaultTransactions();
  const [hoveredTransaction, setHoveredTransaction] = useState<Transaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMarkerMouseEnter = (
    e: React.MouseEvent<SVGCircleElement>,
    transaction: Transaction
  ) => {
    setHoveredTransaction(transaction);
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMarkerMouseMove = (e: React.MouseEvent<SVGCircleElement>) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMarkerMouseLeave = () => {
    setHoveredTransaction(null);
  };

  const handleMarkerClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    onTransactionMarkerClick?.(transaction);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: "1px solid #1e293b", zIndex: 10 }}>
        <h3 style={{ margin: "0 0 4px 0", color: "#e2e8f0", fontSize: "14px", fontWeight: "bold" }}>
          Global Transaction Heatmap
        </h3>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "12px" }}>
          Scroll to zoom • Drag to pan • Click markers for details
        </p>
      </div>

      {/* Map Container */}
      <div
        ref={mapRef}
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          cursor: hoveredTransaction ? "pointer" : "grab",
        }}
      >
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            rotate: [-10, 0, 0],
            scale: 147,
          }}
          width={800}
          height={450}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Zoomable Group for interactivity */}
          <ZoomableGroup
            zoom={1}
            minZoom={1}
            maxZoom={8}
            onMoveEnd={() => {
              // Reset hover position on map move
              setTooltipPos({ x: 0, y: 0 });
            }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1f2937"
                    stroke="#374151"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        fill: "#1f2937",
                        stroke: "#374151",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: "grab",
                        transition: "fill 0.2s ease",
                      },
                      hover: {
                        fill: "#27374f",
                        stroke: "#4b5563",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: "grab",
                        transition: "fill 0.2s ease",
                      },
                      pressed: {
                        fill: "#1a2230",
                        stroke: "#4b5563",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Transaction Markers */}
            {displayTransactions.map((tx) => {
              const isHovered = hoveredTransaction?.id === tx.id;
              const isSelected = selectedTransaction?.id === tx.id;
              const baseSize = getSize(tx.riskScore);
              const displaySize = isHovered ? baseSize * 1.3 : baseSize;

              return (
                <Marker
                  key={tx.id}
                  coordinates={[tx.lng, tx.lat]}
                  onClick={() => handleMarkerClick(tx)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Main marker circle */}
                  <circle
                    r={displaySize}
                    fill={getColor(tx.riskScore)}
                    opacity={isHovered ? 1.0 : 0.8}
                    stroke={isSelected ? "white" : "white"}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{
                      filter: isHovered
                        ? "drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))"
                        : "drop-shadow(0 0 3px rgba(0,0,0,0.5))",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => handleMarkerMouseEnter(e as any, tx)}
                    onMouseMove={(e) => handleMarkerMouseMove(e as any)}
                    onMouseLeave={handleMarkerMouseLeave}
                  />

                  {/* Outer pulse ring for high-risk transactions */}
                  {tx.riskScore >= 80 && (
                    <circle
                      r={baseSize + 4}
                      fill="none"
                      stroke={getColor(tx.riskScore)}
                      strokeWidth={1}
                      opacity={0.3}
                      style={{
                        animation: "pulse 2s infinite",
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Selection highlight ring */}
                  {isSelected && (
                    <circle
                      r={displaySize + 3}
                      fill="none"
                      stroke="white"
                      strokeWidth={1.5}
                      opacity={0.6}
                      style={{
                        animation: "glow 1.5s ease-in-out infinite",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover Tooltip */}
        {hoveredTransaction && (
          <div
            style={{
              position: "absolute",
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y - 80}px`,
              backgroundColor: "#1e293b",
              border: `2px solid ${getColor(hoveredTransaction.riskScore)}`,
              borderRadius: "8px",
              padding: "12px",
              color: "#e2e8f0",
              fontSize: "12px",
              fontWeight: "500",
              pointerEvents: "none",
              zIndex: 100,
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.4)",
              whiteSpace: "nowrap",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              {formatTransactionType(hoveredTransaction.type)}
            </div>
            <div>Risk Score: {hoveredTransaction.riskScore}</div>
            <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>
              {hoveredTransaction.lat.toFixed(2)}°, {hoveredTransaction.lng.toFixed(2)}°
            </div>
          </div>
        )}

        {/* Click Popup Panel */}
        {selectedTransaction && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              backgroundColor: "#1a1f2e",
              border: `2px solid ${getColor(selectedTransaction.riskScore)}`,
              borderRadius: "12px",
              padding: "16px",
              color: "#e2e8f0",
              fontSize: "13px",
              zIndex: 100,
              boxShadow: "0 12px 24px rgba(0, 0, 0, 0.5)",
              minWidth: "240px",
              animation: "slideUp 0.3s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ margin: "0", fontSize: "14px", fontWeight: "bold" }}>
                Transaction Details
              </h4>
              <button
                onClick={() => setSelectedTransaction(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "0",
                  lineHeight: "1",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLButtonElement).style.backgroundColor = "#374151")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLButtonElement).style.backgroundColor = "transparent")
                }
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                borderTop: "1px solid #374151",
                paddingTop: "12px",
              }}
            >
              <div>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>
                  Transaction ID
                </div>
                <div style={{ fontWeight: "500", fontSize: "12px" }}>
                  {selectedTransaction.id}
                </div>
              </div>

              <div>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>
                  Risk Score
                </div>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "12px",
                    color: getColor(selectedTransaction.riskScore),
                  }}
                >
                  {selectedTransaction.riskScore}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>
                  Activity Type
                </div>
                <div style={{ fontWeight: "500", fontSize: "12px" }}>
                  {formatTransactionType(selectedTransaction.type)}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginBottom: "4px" }}>
                  Coordinates
                </div>
                <div style={{ fontWeight: "500", fontSize: "12px" }}>
                  {selectedTransaction.lat.toFixed(4)}° N, {selectedTransaction.lng.toFixed(4)}° E
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pulse and Glow animations */}
        <style>{`
          @keyframes pulse {
            0% {
              r: ${getSize(95) + 4};
              opacity: 0.6;
            }
            100% {
              r: ${getSize(95) + 12};
              opacity: 0;
            }
          }

          @keyframes glow {
            0%, 100% {
              stroke-width: 1.5;
              opacity: 0.6;
            }
            50% {
              stroke-width: 2;
              opacity: 1;
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>

      {/* Risk Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          padding: "12px 16px",
          borderTop: "1px solid #1e293b",
          backgroundColor: "#0f172a",
          flexWrap: "wrap",
          fontSize: "12px",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#ff2d2d",
            }}
          />
          <span style={{ color: "#cbd5e1" }}>High Risk (80+)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#ff8c00",
            }}
          />
          <span style={{ color: "#cbd5e1" }}>Medium Risk (50-80)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#ffd700",
            }}
          />
          <span style={{ color: "#cbd5e1" }}>Suspicious (20-50)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#00bfff",
            }}
          />
          <span style={{ color: "#cbd5e1" }}>Low Risk (&lt;20)</span>
        </div>
      </div>

      {/* Info Text */}
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: "#0f172a",
          borderTop: "1px solid #1e293b",
          fontSize: "11px",
          color: "#64748b",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        Total Suspicious Transactions: {displayTransactions.length} | Use mouse wheel to zoom
      </div>
    </div>
  );
};

export default GlobalTransactionHeatmap;
