export type AgentStatus = "idle" | "trading" | "error";

export function getAgentStatus(): AgentStatus {
  // Minimaler Stub → immer idle
  return "idle";
}
