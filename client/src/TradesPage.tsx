import React, { useState, useEffect } from 'react';
import { useAuth, supabase } from './AuthContext';
import { VILLAGERS_DATA, SPECIES_ICONS, getDefaultVillagerData } from './villagerData.js';
import { encryptMessage as aesEncrypt, decryptMessage as aesDecrypt } from './crypto';
import TradesSidebar from './TradesSidebar';
import MobileNav from './MobileNav';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

interface TradesPageProps {
  onBack: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

interface TradeRequest {
  id: string;
  requester_id: string;
  acceptor_id?: string;
  villager_name: string;
  offer_text: string;
  status: 'open' | 'ongoing' | 'completed' | 'cancelled';
  trade_step: number;
  plot_available: boolean;
  dodo_code: string;
  completed_at?: string;
  reported: boolean;
  report_reason?: string;
  created_at: string;
  requester_number?: number;
  requester_username?: string;
  acceptor_number?: number;
  acceptor_username?: string;
}

const STEPS_TRADER = [
  { step: 1, label: 'Trade Accepted', desc: 'The trade has been accepted. Get your villager ready to box!' },
  { step: 2, label: 'Villager in Box', desc: 'Move your villager into a box, then wait for the tradee to confirm they have an available plot.' },
  { step: 3, label: 'Gates Open', desc: 'Enter your Dodo code below and open your island gates for the tradee.' },
  { step: 4, label: 'Complete', desc: 'Mark the trade as done once the villager has moved to their new island.' },
];
const STEPS_TRADEE = [
  { step: 1, label: 'Trade Accepted', desc: 'The trade has been accepted. Make sure you have an available plot!' },
  { step: 2, label: 'Villager in Box', desc: "The trader is boxing the villager. Confirm below if you have an available plot." },
  { step: 3, label: 'Visit Island', desc: "The trader's gates are open! Use the Dodo code to visit, find the villager, talk to them, wait for the move-in offer, then take them." },
  { step: 4, label: 'Done!', desc: 'The villager should be moving to your island soon. The trader will mark the trade complete.' },
];

function tAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TradesPage({ onBack, onNavigate, currentPage }: TradesPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'incoming' | 'my' | 'ongoing' | 'history'>('incoming');
  const [incoming, setIncoming] = useState<TradeRequest[]>([]);
  const [myRequests, setMyRequests] = useState<TradeRequest[]>([]);
  const [ongoingTrades, setOngoingTrades] = useState<TradeRequest[]>([]);
  const [historyTrades, setHistoryTrades] = useState<TradeRequest[]>([]);
  const [filteredList, setFilteredList] = useState<TradeRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dodoInputs, setDodoInputs] = useState<Record<string, string>>({});
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reportInputs, setReportInputs] = useState<Record<string, string>>({});

  // Mobile nav filter state (mirrors TradesSidebar)
  const [mobVillagerFilter, setMobVillagerFilter] = useState('');
  const [mobAwaitingOnly, setMobAwaitingOnly] = useState(false);
  const [mobStatusFilter, setMobStatusFilter] = useState('all');

  const applyMobFilters = (vf = mobVillagerFilter, aw = mobAwaitingOnly, sf = mobStatusFilter) => {
    const list = tab === 'incoming' ? incoming : tab === 'my' ? myRequests : tab === 'ongoing' ? ongoingTrades : historyTrades;
    let filtered = [...list];
    if (vf) filtered = filtered.filter(t => t.villager_name.toLowerCase().includes(vf.toLowerCase()));
    if (aw && tab === 'ongoing') {
      filtered = filtered.filter(t => {
        if (!user) return false;
        const step = t.trade_step ?? 1;
        if (t.acceptor_id === user.id && (step === 1 || step === 3)) return true;
        if (t.requester_id === user.id && step === 2) return true;
        return false;
      });
    }
    if (sf !== 'all') filtered = filtered.filter(t => t.status === sf);
    setFilteredList(filtered.length === list.length ? null : filtered);
  };

  // Amiibo verification modal state
  const [showAmiiboModal, setShowAmiiboModal] = useState(false);
  const [amiiboModalVillager, setAmiiboModalVillager] = useState('');
  const [pendingTradeCompletion, setPendingTradeCompletion] = useState<TradeRequest | null>(null);

  const getVillagerData = (name: string) =>
    VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);
  const getIcon = (iconMap: any, key: string) => iconMap[key as keyof typeof iconMap] || '';

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadTrades();

    // Real-time subscription for trade updates
    const tradeSubscription = supabase
      .channel('trade_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'trade_requests'
        }, 
        (payload: any) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          const affectsUser = 
            newRecord?.requester_id === user.id || 
            newRecord?.acceptor_id === user.id ||
            oldRecord?.requester_id === user.id || 
            oldRecord?.acceptor_id === user.id;
          if (affectsUser) { loadTrades(); }
        }
      )
      .subscribe();

    return () => {
      tradeSubscription.unsubscribe();
    };
  }, [user]);

  const loadTrades = async () => {
    if (!user) return;
    setLoading(true);
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const ownedList = user.owned.length ? user.owned : ['__none__'];

    const [incomingRes, myRes, ongoingRes, historyRes, ongoingReqRes] = await Promise.all([
      supabase
        .from('trade_requests')
        .select('*')
        .eq('status', 'open')
        .in('villager_name', ownedList)
        .neq('requester_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('trade_requests')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('trade_requests')
        .select('*')
        .eq('status', 'ongoing')
        .or(`requester_id.eq.${user.id},acceptor_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('trade_requests')
        .select('*')
        .eq('status', 'completed')
        .or(`requester_id.eq.${user.id},acceptor_id.eq.${user.id}`)
        .gte('completed_at', cutoff)
        .order('completed_at', { ascending: false }),
      supabase
        .from('trade_requests')
        .select('*')
        .eq('status', 'ongoing')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false }),
    ]);


    // Merge both ongoing queries, deduplicate by id
    const ongoingMerged = Object.values(
      [...(ongoingRes.data || []), ...(ongoingReqRes.data || [])].reduce((acc: any, t: any) => {
        acc[t.id] = t; return acc;
      }, {})
    ) as any[];

    // Collect all unique user IDs to batch-fetch usernames
    const allTrades = [
      ...(incomingRes.data || []),
      ...(myRes.data || []),
      ...ongoingMerged,
      ...(historyRes.data || []),
    ];
    const userIds = Array.from(new Set(
      allTrades.flatMap((t: any) => [t.requester_id, t.acceptor_id, t.report_by].filter(Boolean))
    ));
    let userMap: Record<string, { user_number: number; username?: string }> = {};
    if (userIds.length > 0) {
      const { data: uData } = await supabase
        .from('ac_users')
        .select('id, user_number, username')
        .in('id', userIds);
      (uData || []).forEach((u: any) => { userMap[u.id] = u; });
    }

    const mapU = (r: any): TradeRequest => ({
      ...r,
      requester_number: userMap[r.requester_id]?.user_number,
      requester_username: userMap[r.requester_id]?.username,
      acceptor_number: r.acceptor_id ? userMap[r.acceptor_id]?.user_number : undefined,
      acceptor_username: r.acceptor_id ? userMap[r.acceptor_id]?.username : undefined,
    });

    
    setIncoming((incomingRes.data || []).map(mapU));
    setMyRequests(myRes.data || []);
    setOngoingTrades(ongoingMerged.map(mapU));
    setHistoryTrades((historyRes.data || []).map(mapU));
    setLoading(false);
  };

  const handleAccept = async (trade: TradeRequest) => {
    if (trade.requester_id === user?.id) return; // prevent self-acceptance
    setAccepting(trade.id);
    await supabase
      .from('trade_requests')
      .update({ status: 'ongoing', acceptor_id: user?.id, trade_step: 1 })
      .eq('id', trade.id);
    await loadTrades();
    setAccepting(null);
    setTab('ongoing');
  };

  const handleStepUpdate = async (trade: TradeRequest, patch: Record<string, any>) => {
    setBusy(trade.id);
    await supabase
      .from('trade_requests')
      .update(patch)
      .eq('id', trade.id);
    
    await loadTrades();
    setBusy(null);
  };

  const handleComplete = async (trade: TradeRequest) => {
    setBusy(trade.id);
    
    // Mark trade as completed
    await supabase.from('trade_requests').update({
      status: 'completed', trade_step: 4, completed_at: new Date().toISOString(),
    }).eq('id', trade.id);
    
    // Handle amiibo card verification
    const isTrader = trade.acceptor_id === user?.id || (!trade.acceptor_id && user?.owned?.includes(trade.villager_name));
    
    if (isTrader) {
      // Trader: Show custom modal to ask if they have the amiibo card
      setAmiiboModalVillager(trade.villager_name);
      setPendingTradeCompletion(trade);
      setShowAmiiboModal(true);
    } else {
      // Tradee: Automatically mark as verified since they received it through trade
      const updatedVerified = [...(user?.verified_cards || []), trade.villager_name];
      
      await supabase.from('ac_users').update({
        owned: [...(user?.owned || []), trade.villager_name],
        verified_cards: updatedVerified
      }).eq('id', user?.id);
      
      // Update local user state to reflect the change immediately
      if (user) {
        user.owned = [...(user?.owned || []), trade.villager_name];
        user.verified_cards = updatedVerified;
        localStorage.setItem('ac_user', JSON.stringify(user));
      }
      
      await loadTrades();
      setBusy(null);
      setTab('history');
    }
  };

  const handleAmiiboVerification = async (hasAmiibo: boolean) => {
    if (!pendingTradeCompletion || !user) return;
    
    const trade = pendingTradeCompletion;
    
    // Determine who is the trader and who is the tradee
    const isTrader = trade.acceptor_id === user?.id || (!trade.acceptor_id && user?.owned?.includes(trade.villager_name));
    const otherUserId = isTrader ? trade.requester_id : trade.acceptor_id;
    
    if (hasAmiibo) {
      // Trader: Mark as verified
      const updatedOwned = [...(user?.owned || []), trade.villager_name];
      const updatedVerified = [...(user?.verified_cards || []), trade.villager_name];
      
      await supabase.from('ac_users').update({
        owned: updatedOwned,
        verified_cards: updatedVerified
      }).eq('id', user?.id);
      
      // Update local user state to reflect the change immediately
      if (user) {
        user.owned = updatedOwned;
        user.verified_cards = updatedVerified;
        localStorage.setItem('ac_user', JSON.stringify(user));
      }
    } else {
      // Trader: Remove from owned if they don't have the amiibo
      const currentOwned = user?.owned || [];
      const updatedOwned = currentOwned.filter(villager => villager !== trade.villager_name);
      
      await supabase.from('ac_users').update({
        owned: updatedOwned
      }).eq('id', user?.id);
      
      // Update local user state to reflect the change immediately
      if (user) {
        user.owned = updatedOwned;
        localStorage.setItem('ac_user', JSON.stringify(user));
      }
    }
    
    // Add villager to the other user's owned list (they received the villager)
    if (otherUserId) {
      const { data: otherUserData } = await supabase
        .from('ac_users')
        .select('owned')
        .eq('id', otherUserId)
        .single();
      
      if (otherUserData) {
        const otherUserOwned = otherUserData.owned || [];
        if (!otherUserOwned.includes(trade.villager_name)) {
          await supabase.from('ac_users').update({
            owned: [...otherUserOwned, trade.villager_name]
          }).eq('id', otherUserId);
        }
      }
    }
    
    // Clean up modal state
    setShowAmiiboModal(false);
    setAmiiboModalVillager('');
    setPendingTradeCompletion(null);
    
    await loadTrades();
    setBusy(null);
    setTab('history');
  };

  const handleDeleteRequest = async (trade: TradeRequest) => {
    setBusy(trade.id);
    await supabase.from('trade_requests').delete().eq('id', trade.id);
    await loadTrades();
    setBusy(null);
  };

  const handleCancel = async (trade: TradeRequest) => {
    setBusy(trade.id);
    // Reset back to open so other users can accept it
    await supabase.from('trade_requests').update({
      status: 'open',
      acceptor_id: null,
      trade_step: 1,
      plot_available: false,
      dodo_code: '',
    }).eq('id', trade.id);
    await loadTrades();
    setBusy(null);
    setTab('incoming');
  };

  const handleExpire = async (trade: TradeRequest) => {
    setBusy(trade.id);
    // Reset back to open so other users can accept it
    await supabase.from('trade_requests').update({
      status: 'open',
      acceptor_id: null,
      trade_step: 1,
      plot_available: false,
      dodo_code: '',
    }).eq('id', trade.id);
    await loadTrades();
    setBusy(null);
    setTab('incoming');
  };

  const handleReport = async (trade: TradeRequest) => {
    const reason = (reportInputs[trade.id] || '').trim();
    if (!reason) return;
    setBusy(trade.id);
    await supabase.from('trade_requests').update({
      reported: true, report_reason: reason, report_by: user?.id,
    }).eq('id', trade.id);
    setReportOpen(null);
    await loadTrades();
    setBusy(null);
  };

  const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
    open:      { label: 'Open',    color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
    pending:   { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    completed: { label: 'Done',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    cancelled: { label: 'Cancelled', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
  };

  const TradeCard = ({ trade, isIncoming }: { trade: TradeRequest; isIncoming: boolean }) => {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [chatMessages, setChatMessages] = useState<Array<{id: string, sender_id: string, content: string, created_at: string}>>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const data = getVillagerData(trade.villager_name);
    const icon = getIcon(SPECIES_ICONS, data.species) || '🏘️';
    const sm = statusMeta[trade.status] || statusMeta.open;
    const timeAgo = (() => {
      const diff = Date.now() - new Date(trade.created_at).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    })();

    // Determine role and other party
    const isTrader = isIncoming; // Incoming = you own the villager = Trader
    const isTradee = !isIncoming; // Outgoing = you requested = Tradee
    const otherUserId = isIncoming ? trade.requester_id : (trade.acceptor_id || null);
    const otherUser = isIncoming 
      ? `#${trade.requester_number}${trade.requester_username ? ' · ' + trade.requester_username : ''}`
      : 'Waiting for owner to accept';

    // Create conversation ID (use trade ID for consistency)
    const conversationId = trade.id; // Use the trade ID as conversation ID

    // Progress steps for open trades
    const progressSteps = [
      { step: 1, label: 'Request Sent', completed: true },
      { step: 2, label: 'Waiting for Accept', completed: trade.status === 'ongoing' },
      { step: 3, label: 'Trade Ready', completed: (trade.trade_step ?? 1) >= 3 },
    ];

    // Load chat messages when expanded
    useEffect(() => {
      if (expanded && conversationId && user) {
        loadChatMessages();
        
        // Subscribe to real-time messages
        const messageSubscription = supabase
          .channel(`chat_${conversationId}`)
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`
            },
            () => { loadChatMessages(); }
          )
          .subscribe();

        return () => {
          messageSubscription.unsubscribe();
        };
      }
    }, [expanded, conversationId, user]);

    const loadChatMessages = async () => {
      if (!conversationId || !user || !otherUserId) return;
      setLoadingMessages(true);
      const { data } = await supabase
        .from('messages')
        .select('id,sender_id,content_enc,iv,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (data) {
        const msgs = await Promise.all(data.map(async (msg: any) => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: await aesDecrypt(msg.content_enc, msg.iv, user.id, otherUserId),
          created_at: msg.created_at,
        })));
        setChatMessages(msgs);
      }
      setLoadingMessages(false);
    };

    const sendMessage = async () => {
      if (!chatMessage.trim() || !conversationId || !user || !otherUserId) return;
      const text = chatMessage.trim();
      setChatMessage('');
      const { content_enc, iv } = await aesEncrypt(text, user.id, otherUserId);
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: otherUserId,
        content_enc,
        iv,
      });
    };

    // Simple incoming trades - no expand, just accept/reject
    if (isIncoming && trade.status === 'open') {
      return (
        <div className={`tr-card incoming`}>
          {/* Left accent stripe */}
          <div className="tr-card-stripe" style={{ background: data.gender === 'female' ? '#f000c8' : '#3c82f6' }} />

          {/* Villager icon */}
          <div className={`tr-card-icon ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
            <span className="villager-icon-emoji">{icon}</span>
          </div>

          {/* Main info */}
          <div className="tr-card-body">
            <div className="tr-card-row1">
              <span className="tr-card-name">{trade.villager_name}</span>
              <span className="tr-card-status-pill" style={{ color: sm.color, background: sm.bg }}>
                {sm.label}
              </span>
            </div>

            {/* Other party info */}
            <div className="tr-card-role-info">
              <span className="tr-card-other-user">
                From: #{trade.requester_number}{trade.requester_username ? ` · ${trade.requester_username}` : ''}
              </span>
            </div>

            {/* Offer text */}
            {trade.offer_text ? (
              <blockquote className="tr-card-offer">"{trade.offer_text}"</blockquote>
            ) : (
              <span className="tr-card-no-offer">No offer message</span>
            )}

            <span className="tr-card-time">{timeAgo}</span>
          </div>

          {/* Accept/Reject buttons */}
          <div className="tr-incoming-actions">
            <button
              className="tr-accept-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAccept(trade);
              }}
              disabled={accepting === trade.id}
            >
              {accepting === trade.id ? (
                <span className="tr-accept-loading">…</span>
              ) : (
                <>
                  <span className="tr-accept-icon">✓</span>
                  <span>Accept</span>
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    // Full expandable cards for ongoing and outgoing trades
    return (
      <div className={`tr-card ${isIncoming ? 'incoming' : 'outgoing'} ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
        {/* Left accent stripe */}
        <div className="tr-card-stripe" style={{ background: data.gender === 'female' ? '#f000c8' : '#3c82f6' }} />

        {/* Villager icon */}
        <div className={`tr-card-icon ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
          <span className="villager-icon-emoji">{icon}</span>
        </div>

        {/* Main info */}
        <div className="tr-card-body">
          <div className="tr-card-row1">
            <span className="tr-card-name">{trade.villager_name}</span>
            <span className="tr-card-status-pill" style={{ color: sm.color, background: sm.bg }}>
              {sm.label}
            </span>
          </div>

          {/* Role and other party */}
          <div className="tr-card-role-info">
            <span className="tr-card-role">
              {isTrader ? '🏡 Trader' : '🎒 Tradee'}
            </span>
            <span className="tr-card-other-user">
              {otherUser}
            </span>
          </div>

          {/* Progress bar - only for ongoing trades */}
          {trade.status === 'ongoing' && (
            <div className="tr-card-progress">
              <div className="tr-progress-bar">
                {progressSteps.map((step, index) => (
                  <div key={step.step} className={`tr-progress-step ${step.completed ? 'completed' : ''}`}>
                    <div className="tr-progress-dot" />
                    <span className="tr-progress-label">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offer text */}
          {trade.offer_text ? (
            <blockquote className="tr-card-offer">"{trade.offer_text}"</blockquote>
          ) : (
            <span className="tr-card-no-offer">No offer message</span>
          )}

          <div className="tr-card-footer">
            <span className="tr-card-time">{timeAgo}</span>
            <span className="tr-card-expand-hint">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {/* Expanded content - only for ongoing and outgoing trades */}
        {expanded && (
          <div className="tr-card-expanded">
            <div className="tr-card-expanded-content">
              <div className="tr-expanded-section">
                <h4>Trade Details</h4>
                <p><strong>Your Role:</strong> {isTrader ? 'You own this villager and are trading it' : 'You are requesting this villager'}</p>
                <p><strong>Status:</strong> {sm.label}</p>
                <p><strong>Offer:</strong> {trade.offer_text || 'No offer specified'}</p>
                <p><strong>Requested:</strong> {timeAgo}</p>
              </div>
              
              {/* Chat section - only for ongoing trades */}
              {trade.status === 'ongoing' && (
                <div className="tr-expanded-section">
                  <h4>Trade Chat</h4>
                  <div className="tr-chat-container">
                    <div className="tr-chat-messages">
                      {loadingMessages ? (
                        <div className="tr-chat-loading">
                          <p>Loading messages...</p>
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="tr-chat-empty">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        chatMessages.map(msg => (
                          <div key={msg.id} className={`tr-chat-message ${msg.sender_id === user?.id ? 'sent' : 'received'}`}>
                            <span className="tr-chat-text">{msg.content}</span>
                            <span className="tr-chat-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="tr-chat-input-container">
                      <input
                        type="text"
                        className="tr-chat-input"
                        placeholder="Type a message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && chatMessage.trim()) {
                            sendMessage();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button 
                        className="tr-chat-send-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendMessage();
                        }}
                        disabled={!chatMessage.trim()}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Danger zone - cancel button far away and clearly marked */}
              {!isIncoming && trade.status === 'open' && (
                <div className="tr-expanded-section tr-danger-zone">
                  <h4>Danger Zone</h4>
                  <p className="tr-danger-warning">⚠️ This will cancel your trade request permanently</p>
                  <button
                    className="tr-cancel-btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRequest(trade);
                    }}
                    disabled={busy === trade.id}
                  >
                    {busy === trade.id ? '…' : '✕ Cancel Trade Request'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabCounts: Record<string, number> = {
    incoming: incoming.length,
    my: myRequests.length,
    ongoing: ongoingTrades.length,
    history: historyTrades.length,
  };
  const tabLabels: Record<string, string> = {
    incoming: 'Incoming',
    my: 'Outgoing',
    ongoing: 'Ongoing',
    history: 'History',
  };

  const renderContent = (list: TradeRequest[]) => {
    if (!user) return <div className="tr-empty"><div className="tr-empty-icon">🔒</div><p>Log in to see trade requests</p></div>;
    if (loading) return <div className="tr-empty"><p>Loading…</p></div>;

    if (tab === 'incoming') {
      if (!list.length) return (
        <div className="tr-empty">
          <div className="tr-empty-icon">📭</div>
          <p>No incoming requests yet</p>
          <span className="tr-empty-hint">When someone wants a villager you own, their request appears here</span>
        </div>
      );
      return <div className="tr-list">{list.map(t => <TradeCard key={t.id} trade={t} isIncoming={true} />)}</div>;
    }

    if (tab === 'my') {
      if (!list.length) return (
        <div className="tr-empty">
          <div className="tr-empty-icon">📤</div>
          <p>You haven't sent any trade requests yet</p>
          <span className="tr-empty-hint">Add villagers to your cart and request a trade</span>
        </div>
      );
      return <div className="tr-list">{list.map(t => <TradeCard key={t.id} trade={t} isIncoming={false} />)}</div>;
    }

    if (tab === 'ongoing') {
      if (!ongoingTrades.length) return (
        <div className="tr-empty">
          <div className="tr-empty-icon">🔄</div>
          <p>No ongoing trades</p>
          <span className="tr-empty-hint">Accept an incoming trade request to start a trade</span>
        </div>
      );
      return <div className="tr-list">{list.map((t: TradeRequest) => <OngoingCard key={t.id} trade={t} user={user} busy={busy} dodoInputs={dodoInputs} setDodoInputs={setDodoInputs} handleStepUpdate={handleStepUpdate} handleComplete={handleComplete} handleCancel={handleCancel} handleExpire={handleExpire} />)}</div>;
    }

    if (tab === 'history') {
      if (!historyTrades.length) return (
        <div className="tr-empty">
          <div className="tr-empty-icon">📜</div>
          <p>No trade history yet</p>
          <span className="tr-empty-hint">Completed trades appear here for 28 days</span>
        </div>
      );
      return <div className="tr-list">{list.map((t: TradeRequest) => <HistoryCard key={t.id} trade={t} user={user} busy={busy} setBusy={setBusy} reportOpen={reportOpen} setReportOpen={setReportOpen} reportInputs={reportInputs} setReportInputs={setReportInputs} handleReport={handleReport} />)}</div>;
    }

    return null;
  };

  // When tab changes, clear any active filter
  const handleTabChange = (t: 'incoming' | 'my' | 'ongoing' | 'history') => {
    setTab(t);
    setFilteredList(null);
  };

  const currentRaw = tab === 'incoming' ? incoming : tab === 'my' ? myRequests : tab === 'ongoing' ? ongoingTrades : historyTrades;
  const displayList = filteredList ?? currentRaw;
  const mobUniqueVillagers = Array.from(new Set(currentRaw.map((t: any) => t.villager_name))).sort() as string[];
  const mobActiveFilters = [mobVillagerFilter ? 1 : 0, mobAwaitingOnly ? 1 : 0, mobStatusFilter !== 'all' ? 1 : 0].reduce((a,b)=>a+b,0);

  const tradesExtraFilters = (
    <>
      <div className="mobnav-filter-section">
        <div className="mobnav-filter-label" style={{display:'flex',justifyContent:'space-between'}}>
          <span>Filters</span>
          {mobActiveFilters > 0 && <button style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:'11px',cursor:'pointer'}} onClick={()=>{setMobVillagerFilter('');setMobAwaitingOnly(false);setMobStatusFilter('all');setFilteredList(null);}}>Clear ({mobActiveFilters})</button>}
        </div>
      </div>

      {tab === 'ongoing' && (
        <div className="mobnav-filter-section">
          <div className="mobnav-filter-label">Quick</div>
          <div className="mobnav-filter-chips">
            <button className={`mobnav-filter-chip ${mobAwaitingOnly ? 'active' : ''}`} onClick={()=>{const n=!mobAwaitingOnly;setMobAwaitingOnly(n);applyMobFilters(mobVillagerFilter,n,mobStatusFilter);}}>⏳ Awaiting my action</button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="mobnav-filter-section">
          <div className="mobnav-filter-label">Status</div>
          <div className="mobnav-filter-chips">
            {(['all','completed','cancelled'] as const).map(s => (
              <button key={s} className={`mobnav-filter-chip ${mobStatusFilter===s?'active':''}`} onClick={()=>{setMobStatusFilter(s);applyMobFilters(mobVillagerFilter,mobAwaitingOnly,s);}}>{s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mobnav-filter-section">
        <div className="mobnav-filter-label">Villager</div>
        <input className="mobnav-search-input" placeholder="Search villager…" value={mobVillagerFilter} onChange={e=>{setMobVillagerFilter(e.target.value);applyMobFilters(e.target.value,mobAwaitingOnly,mobStatusFilter);}} style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'8px',padding:'8px 10px',color:'white',fontSize:'13px',marginBottom:'8px'}} />
        <div className="mobnav-filter-chips">
          {mobUniqueVillagers.slice(0,12).map(v=>(
            <button key={v} className={`mobnav-filter-chip ${mobVillagerFilter===v?'active':''}`} onClick={()=>{const nv=mobVillagerFilter===v?'':v;setMobVillagerFilter(nv);applyMobFilters(nv,mobAwaitingOnly,mobStatusFilter);}}>{v}</button>
          ))}
        </div>
      </div>

      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'4px'}}>
        {mobActiveFilters > 0 ? `${displayList.length} of ${currentRaw.length} shown` : `${currentRaw.length} total`}
      </div>
    </>
  );

  return (
    <>
    <MobileNav currentPage={currentPage} onNavigate={onNavigate} extraFilters={tradesExtraFilters} />
    <div className="trades-layout">
    <TradesSidebar
      tab={tab}
      incoming={incoming}
      myRequests={myRequests}
      ongoingTrades={ongoingTrades}
      historyTrades={historyTrades}
      onFilter={f => setFilteredList(f.length === currentRaw.length ? null : f)}
      onNavigate={onNavigate}
      currentPage={currentPage}
    />
    <div className="trades-page">
      <button className="page-back-btn" onClick={onBack}>←</button>

      <div className="tr-header">
        <div className="tr-header-left">
          <h1 className="tr-title">Trades</h1>
          <p className="tr-sub">
            {user
              ? `${user.owned.length} owned villager${user.owned.length !== 1 ? 's' : ''}`
              : 'Log in to see trade requests'}
          </p>
        </div>
        {incoming.length > 0 && <div className="tr-alert-badge">{incoming.length} new</div>}
      </div>

      <div className="tr-tabs">
        {(['incoming', 'my', 'ongoing', 'history'] as const).map(t => (
          <button key={t} className={`tr-tab ${tab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>
            <span className={`tr-tab-dot ${t}`} />
            {tabLabels[t]}
            {tabCounts[t] > 0 && <span className="tr-tab-count">{tabCounts[t]}</span>}
          </button>
        ))}
      </div>

      {renderContent(displayList)}
    </div>
    </div>

    {/* Amiibo Verification Modal */}
    {showAmiiboModal && (
      <div className="modal-overlay">
        <div className="modal-content amiibo-verification-modal">
          <div className="modal-header">
            <h3>🎴 Amiibo Card Verification</h3>
          </div>
          
          <div className="modal-body">
            <div className="amiibo-question">
              <p>Do you have the physical amiibo card for:</p>
              <div className="amiibo-villager-display">
                <div className="amiibo-villager-icon">🎴</div>
                <span className="amiibo-villager-name">{amiiboModalVillager}</span>
              </div>
            </div>
            
            <div className="amiibo-options">
              <div className="amiibo-option">
                <button 
                  className="amiibo-option-btn yes"
                  onClick={() => handleAmiiboVerification(true)}
                >
                  <span className="option-icon">✅</span>
                  <span className="option-text">Yes, I have the amiibo card</span>
                </button>
              </div>
              
              <div className="amiibo-option">
                <button 
                  className="amiibo-option-btn no"
                  onClick={() => handleAmiiboVerification(false)}
                >
                  <span className="option-icon">❌</span>
                  <span className="option-text">No, I don't have the amiibo card</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ---- Ongoing trade progress card (defined outside to avoid hook issues) ---- */
function OngoingCard({ trade, user, busy, dodoInputs, setDodoInputs, handleStepUpdate, handleComplete, handleCancel, handleExpire, setShowAmiiboModal, setAmiiboModalVillager, setPendingTradeCompletion }: any) {
  // acceptor = owner who accepted = Trader; requester = person who wants the villager = Tradee
  // Fall back to owned list if acceptor_id is null (e.g. accepted before migration)
  const isTraderByOwned = !trade.acceptor_id && user?.owned?.includes(trade.villager_name);
  const isTrader = trade.acceptor_id === user?.id || isTraderByOwned;
  const isTradee = trade.requester_id === user?.id && !isTrader;
  const currentStep = trade.trade_step || 1;
  const data = VILLAGERS_DATA[trade.villager_name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(trade.villager_name);
  const icon = SPECIES_ICONS[data.species as keyof typeof SPECIES_ICONS] || '🏘️';
  const otherUser = isTrader
    ? (trade.requester_number ? `#${trade.requester_number}${trade.requester_username ? ' · ' + trade.requester_username : ''}` : 'Tradee')
    : (trade.acceptor_number ? `#${trade.acceptor_number}${trade.acceptor_username ? ' · ' + trade.acceptor_username : ''}` : 'Trader');

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{id: string, sender_id: string, content: string, created_at: string}>>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Create conversation ID (use trade ID for consistency between both users)
  const otherUserId = isTrader ? trade.requester_id : trade.acceptor_id;
  const conversationId = trade.id; // Use the trade ID as conversation ID

  // Load chat messages
  useEffect(() => {
    if (showChat && conversationId && user) {
      loadChatMessages();
      
      // Subscribe to real-time messages
      const messageSubscription = supabase
        .channel(`chat_${conversationId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          () => { loadChatMessages(); }
        )
        .subscribe();

      return () => {
        messageSubscription.unsubscribe();
      };
    }
  }, [showChat, conversationId, user]);

  const loadChatMessages = async () => {
    if (!conversationId || !user || !otherUserId) return;
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('id,sender_id,content_enc,iv,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (data) {
      const msgs = await Promise.all(data.map(async (msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        content: await aesDecrypt(msg.content_enc, msg.iv, user.id, otherUserId),
        created_at: msg.created_at,
      })));
      setChatMessages(msgs);
    }
    setLoadingMessages(false);
  };

  const sendMessage = async () => {
    if (!chatMessage.trim() || !conversationId || !user || !otherUserId) return;
    const text = chatMessage.trim();
    setChatMessage('');
    const { content_enc, iv } = await aesEncrypt(text, user.id, otherUserId);
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: otherUserId,
      content_enc,
      iv,
    });
  };

  // Time tracking
  const acceptedAt = new Date(trade.updated_at || trade.created_at).getTime();
  const hoursElapsed = (Date.now() - acceptedAt) / 3600000;
  const step3StartedAt = currentStep >= 3 ? acceptedAt : Date.now(); // approximation
  const hoursInStep3 = currentStep === 3 ? (Date.now() - step3StartedAt) / 3600000 : 0;
  const canExpire = hoursElapsed >= 48;
  const tradeeCanComplete = currentStep === 3 && hoursInStep3 >= 24;

  // Progress bar steps (fixed 3 visible steps)
  const STEPS = [
    { step: 1, label: 'Accepted' },
    { step: 2, label: 'Plot & Dodo' },
    { step: 3, label: 'On Island' },
  ];

  const dodoVal = (dodoInputs[trade.id] || '').toUpperCase();

  return (
    <div className="tr-ongoing-card">
      <div className="tr-ongoing-header">
        <div className={`tr-card-icon ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`} style={{ width: 40, height: 40, fontSize: 20 }}>
          <span className="villager-icon-emoji">{icon}</span>
        </div>
        <div className="tr-ongoing-header-info">
          <span className="tr-card-name">{trade.villager_name}</span>
          <span className="tr-ongoing-role">{isTrader ? '🏡 You are the Trader' : '🎒 You are the Tradee'} · {otherUser}</span>
        </div>
        <span className="tr-card-status-pill" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.12)', marginLeft: 'auto' }}>
          Step {currentStep}/3
        </span>
      </div>

      {/* Progress bar */}
      <div className="tr-progress-bar-wrap">
        <div className="tr-progress-line-bg" />
        <div className="tr-progress-line-fill" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
        {STEPS.map((s) => (
          <div key={s.step} className={`tr-progress-step ${s.step < currentStep ? 'done' : s.step === currentStep ? 'active' : ''}`}>
            <div className="tr-progress-dot">{s.step < currentStep ? '✓' : s.step}</div>
            <div className="tr-progress-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Chat toggle */}
      <div className="tr-ongoing-chat-toggle">
        <button 
          className="tr-chat-toggle-btn"
          onClick={() => setShowChat(!showChat)}
        >
          💬 {showChat ? 'Hide Chat' : 'Show Chat'} {chatMessages.length > 0 && `(${chatMessages.length})`}
        </button>
      </div>

      {/* Chat section */}
      {showChat && (
        <div className="tr-ongoing-chat">
          <div className="tr-chat-container">
            <div className="tr-chat-messages">
              {loadingMessages ? (
                <div className="tr-chat-loading">
                  <p>Loading messages...</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="tr-chat-empty">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`tr-chat-message ${msg.sender_id === user?.id ? 'sent' : 'received'}`}>
                    <span className="tr-chat-text">{msg.content}</span>
                    <span className="tr-chat-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
            <div className="tr-chat-input-container">
              <input
                type="text"
                className="tr-chat-input"
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && chatMessage.trim()) {
                    sendMessage();
                  }
                }}
              />
              <button 
                className="tr-chat-send-btn"
                onClick={() => sendMessage()}
                disabled={!chatMessage.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 — Trader boxes villager */}
      {currentStep === 1 && (
        <div className="tr-ongoing-body">
          {isTrader && (
            <>
              <p className="tr-ongoing-desc">Box your villager in your campsite, then confirm below to let the tradee know they're ready.</p>
              <button className="tr-step-btn confirm" disabled={busy === trade.id}
                onClick={() => handleStepUpdate(trade, { trade_step: 2 })}>
                ✅ Villager is Boxed
              </button>
            </>
          )}
          {isTradee && (
            <p className="tr-ongoing-desc">⏳ Waiting for the trader to box their villager…</p>
          )}
          <button className="tr-step-btn cancel" disabled={busy === trade.id}
            onClick={() => handleCancel(trade)}>
            Cancel Trade
          </button>
        </div>
      )}

      {/* Step 2 — Tradee confirms plot, Trader enters Dodo code */}
      {currentStep === 2 && (
        <div className="tr-ongoing-body">
          {isTradee && (
            <>
              <p className="tr-ongoing-desc">Confirm you have an available plot for the villager.</p>
              {!trade.plot_available ? (
                <button className="tr-step-btn confirm" disabled={busy === trade.id}
                  onClick={() => handleStepUpdate(trade, { plot_available: true })}>
                  ✅ I have an available plot
                </button>
              ) : (
                <span className="tr-step-confirmed">✓ Plot confirmed — waiting for trader to open gates</span>
              )}
            </>
          )}
          {isTrader && (
            <>
              {!trade.plot_available ? (
                <p className="tr-ongoing-desc">⏳ Waiting for the tradee to confirm they have a plot available…</p>
              ) : (
                <>
                  <p className="tr-ongoing-desc">The tradee has a plot ready. Enter your Dodo code to open your gates.</p>
                  {!trade.dodo_code ? (
                    <div className="tr-dodo-row">
                      <input
                        className="tr-dodo-input"
                        placeholder="Dodo code (5 chars)"
                        maxLength={5}
                        value={dodoVal}
                        onChange={(e: any) => setDodoInputs((p: any) => ({ ...p, [trade.id]: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  ) : (
                    <span className="tr-step-confirmed">✓ Gates open — tradee has the Dodo code</span>
                  )}
                </>
              )}
            </>
          )}
          {isTrader && trade.plot_available && !trade.dodo_code && dodoVal.length >= 5 && (
            <button className="tr-step-btn proceed" disabled={busy === trade.id}
              onClick={() => handleStepUpdate(trade, { dodo_code: dodoVal, trade_step: 3 })}>
              Gates are Open 🌏
            </button>
          )}
          {canExpire && (
            <button className="tr-step-btn cancel" disabled={busy === trade.id}
              onClick={() => handleExpire(trade)}>
              ⌛ Cancel — Trade Inactive (48h)
            </button>
          )}
          {!canExpire && (
            <button className="tr-step-btn cancel" disabled={busy === trade.id}
              onClick={() => handleCancel(trade)}>
              Cancel Trade
            </button>
          )}
        </div>
      )}

      {/* Step 3 — Tradee visits, Trader marks complete */}
      {currentStep === 3 && (
        <div className="tr-ongoing-body">
          {isTradee && (
            <>
              <div className="tr-dodo-reveal" style={{ marginBottom: 8 }}>
                <span className="tr-dodo-label">Dodo Code</span>
                <span className="tr-dodo-code">{trade.dodo_code}</span>
              </div>
              <p className="tr-ongoing-desc">Fly to the trader's island, pick up your villager, then wait for the trader to mark the trade complete.</p>
              {tradeeCanComplete ? (
                <button className="tr-step-btn complete" disabled={busy === trade.id}
                  onClick={() => handleComplete(trade)}>
                  ✓ Mark Complete
                </button>
              ) : (
                <span className="tr-step-hint">If the trader hasn't marked complete after 24 hours, you'll be able to do it yourself.</span>
              )}
            </>
          )}
          {isTrader && (
            <>
              <p className="tr-ongoing-desc">The tradee is on their way to your island. Once they've picked up the villager, mark the trade complete.</p>
              <button className="tr-step-btn complete" disabled={busy === trade.id}
                onClick={() => handleComplete(trade)}>
                ✓ Mark Trade Complete
              </button>
            </>
          )}
          {canExpire && (
            <button className="tr-step-btn cancel" style={{ marginTop: 4 }} disabled={busy === trade.id}
              onClick={() => handleExpire(trade)}>
              ⌛ Cancel — Trade Inactive (48h)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ trade, user, busy, setBusy, reportOpen, setReportOpen, reportInputs, setReportInputs, handleReport }: any) {
  const isTrader = trade.acceptor_id === user?.id;
  const data = VILLAGERS_DATA[trade.villager_name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(trade.villager_name);
  const icon = SPECIES_ICONS[data.species as keyof typeof SPECIES_ICONS] || '🏘️';
  const otherUser = isTrader
    ? (trade.requester_number ? `#${trade.requester_number}` : 'Tradee')
    : (trade.acceptor_number ? `#${trade.acceptor_number}` : 'Trader');
  const daysLeft = trade.completed_at
    ? Math.max(0, 28 - Math.floor((Date.now() - new Date(trade.completed_at).getTime()) / 86400000))
    : 28;

  return (
    <div className="tr-history-card">
      <div className={`tr-card-icon ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`} style={{ width: 36, height: 36, fontSize: 18, flexShrink: 0 }}>
        <span className="villager-icon-emoji">{icon}</span>
      </div>
      <div className="tr-card-body">
        <div className="tr-card-row1">
          <span className="tr-card-name">{trade.villager_name}</span>
          <span className="tr-card-status-pill" style={{ color: '#94a3b8', background: 'rgba(148,163,184,0.1)' }}>Done</span>
        </div>
        <div className="tr-card-from">
          <span>{isTrader ? '🏡 Traded to' : '🎒 Received from'} {otherUser}</span>
        </div>
        {trade.completed_at && <span className="tr-card-time">{tAgo(trade.completed_at)} · {daysLeft}d until removed</span>}
        {trade.reported && <span className="tr-reported-badge">⚠ Reported</span>}
      </div>
      {!trade.reported && (
        reportOpen === trade.id ? (
          <div className="tr-report-row">
            <input className="tr-dodo-input" placeholder="Describe what happened…"
              value={reportInputs[trade.id] || ''}
              onChange={(e: any) => setReportInputs((p: any) => ({ ...p, [trade.id]: e.target.value }))} />
            <button className="tr-step-btn report" disabled={busy === trade.id} onClick={() => handleReport(trade)}>Send</button>
            <button className="tr-step-btn cancel" onClick={() => setReportOpen(null)}>Cancel</button>
          </div>
        ) : (
          <button className="tr-report-btn" onClick={() => setReportOpen(trade.id)}>⚠ Report</button>
        )
      )}
    </div>
  );
}
