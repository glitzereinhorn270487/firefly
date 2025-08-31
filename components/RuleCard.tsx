"use client";
import * as React from "react";

type Props = { id: string; name: string; description?: string };

export function RuleCard({ id, name, description }: Props) {
  return (
    <div style={{ padding: 12, border: "1px solid #27272a", borderRadius: 12, background: "#0b0b0c" }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ color: "#a1a1aa", fontSize: 13, marginTop: 4 }}>{id}</div>
      {description ? <div style={{ marginTop: 8, fontSize: 14 }}>{description}</div> : null}
    </div>
  );
}
