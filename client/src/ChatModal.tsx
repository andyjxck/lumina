import React, { useState, useEffect, useRef } from 'react';
import { useAuth, supabase } from './AuthContext';
import { encryptMessage, decryptMessage } from './crypto';
import type { OtherUser } from './ProfileSidebar';

interface ChatModalProps {
  friendshipId: string;
  otherUser: OtherUser;
  onClose: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  content_enc: string;
  iv: string;
  read_at: string | null;
  created_at: string;
  decrypted?: string;
}

function isOnline(last_seen_at?: string) {
  if (!last_seen_at) return false;
  return Date.now() - new Date(last_seen_at).getTime() < 3 * 60 * 1000;
}

function tAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChatModal({ friendshipId, otherUser, onClose }: ChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | undefined>(otherUser.last_seen_at);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMessages();

    // Realtime subscription for new messages
    const sub = supabase
      .channel(`chat-${friendshipId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${friendshipId}` },
        async (payload: any) => {
          const msg = payload.new as Message;
          const dec = await decryptMessage(msg.content_enc, msg.iv, user.id, otherUser.id);
          setMessages(prev => [...prev, { ...msg, decrypted: dec }]);
          // Mark as read if from other
          if (msg.sender_id !== user.id) {
            supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
          }
          setOtherTyping(false);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${friendshipId}` },
        (payload: any) => {
          // Update read receipts in place
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m));
        })
      .subscribe();

    // Poll other user's last_seen to detect typing and live online status
    const typingPoll = setInterval(async () => {
      const { data } = await supabase
        .from('ac_users')
        .select('last_seen_at')
        .eq('id', otherUser.id)
        .single();
      if (data) {
        setOtherLastSeen(data.last_seen_at);
        const lastSeen = new Date(data.last_seen_at).getTime();
        const isTypingNow = Date.now() - lastSeen < 8000;
        setOtherTyping(isTypingNow && isOnline(data.last_seen_at));
      }
    }, 3000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(typingPoll);
    };
  }, [friendshipId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', friendshipId)
      .order('created_at', { ascending: true });
    if (!data) return;

    // Decrypt all
    const decrypted = await Promise.all(
      data.map(async (m: Message) => ({
        ...m,
        decrypted: await decryptMessage(m.content_enc, m.iv, user.id, otherUser.id),
      }))
    );
    setMessages(decrypted);

    // Mark unread messages as read
    const unread = data.filter((m: Message) => m.sender_id !== user.id && !m.read_at).map((m: Message) => m.id);
    if (unread.length) {
      supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    }
  };

  const handleTyping = () => {
    if (!user) return;
    // Update last_seen_at as a typing indicator proxy
    supabase.from('ac_users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 3000);
  };

  const handleSend = async () => {
    if (!user || !input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    const { content_enc, iv } = await encryptMessage(text, user.id, otherUser.id);
    await supabase.from('messages').insert({
      conversation_id: friendshipId,
      sender_id: user.id,
      receiver_id: otherUser.id,
      content_enc,
      iv,
    });
    setSending(false);
  };

  const handleReportMessage = async (msgId: string) => {
    if (!user || !reportReason.trim()) return;
    // Flag this message and the 4 before it
    const idx = messages.findIndex(m => m.id === msgId);
    const toFlag = messages.slice(Math.max(0, idx - 4), idx + 1).map(m => m.id);
    await supabase.from('messages').update({ report_flagged: true, report_reason: reportReason, report_by: user.id }).in('id', toFlag);
    setReportOpen(null);
    setReportReason('');
  };

  const handleBlockFromChat = async () => {
    if (!user) return;
    const { data: f } = await supabase.from('friendships').select('*').eq('id', friendshipId).single();
    if (!f) return;
    const isA = f.user_a_id === user.id;
    await supabase.from('friendships').update({ status: isA ? 'blocked_by_a' : 'blocked_by_b' }).eq('id', friendshipId);
    onClose();
  };

  const handleReportChat = async () => {
    if (!user || !reportReason.trim()) return;
    await supabase.from('user_reports').insert({ reported_id: otherUser.id, reporter_id: user.id, reason: reportReason });
    setActionsOpen(false);
    setReportReason('');
  };

  const online = isOnline(otherLastSeen);

  return (
    <div className="chat-modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('chat-modal-overlay')) onClose(); }}>
      <div className="chat-modal">
        {/* Header */}
        <div className="chat-header">
          <button className="chat-close" onClick={onClose}>←</button>
          <div className="chat-header-info">
            <div className={`psb-online-dot ${online ? 'online' : 'offline'}`} style={{ flexShrink: 0 }} />
            <span className="chat-header-name">{otherUser.username || `#${otherUser.user_number}`}</span>
            <span className="chat-header-status">{online ? 'Online' : 'Offline'}</span>
          </div>
          <button className="chat-actions-btn" onClick={() => setActionsOpen(o => !o)}>⋯</button>
        </div>

        {/* Actions dropdown */}
        {actionsOpen && (
          <div className="chat-actions-menu">
            <button className="chat-action-item" onClick={handleBlockFromChat}>🚫 Block user</button>
            <div className="chat-action-item report-row">
              <input className="chat-report-input" placeholder="Report reason…" value={reportReason} onChange={e => setReportReason(e.target.value)} />
              <button className="chat-action-btn-sm" disabled={!reportReason.trim()} onClick={handleReportChat}>Report Chat</button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {messages.map(m => {
            const isMine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}>
                <div className="chat-bubble" onContextMenu={e => { e.preventDefault(); setReportOpen(m.id); }}>
                  {m.decrypted || '[encrypted]'}
                </div>
                <div className="chat-meta">
                  {tAgo(m.created_at)}
                  {isMine && m.read_at && <span className="chat-read-tick" title={`Read ${tAgo(m.read_at)}`}>✓✓</span>}
                  {isMine && !m.read_at && <span className="chat-sent-tick">✓</span>}
                </div>
                {reportOpen === m.id && (
                  <div className="chat-report-bubble">
                    <input className="chat-report-input" placeholder="Reason…" value={reportReason} onChange={e => setReportReason(e.target.value)} />
                    <button className="chat-action-btn-sm" disabled={!reportReason.trim()} onClick={() => handleReportMessage(m.id)}>Report</button>
                    <button className="chat-action-btn-sm" onClick={() => setReportOpen(null)}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
          {otherTyping && (
            <div className="chat-bubble-wrap theirs">
              <div className="chat-bubble typing-indicator"><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Message…"
            value={input}
            onChange={e => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={sending}
          />
          <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
