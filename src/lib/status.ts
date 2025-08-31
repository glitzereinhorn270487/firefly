export function getAgentStatus() {
  return { ok: true, lastHeartbeat: new Date().toISOString() };
}
