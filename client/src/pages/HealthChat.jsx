import AppShell from "../components/Shared/AppShell";
import ChatPanel from "../components/Chat/ChatPanel";

export default function HealthChat() {
  return (
    <AppShell title="Health chat" subtitle="A place for your health questions.">
      <div className="chat-workspace">
        <ChatPanel mode="general" />
      </div>
    </AppShell>
  );
}
