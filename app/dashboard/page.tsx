import { getAgentStatus } from "@/src/lib/status";
import AgentStatusBadge from "@/components/AgentStatusBadge";
import AgentControls from "@/components/AgentControls";

export default function DashboardPage() {
  const status = getAgentStatus();
  return (
    <div>
      <h1>Firefly Dashboard</h1>
      <AgentStatusBadge ok={status.ok} />
      <AgentControls />
    </div>
  );
}
