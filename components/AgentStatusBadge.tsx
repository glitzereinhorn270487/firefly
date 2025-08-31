"use client";
import * as React from "react";

export function AgentStatusBadge({ ok }: { ok: boolean }) {
  const color = ok ? "#16a34a" : "#dc2626";
  const text  = ok ? "healthy" : "unhealthy";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 10px",
      borderRadius: 999,
      background: "#111",
      color: "#fff",
      fontSize: 12
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, background: color
      }} />
      Agent is {text}
    </span>
  );
}
