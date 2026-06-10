"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ApiChatMessage, ApiConversation } from "@/lib/apiTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// ── Conversation List ─────────────────────────────────────────────────────────
function ConvList({
  convs, activeId, onSelect, myRole,
}: {
  convs: ApiConversation[];
  activeId: string | null;
  onSelect: (c: ApiConversation) => void;
  myRole: "Buyer" | "Seller";
}) {
  return (
    <aside className="flex flex-col border-r border-border h-full min-h-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text">Tin nhắn</h3>
        <p className="text-xs text-text-muted mt-0.5">
          {convs.length} cuộc trò chuyện
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {convs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="size-8 text-text-muted mb-2" />
            <p className="text-xs text-text-muted">Chưa có tin nhắn nào</p>
          </div>
        )}
        {convs.map(c => (
          <button key={c.id} onClick={() => onSelect(c)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 ${c.id === activeId ? "bg-brand/10" : "hover:bg-bg-elev"}`}>
            <div className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white"
              style={{ background: c.otherPartyAvatarColor }}>
              {c.otherPartyName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className={`text-sm truncate ${c.unreadCount > 0 ? "font-bold text-text" : "font-medium text-text"}`}>
                  {c.otherPartyName}
                </p>
                <span className="text-[11px] text-text-dim shrink-0">{fmtRelative(c.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <p className={`text-xs truncate ${c.unreadCount > 0 ? "text-text" : "text-text-muted"}`}>
                  {c.lastMessagePreview || "Bắt đầu trò chuyện…"}
                </p>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 grid size-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ── Message Thread ────────────────────────────────────────────────────────────
function MessageThread({
  conv, messages, myUserId, myRole, sending,
  onSend, onBack,
}: {
  conv: ApiConversation;
  messages: ApiChatMessage[];
  myUserId: string;
  myRole: "Buyer" | "Seller";
  sending: boolean;
  onSend: (body: string) => void;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    onSend(body);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="text-text-muted hover:text-text lg:hidden text-lg leading-none">‹</button>
        <div className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white"
          style={{ background: conv.otherPartyAvatarColor }}>
          {conv.otherPartyName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{conv.otherPartyName}</p>
          <p className="text-xs text-text-muted">@{conv.otherPartyUsername}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="size-8 text-text-muted mb-2" />
            <p className="text-sm text-text-muted">Bắt đầu cuộc trò chuyện!</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.senderId === myUserId ||
            (myRole === "Seller" && m.senderRole === "Seller") ||
            (myRole === "Buyer" && m.senderRole === "Buyer");
          const showName = i === 0 || messages[i - 1].senderRole !== m.senderRole;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {showName && !isMe && (
                <p className="text-[11px] text-text-dim mb-0.5 px-1">{m.senderName}</p>
              )}
              <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-brand text-white rounded-br-sm" : "bg-bg-elev text-text rounded-bl-sm border border-border"}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
              </div>
              <p className="text-[11px] text-text-dim mt-0.5 px-1">{fmtTime(m.createdAt)}</p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="border-t border-border px-4 py-3 flex gap-3 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e as unknown as React.FormEvent); } }}
          placeholder="Nhập tin nhắn... (Enter để gửi)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-bg-elev px-3 py-2.5 text-sm text-text outline-none focus:border-brand min-h-[44px] max-h-32 overflow-y-auto"
          style={{ height: "auto" }}
        />
        <button type="submit" disabled={!input.trim() || sending}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white hover:bg-brand/90 disabled:opacity-50">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

// ── ChatView (main) ───────────────────────────────────────────────────────────
export function ChatView({
  token, userId, myRole,
  listUrl, getUrl, sendUrl, startUrl,
  initSellerUsername,
}: {
  token: string | null;
  userId: string;
  myRole: "Buyer" | "Seller";
  listUrl: string;       // GET conversations
  getUrl: (id: string) => string;   // GET messages
  sendUrl: (id: string) => string;  // POST message
  startUrl?: string;     // POST start conversation (buyer only)
  initSellerUsername?: string;      // auto-open conversation with this seller
}) {
  const [convs, setConvs] = useState<ApiConversation[]>([]);
  const [active, setActive] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadConvs() {
    if (!token) return;
    try {
      const data = await apiFetch<ApiConversation[]>(listUrl, { token });
      setConvs(data);
      return data;
    } catch { return []; }
  }

  async function openConv(conv: ApiConversation) {
    setActive(conv);
    setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    setLoadingMsgs(true);
    try {
      const msgs = await apiFetch<ApiChatMessage[]>(getUrl(conv.id), { token });
      setMessages(msgs);
    } finally { setLoadingMsgs(false); }
  }

  async function startConversation(sellerUsername: string) {
    if (!startUrl || !token) return;
    const conv = await apiFetch<ApiConversation>(startUrl, {
      token, method: "POST", body: JSON.stringify({ sellerUsername }),
    });
    setConvs(cs => cs.some(c => c.id === conv.id) ? cs : [conv, ...cs]);
    openConv(conv);
  }

  async function sendMessage(body: string) {
    if (!active || !token) return;
    setSending(true);
    try {
      const msg = await apiFetch<ApiChatMessage>(sendUrl(active.id), {
        token, method: "POST", body: JSON.stringify({ body }),
      });
      setMessages(ms => [...ms, msg]);
      setConvs(cs => cs.map(c => c.id === active.id
        ? { ...c, lastMessagePreview: body.length > 40 ? body.slice(0, 40) + "…" : body, lastMessageAt: msg.createdAt }
        : c));
    } finally { setSending(false); }
  }

  // Poll for new messages every 8 seconds when a conversation is open
  useEffect(() => {
    if (!active || !token) return;
    pollRef.current = setInterval(async () => {
      try {
        const msgs = await apiFetch<ApiChatMessage[]>(getUrl(active.id), { token });
        setMessages(msgs);
        const convData = await apiFetch<ApiConversation[]>(listUrl, { token });
        setConvs(convData);
      } catch { /* ignore polling errors */ }
    }, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadConvs().then(async (data) => {
      if (initSellerUsername && startUrl) {
        const existing = (data as ApiConversation[] | undefined)?.find(c => c.otherPartyUsername === initSellerUsername);
        if (existing) { openConv(existing); }
        else { await startConversation(initSellerUsername); }
      }
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  function handleSelect(c: ApiConversation) {
    openConv(c);
    setMobileView("thread");
  }

  return (
    <div className="grid h-[calc(100vh-10rem)] max-h-[700px] overflow-hidden rounded-2xl border border-border bg-bg-card lg:grid-cols-[320px_1fr]">
      {/* Conversation list - hidden on mobile when thread is open */}
      <div className={`${mobileView === "thread" ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
        <ConvList convs={convs} activeId={active?.id ?? null} onSelect={handleSelect} myRole={myRole} />
      </div>

      {/* Thread - hidden on mobile when list is shown */}
      <div className={`${mobileView === "list" ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
        {!active ? (
          <div className="grid flex-1 place-items-center text-center px-6">
            <div>
              <MessageSquare className="mx-auto size-12 text-text-muted mb-3" />
              <p className="text-sm font-semibold text-text">Chọn cuộc trò chuyện</p>
              <p className="text-xs text-text-muted mt-1">hoặc bắt đầu nhắn tin với người bán</p>
            </div>
          </div>
        ) : loadingMsgs ? (
          <div className="grid flex-1 place-items-center">
            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : (
          <MessageThread
            conv={active}
            messages={messages}
            myUserId={userId}
            myRole={myRole}
            sending={sending}
            onSend={sendMessage}
            onBack={() => setMobileView("list")}
          />
        )}
      </div>
    </div>
  );
}
