"use client";
import React from "react";

export default function AgentStatusBadge({ status }: { status: string }) {
  const color =
    status === "running" ? "green" :
    status === "error" ? "red" : "gray";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "8px",
        background: color,
        color: "white",
        fontSize: "0.8rem",
      }}
    >
      {status}
    </span>
  );
}
