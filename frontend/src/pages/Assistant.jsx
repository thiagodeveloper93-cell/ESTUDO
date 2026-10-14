import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Send, Trash2, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";

const SUGGESTIONS = [
  "Como funciona o cálculo do INSS no meu holerite?",
  "Quantos dias de férias posso tirar e como dividir?",
  "Quais são meus direitos em caso de atestado médico?",
];

async function streamReply(sid, text, onDelta) {
  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/assistant/sessions/${sid}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("rh_token")}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Falha ao enviar mensagem");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop();
    for (const ev of events) {
      if (!ev.startsWith("data: ")) continue;
      const data = JSON.parse(ev.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.delta) onDelta(data.delta);
    }
  }
}

function SessionList({ sessions, active, onSelect, onNew, onDelete }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 lg:w-72" data-testid="chat-session-list">
      <Button onClick={onNew} data-testid="chat-new-session-btn" className="w-full">
        <Plus className="mr-2 h-4 w-4" /> Nova conversa
      </Button>
      <div className="max-h-[60vh] space-y-1 overflow-y-auto">
        {sessions.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>}
        {sessions.map((s) => (
          <div
            key={s._id}
            data-testid={`chat-session-${s._id}`}
            onClick={() => onSelect(s._id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              active === s._id ? "bg-blue-600 text-white" : "hover:bg-muted"
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{s.title}</span>
            <button
              data-testid={`chat-delete-session-${s._id}`}
              onClick={(e) => { e.stopPropagation(); onDelete(s._id); }}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Excluir conversa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m, idx }) {
  const mine = m.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`chat-message-${idx}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          mine ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm border bg-card"
        }`}
      >
        {m.content || <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const loadSessions = () => api.get("/assistant/sessions").then((r) => setSessions(r.data));
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const select = async (sid) => {
    setActive(sid);
    const r = await api.get(`/assistant/sessions/${sid}/messages`);
    setMessages(r.data);
  };

  const newSession = async () => {
    const r = await api.post("/assistant/sessions");
    setSessions((s) => [r.data, ...s]);
    setActive(r.data._id);
    setMessages([]);
    return r.data._id;
  };

  const remove = async (sid) => {
    try {
      await api.delete(`/assistant/sessions/${sid}`);
      if (sid === active) { setActive(null); setMessages([]); }
      loadSessions();
    } catch (e) { toast.error(apiError(e)); }
  };

  const send = async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const sid = active || (await newSession());
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    try {
      await streamReply(sid, text, (d) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + d };
          return copy;
        })
      );
    } catch (e) {
      toast.error(e.message);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
      loadSessions();
    }
  };

  return (
    <div data-testid="assistant-page">
      <PageHeader title="Assistente RH" subtitle="Tire dúvidas sobre férias, holerites, benefícios e CLT com o ChatGPT." />
      <div className="flex flex-col gap-4 lg:flex-row">
        <SessionList sessions={sessions} active={active} onSelect={select} onNew={newSession} onDelete={remove} />
        <div className="flex min-h-[65vh] flex-1 flex-col rounded-2xl border bg-muted/30">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6" data-testid="chat-messages">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-start justify-center gap-4 py-10">
                <div className="flex items-center gap-2 text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                  <Sparkles className="h-5 w-5 text-violet-500" /> Como posso ajudar hoje?
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={s} onClick={() => send(s)} data-testid={`chat-suggestion-${i}`}
                      className="rounded-full border bg-card px-4 py-2 text-xs transition-colors hover:border-blue-500 hover:text-blue-600">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} m={m} idx={i} />)}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 border-t bg-card p-3">
            <Textarea
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Escreva sua pergunta…"
              rows={1}
              className="min-h-[44px] resize-none"
            />
            <Button onClick={() => send()} disabled={sending || !input.trim()} data-testid="chat-send-btn" size="icon" className="h-11 w-11 shrink-0">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
