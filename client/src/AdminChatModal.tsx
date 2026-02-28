import React, { useState, useEffect, useRef } from 'react';
import { useAuth, supabase } from './AuthContext';

interface AdminChatModalProps {
  ticketId: string;
  ticketCategory: string;
  otherLabel: string;
  onClose: () => void;
}

interface AdminMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
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

export default function AdminChatModal({ ticketId, ticketCategory, otherLabel, onClose }: AdminChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadMessages();

    const sub = supabase
      .channel(`admin_chat:${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'admin_messages',
        filter: `report_id=eq.${ticketId}`,
      }, () => { loadMessages(); })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [ticketId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('admin_messages')
      .select('id,sender_id,content,created_at')
      .eq('report_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSend = async () => {
    if (!user || !input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    await supabase.from('admin_messages').insert({
      report_id: ticketId,
      sender_id: user.id,
      content: text,
    });
    setSending(false);
  };

  return (
    <div className="chat-modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('chat-modal-overlay')) onClose(); }}>
      <div className="chat-modal">
        <div className="chat-header">
          <button className="chat-close" onClick={onClose}>←</button>
          <div className="chat-header-info">
            <span className="chat-header-name">{ticketCategory}</span>
            <span className="chat-header-status">{otherLabel}</span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map(m => {
            const isMine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}>
                <div className="chat-bubble">{m.content}</div>
                <div className="chat-meta">{tAgo(m.created_at)}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Message…"
            value={input}
            maxLength={500}
            onChange={e => setInput(e.target.value)}
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
