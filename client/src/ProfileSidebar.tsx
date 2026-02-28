import React, { useState, useEffect } from 'react';
import { useAuth, supabase } from './AuthContext';
import { VILLAGERS_DATA, SPECIES_ICONS, getDefaultVillagerData } from './villagerData.js';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

interface ProfileSidebarProps {
  onOpenChat: (friendshipId: string, otherUser: OtherUser) => void;
  onNavigate: (page: Page, userId?: string) => void;
  currentPage: Page;
  mobileInline?: boolean;
}

export interface OtherUser {
  id: string;
  user_number: number;
  username?: string;
  owned: string[];
  favourites: string[];
  wishlist: string[];
  last_seen_at?: string;
}

interface Friendship {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: 'pending' | 'accepted' | 'blocked_by_a' | 'blocked_by_b';
  other?: OtherUser;
}

interface LeaderEntry {
  id: string;
  user_number: number;
  username?: string;
  count: number;
}

function isOnline(last_seen_at?: string) {
  if (!last_seen_at) return false;
  return Date.now() - new Date(last_seen_at).getTime() < 3 * 60 * 1000;
}

const NavItem = ({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) => (
  <button className={`sidebar-nav-item ${active ? 'active' : ''}`} onClick={onClick} title={label}>
    <span className="nav-item-icon">{icon}</span>
    <span className="nav-item-label">{label}</span>
  </button>
);

export default function ProfileSidebar({ onOpenChat, onNavigate, currentPage, mobileInline }: ProfileSidebarProps) {
  const { user } = useAuth();
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<OtherUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [leaderTrades, setLeaderTrades] = useState<LeaderEntry[]>([]);
  const [leaderOwned, setLeaderOwned] = useState<LeaderEntry[]>([]);
  const [leaderTab, setLeaderTab] = useState<'trades' | 'owned'>('trades');
  const [busy, setBusy] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportingUser, setReportingUser] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadFriendships();
  }, [user]);

  // Heartbeat — update last_seen_at every 60s
  useEffect(() => {
    if (!user) return;
    const ping = () => supabase.from('ac_users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    ping();
    const iv = setInterval(ping, 60000);
    return () => clearInterval(iv);
  }, [user]);

  const loadFriendships = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
    if (!data) return;
    const otherIds = data.map((f: any) => f.user_a_id === user.id ? f.user_b_id : f.user_a_id);
    let userMap: Record<string, OtherUser> = {};
    if (otherIds.length) {
      const { data: uData } = await supabase.from('ac_users').select('id, user_number, username, owned, favourites, wishlist, last_seen_at').in('id', otherIds);
      (uData || []).forEach((u: any) => { userMap[u.id] = u; });
    }
    setFriendships(data.map((f: any) => ({
      ...f,
      other: userMap[f.user_a_id === user.id ? f.user_b_id : f.user_a_id],
    })));
  };

  const loadLeaderboard = async () => {
    // Most completed trades
    const { data: tradeData } = await supabase
      .from('trade_requests')
      .select('requester_id, acceptor_id')
      .eq('status', 'completed');
    const counts: Record<string, number> = {};
    (tradeData || []).forEach((t: any) => {
      if (t.requester_id) counts[t.requester_id] = (counts[t.requester_id] || 0) + 1;
      if (t.acceptor_id) counts[t.acceptor_id] = (counts[t.acceptor_id] || 0) + 1;
    });
    const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);

    // Most verified owned (appeared as acceptor in a completed trade)
    const { data: tradeDataFull } = await supabase
      .from('trade_requests')
      .select('acceptor_id, villager_name')
      .eq('status', 'completed');
    const verifiedCounts: Record<string, Set<string>> = {};
    (tradeDataFull || []).forEach((t: any) => {
      if (t.acceptor_id && t.villager_name) {
        if (!verifiedCounts[t.acceptor_id]) verifiedCounts[t.acceptor_id] = new Set();
        verifiedCounts[t.acceptor_id].add(t.villager_name);
      }
    });
    const topVerifiedIds = Object.entries(verifiedCounts)
      .sort((a, b) => b[1].size - a[1].size).slice(0, 10).map(([id]) => id);

    const allIds = Array.from(new Set([...topIds, ...topVerifiedIds]));
    if (!allIds.length) {
      setLeaderTrades([]);
      setLeaderOwned([]);
      return;
    }
    const { data: uData } = await supabase.from('ac_users').select('id, user_number, username').in('id', allIds);
    const uMap: Record<string, any> = {};
    (uData || []).forEach((u: any) => { uMap[u.id] = u; });

    setLeaderTrades(
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .filter(([id]) => uMap[id])
        .map(([id, count]) => ({ id, user_number: uMap[id].user_number, username: uMap[id].username, count }))
    );
    setLeaderOwned(
      Object.entries(verifiedCounts).sort((a, b) => b[1].size - a[1].size).slice(0, 10)
        .filter(([id]) => uMap[id])
        .map(([id, s]) => ({ id, user_number: uMap[id].user_number, username: uMap[id].username, count: s.size }))
    );
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const num = parseInt(q, 10);
    let query = supabase
      .from('ac_users')
      .select('id, user_number, username, owned, favourites, wishlist, last_seen_at')
      .neq('id', user?.id || '')
      .limit(8);
    // Build filter: always search by username; also match user_number if input is a pure number
    if (!isNaN(num) && String(num) === q.trim()) {
      query = query.or(`username.ilike.%${q}%,user_number.eq.${num}`);
    } else {
      query = query.ilike('username', `%${q}%`);
    }
    const { data, error } = await query;
    if (error) console.error('User search error:', error);
    setSearchResults(data || []);
    setSearching(false);
  };

  const getFriendship = (otherId: string) =>
    friendships.find(f => f.user_a_id === otherId || f.user_b_id === otherId);

  const handleAddFriend = async (otherId: string) => {
    if (!user) return;
    setBusy(otherId);
    await supabase.from('friendships').insert({ user_a_id: user.id, user_b_id: otherId, status: 'pending' });
    await loadFriendships();
    setBusy(null);
  };

  const handleAcceptFriend = async (friendshipId: string) => {
    setBusy(friendshipId);
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await loadFriendships();
    setBusy(null);
  };

  const handleBlock = async (otherId: string) => {
    if (!user) return;
    setBusy(otherId);
    const existing = getFriendship(otherId);
    const isA = existing?.user_a_id === user.id;
    if (existing) {
      await supabase.from('friendships').update({ status: isA ? 'blocked_by_a' : 'blocked_by_b' }).eq('id', existing.id);
    } else {
      await supabase.from('friendships').insert({ user_a_id: user.id, user_b_id: otherId, status: 'blocked_by_a' });
    }
    await loadFriendships();
    setBusy(null);
  };

  const handleUnblock = async (friendshipId: string) => {
    setBusy(friendshipId);
    await supabase.from('friendships').delete().eq('id', friendshipId);
    await loadFriendships();
    setBusy(null);
  };

  const handleReportUser = async (reportedId: string) => {
    if (!user || !reportReason.trim()) return;
    setBusy(reportedId);
    await supabase.from('user_reports').insert({ reported_id: reportedId, reporter_id: user.id, reason: reportReason.trim() });
    setReportingUser(null);
    setReportReason('');
    setBusy(null);
  };

  const isBlocked = (otherId: string) => {
    const f = getFriendship(otherId);
    if (!f) return false;
    return f.status === 'blocked_by_a' || f.status === 'blocked_by_b';
  };

  const pendingIncoming = friendships.filter(f => f.status === 'pending' && f.user_b_id === user?.id);
  const acceptedFriends = friendships.filter(f => f.status === 'accepted');

  // --- Render helpers (defined as local function, not nested component, to avoid stale closure issues) ---
  const renderUserActions = (other: OtherUser) => {
    const f = getFriendship(other.id);
    const blocked = isBlocked(other.id);
    const iAmA = f?.user_a_id === user?.id;
    const isPendingOutgoing = f?.status === 'pending' && f?.user_a_id === user?.id;
    const isPendingIncoming = f?.status === 'pending' && f?.user_b_id === user?.id;
    const isAccepted = f?.status === 'accepted';

    return (
      <div className="psb-user-actions">
        {!f && !blocked && (
          <button className="psb-action-btn add" disabled={busy === other.id} onClick={() => handleAddFriend(other.id)}>
            + Add Friend
          </button>
        )}
        {isPendingOutgoing && <span className="psb-action-pending">Request sent…</span>}
        {isPendingIncoming && (
          <button className="psb-action-btn add" disabled={busy === f.id} onClick={() => handleAcceptFriend(f.id)}>
            ✓ Accept
          </button>
        )}
        {isAccepted && (
          <button className="psb-action-btn chat" onClick={() => onOpenChat(f.id, other)}>
            💬 Message
          </button>
        )}
        {blocked ? (
          <button className="psb-action-btn unblock" disabled={busy === (f?.id || other.id)} onClick={() => f && handleUnblock(f.id)}>
            Unblock
          </button>
        ) : (
          <button className="psb-action-btn block" disabled={busy === other.id} onClick={() => handleBlock(other.id)}>
            Block
          </button>
        )}
        {reportingUser === other.id ? (
          <div className="psb-report-row">
            <input className="psb-report-input" placeholder="Reason…" value={reportReason} onChange={e => setReportReason(e.target.value)} maxLength={200} />
            <button className="psb-action-btn report" disabled={busy === other.id || !reportReason.trim()} onClick={() => handleReportUser(other.id)}>Send</button>
            <button className="psb-action-btn" onClick={() => setReportingUser(null)}>✕</button>
          </div>
        ) : (
          <button className="psb-action-btn report" onClick={() => setReportingUser(other.id)}>Report</button>
        )}
      </div>
    );
  };

  
  if (!user) return null;

  const innerContent = (
    <>
            {/* ── SEARCH BAR (always at top, like shop) ── */}
            <div className="sidebar-search-wrap">
              <div className="sidebar-search-bare">
                <span className="search-icon-inline">🔍</span>
                <input
                  type="text"
                  placeholder="Search users…"
                  className="search-input"
                  value={searchQ}
                  onChange={e => handleSearch(e.target.value)}
                />
                {searchQ && (
                  <button className="search-clear" onClick={() => { setSearchQ(''); setSearchResults([]); }}>✕</button>
                )}
              </div>
            </div>

            {/* ── SEARCH RESULTS (shown while searching) ── */}
            {(searchQ || searching) && (
              <div className="psb-section">
                {searching && <div className="psb-loading">Searching…</div>}
                {!searching && searchResults.map(u => (
                  <div key={u.id} className="psb-result-row" onClick={() => onNavigate('profile', u.id)}>
                    <div className={`psb-online-dot ${isOnline(u.last_seen_at) ? 'online' : 'offline'}`} />
                    <div className="psb-result-info">
                      <span className="psb-result-name">{u.username || `#${u.user_number}`}</span>
                      <span className="psb-result-meta">#{u.user_number} · {u.owned?.length || 0} owned</span>
                    </div>
                    <span className="psb-result-arrow">›</span>
                  </div>
                ))}
                {!searching && searchQ && !searchResults.length && (
                  <div className="psb-no-results">No users found</div>
                )}
              </div>
            )}

            {/* ── UNREAD CHATS ── */}
            <div className="sidebar-section">
              <div className="sidebar-section-label">
                Unread Chats
              </div>
              <div className="psb-no-results">No unread messages</div>
            </div>

            {/* ── FRIENDS ── */}
            <div className="sidebar-section">
              <div className="sidebar-section-label">
                Friends ({acceptedFriends.length})
                {pendingIncoming.length > 0 && (
                  <span className="psb-tab-badge" style={{marginLeft:6}}>{pendingIncoming.length} pending</span>
                )}
              </div>

              {pendingIncoming.map(f => f.other && (
                <div key={f.id} className="psb-friend-row">
                  <div className="psb-result-info" onClick={() => f.other && onNavigate('profile', f.other.id)} style={{cursor:'pointer'}}>
                    <span className="psb-result-name">{f.other.username || `#${f.other.user_number}`}</span>
                    <span className="psb-result-meta">#{f.other.user_number} · wants to be friends</span>
                  </div>
                  <button className="psb-action-btn add" disabled={busy === f.id} onClick={() => handleAcceptFriend(f.id)}>✓</button>
                  <button className="psb-action-btn block" disabled={busy === f.id} onClick={() => f.other && handleBlock(f.other.id)}>✕</button>
                </div>
              ))}

              {acceptedFriends.map(f => f.other && (
                <div key={f.id} className="psb-friend-row" onClick={() => f.other && onNavigate('profile', f.other.id)}>
                  <div className={`psb-online-dot ${isOnline(f.other.last_seen_at) ? 'online' : 'offline'}`} />
                  <div className="psb-result-info">
                    <span className="psb-result-name">{f.other.username || `#${f.other.user_number}`}</span>
                    <span className="psb-result-meta">#{f.other.user_number} · {f.other.owned?.length || 0} owned</span>
                  </div>
                  <button className="psb-action-btn chat" onClick={e => { e.stopPropagation(); f.other && onOpenChat(f.id, f.other); }}>💬</button>
                </div>
              ))}
              {!acceptedFriends.length && !pendingIncoming.length && (
                <div className="psb-no-results">Search for a user to add friends</div>
              )}
            </div>

            {/* ── LEADERBOARD ── */}
            <div className="sidebar-section">
              <div className="sidebar-section-label">Leaderboard</div>
              <div className="psb-lb-tabs">
                <button className={`psb-lb-tab ${leaderTab === 'trades' ? 'active' : ''}`} onClick={() => setLeaderTab('trades')}>🔄 Trades</button>
                <button className={`psb-lb-tab ${leaderTab === 'owned' ? 'active' : ''}`} onClick={() => setLeaderTab('owned')}>✓ Verified</button>
              </div>
              {(() => {
                const entries = leaderTab === 'trades' ? leaderTrades : leaderOwned;
                if (!entries.length) return <div className="psb-no-results">No data yet</div>;
                const MEDALS = ['🥇', '🥈', '🥉'];
                const podium = entries.slice(0, 3);
                const rest   = entries.slice(3);
                // Reorder podium visually: 2nd, 1st, 3rd
                const visual = [podium[1], podium[0], podium[2]].filter(Boolean);
                return (
                  <>
                    <div className="psb-lb-podium">
                      {visual.map(e => {
                        const rank = entries.indexOf(e) + 1;
                        return (
                          <div key={e.id} className={`psb-lb-podium-card rank-${rank}`}>
                            <span className="psb-lb-podium-medal">{MEDALS[rank - 1]}</span>
                            <span className="psb-lb-podium-name">{e.username || `#${e.user_number}`}</span>
                            <span className="psb-lb-podium-count">{e.count}</span>
                          </div>
                        );
                      })}
                    </div>
                    {rest.length > 0 && (
                      <div className="psb-lb-rest">
                        {rest.map((e, i) => (
                          <div key={e.id} className="psb-lb-row">
                            <span className="psb-lb-rank">{i + 4}</span>
                            <span className="psb-lb-name">{e.username || `#${e.user_number}`}</span>
                            <span className="psb-lb-count">{e.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="psb-lb-legend">
                {leaderTab === 'trades' ? 'Total completed trades' : 'Unique villagers given in trades'}
              </div>
            </div>
    </>
  );

  if (mobileInline) {
    return <div className="psb-mobile-inline">{innerContent}</div>;
  }

  return (
    <div className="psb-sidebar">
      <div className="psb-sidebar-inner">
        <div className="sidebar-logo-header">
          <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
          <button className="tutorial-trigger-btn" title="Tutorial">?</button>
        </div>
        {innerContent}
      </div>

      {/* ── NAV (pinned at bottom, never scrolls) ── */}
      <div className="sidebar-nav">
        <NavItem icon="🛒" label="Market" active={currentPage === 'shop'} onClick={() => onNavigate('shop')} />
        <NavItem icon="⇄" label="Trades" active={currentPage === 'orders'} onClick={() => onNavigate('orders')} />
        <NavItem
          icon="👤"
          label={user.username || `#${user.user_number}`}
          active={currentPage === 'profile'}
          onClick={() => onNavigate('profile')}
        />
        <NavItem icon="💬" label="Feedback" active={currentPage === 'feedback'} onClick={() => onNavigate('feedback')} />
        <NavItem icon="⚠" label="Admin" active={currentPage === 'admin'} onClick={() => onNavigate('admin')} />
      </div>
    </div>
  );
}
