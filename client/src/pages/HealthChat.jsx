import AppShell from "../components/Shared/AppShell";
import ChatPanel from "../components/Chat/ChatPanel";

export default function HealthChat() {
  return (
    <AppShell title="Health chat" subtitle="Ask about symptoms, sleep, fitness or food. Answers take your profile and last week's logs into account.">
      <div className="ui-card">
        <ChatPanel mode="general" />
      </div>
    </AppShell>
  );
}
