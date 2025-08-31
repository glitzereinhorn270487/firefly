"use client";
import * as React from "react";

export function AgentControls() {
  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }}>
      <button
        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: "#18181b", color:"#fff", cursor:"pointer" }}
        onClick={() => alert("Start (demo)")}>
        ▶ Start
      </button>
      <button
        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: "#18181b", color:"#fff", cursor:"pointer" }}
        onClick={() => alert("Stop (demo)")}>
        ⏸ Stop
      </button>
      <button
        style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", background: "#18181b", color:"#fff", cursor:"pointer" }}
        onClick={() => alert("Refresh (demo)")}>
        ⟳ Refresh
      </button>
    </div>
  );
}
