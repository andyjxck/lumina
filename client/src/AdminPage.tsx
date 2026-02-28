import React, { useState, useEffect, useRef } from 'react';
import { useAuth, supabase } from './AuthContext';
import MobileNav from './MobileNav';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';
type AdminTab = 'reports' | 'help' | 'feedback' | 'users' | 'modlogs';

interface AdminPageProps {
  onBack: () => void;
  onNavigate?: (page: Page) => void;
  currentPage?: Page;
}

interface ReportedTrade {
  id: string;
  villager_name: string;
  offer_text: string;
  status: string;
  report_reason: string;
  reported: boolean;
  completed_at?: string;
  created_at: string;
  requester_id: string;
  acceptor_id?: string;
  report_by?: string;
  requester_number?: number;
  requester_username?: string;
  acceptor_number?: number;
  acceptor_username?: string;
  reporter_number?: number;
  reporter_username?: string;
}

interface AcUser {
  id: string;
  user_number: number;
  username?: string;
  trade_restricted: boolean;
  owned: string[];
  created_at: string;
}

interface UserReport {
  id: string;
  reported_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  reported_username?: string;
  reported_number?: number;
  reporter_username?: string;
  reporter_number?: number;
}

interface HelpTicket {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  user_number?: number;
  username?: string;
}

interface ModLog {
  id: string;
  mod_id: string;
  target_id?: string;
  action: string;
  title?: string;
  reason?: string;
  meta?: any;
  created_at: string;
  mod_username?: string;
  mod_number?: number;
  target_username?: string;
  target_number?: number;
}

const ACTION_COLORS: Record<string, string> = {
  restrict:       '#ef4444',
  unrestrict:     '#22c55e',
  dismiss_report: '#f59e0b',
  ban:            '#dc2626',
  unban:          '#16a34a',
  warn:           '#f97316',
};

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

const writeModLog = async (modId: string, action: string, title: string, targetId?: string, reason?: string, meta?: any) => {
  await supabase.from('mod_logs').insert({ mod_id: modId, target_id: targetId, action, title, reason, meta });
};

export default function AdminPage({ onBack, onNavigate, currentPage }: AdminPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<ReportedTrade[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [helpTickets, setHelpTickets] = useState<HelpTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HelpTicket | null>(null);
  const [users, setUsers] = useState<AcUser[]>([]);
  const [modLogs, setModLogs] = useState<ModLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const closeDrawerRef = useRef<(() => void) | null>(null);

  const isFullAdmin = user?.user_number === 0 || user?.user_number === 2;
  const isLimitedUser = user && !isFullAdmin;

  useEffect(() => {
    if (isFullAdmin) loadData();
    else if (isLimitedUser) loadUserData();
  }, [isFullAdmin, isLimitedUser]);

  const loadData = async () => {
    setLoading(true);
    const [reportsRes, usersRes, userReportsRes, ticketsRes, logsRes] = await Promise.all([
      supabase
        .from('trade_requests')
        .select('*, req:ac_users!requester_id(user_number, username), acc:ac_users!acceptor_id(user_number, username), rep:ac_users!report_by(user_number, username)')
        .eq('reported', true)
        .order('completed_at', { ascending: false }),
      supabase.from('ac_users').select('id, user_number, username, trade_restricted, owned, created_at').order('user_number', { ascending: true }),
      supabase.from('user_reports').select('*, rep:ac_users!reported_id(user_number, username), rer:ac_users!reporter_id(user_number, username)').order('created_at', { ascending: false }),
      supabase.from('feedback_tickets').select('*, u:ac_users!user_id(user_number, username)').order('created_at', { ascending: false }),
      supabase.from('mod_logs').select('*, mod:ac_users!mod_id(user_number, username), tgt:ac_users!target_id(user_number, username)').order('created_at', { ascending: false }).limit(100),
    ]);

    setReports((reportsRes.data || []).map((r: any) => ({
      ...r,
      requester_number: r.req?.user_number, requester_username: r.req?.username,
      acceptor_number: r.acc?.user_number, acceptor_username: r.acc?.username,
      reporter_number: r.rep?.user_number, reporter_username: r.rep?.username,
    })));
    setUsers(usersRes.data || []);
    setUserReports((userReportsRes.data || []).map((r: any) => ({
      ...r,
      reported_username: r.rep?.username, reported_number: r.rep?.user_number,
      reporter_username: r.rer?.username, reporter_number: r.rer?.user_number,
    })));
    setHelpTickets((ticketsRes.data || []).map((t: any) => ({ ...t, user_number: t.u?.user_number, username: t.u?.username })));
    setModLogs((logsRes.data || []).map((l: any) => ({
      ...l,
      mod_username: l.mod?.username, mod_number: l.mod?.user_number,
      target_username: l.tgt?.username, target_number: l.tgt?.user_number,
    })));
    setLoading(false);
  };

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);
    const reportsRes = await supabase
      .from('trade_requests')
      .select('*, req:ac_users!requester_id(user_number, username), acc:ac_users!acceptor_id(user_number, username)')
      .or(`requester_id.eq.${user.id},acceptor_id.eq.${user.id}`)
      .eq('reported', true)
      .order('completed_at', { ascending: false });
    setReports((reportsRes.data || []).map((r: any) => ({
      ...r,
      requester_number: r.req?.user_number, requester_username: r.req?.username,
      acceptor_number: r.acc?.user_number, acceptor_username: r.acc?.username,
    })));
    setLoading(false);
  };

  const handleDismissReport = async (trade: ReportedTrade) => {
    if (!user) return;
    setBusy(trade.id);
    await supabase.from('trade_requests').update({ reported: false, report_reason: '' }).eq('id', trade.id);
    await writeModLog(user.id, 'dismiss_report', `Dismissed report on trade: ${trade.villager_name}`, undefined, trade.report_reason, { trade_id: trade.id });
    await loadData();
    setBusy(null);
  };

  const handleToggleRestrict = async (u: AcUser) => {
    if (!user) return;
    setBusy(u.id);
    const newVal = !u.trade_restricted;
    await supabase.from('ac_users').update({ trade_restricted: newVal }).eq('id', u.id);
    await writeModLog(user.id, newVal ? 'restrict' : 'unrestrict', `${newVal ? 'Restricted' : 'Unrestricted'} user #${u.user_number}${u.username ? ` (${u.username})` : ''}`, u.id);
    await loadData();
    setBusy(null);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return String(u.user_number).includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  const navigate = onNavigate || (() => {});
  const page = currentPage || 'admin';

  const TABS: { id: AdminTab; label: string; count?: number }[] = isFullAdmin ? [
    { id: 'reports',  label: '⚠ Reports',   count: reports.length },
    { id: 'help',     label: '🆘 Help',      count: helpTickets.length },
    { id: 'feedback', label: '💬 Feedback',  count: userReports.length },
    { id: 'users',    label: '👥 Users',     count: users.length },
    { id: 'modlogs',  label: '📋 Mod Logs' },
  ] : [];

  // Drawer content for mobile: show tab switcher
  const drawerContent = isFullAdmin ? (
    <div style={{padding:'0 4px'}}>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:10,marginTop:4}}>Admin Sections</div>
      {TABS.map(t => (
        <div key={t.id} onClick={()=>{ setTab(t.id); closeDrawerRef.current?.(); }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer'}}>
          <span style={{flex:1,color: tab===t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',fontSize:14,fontWeight: tab===t.id ? 700 : 400}}>{t.label}</span>
          {t.count !== undefined && t.count > 0 && <span style={{background:'rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',borderRadius:8,padding:'1px 7px',fontSize:11}}>{t.count}</span>}
          {tab===t.id && <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>✓</span>}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <>
    <MobileNav
      currentPage={page}
      onNavigate={navigate}
      extraFilters={drawerContent || undefined}
      onCloseDrawer={fn => { closeDrawerRef.current = fn; }}
    />
    <div className="admin-layout">

    {/* Desktop nav sidebar */}
    <div className="psb-sidebar">
      <div className="psb-sidebar-inner">
        <div className="sidebar-logo-header">
          <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
          <button className="tutorial-trigger-btn" title="Tutorial">?</button>
        </div>
      </div>
      <div className="sidebar-nav">
        <button className={`sidebar-nav-item ${page === 'shop' ? 'active' : ''}`} onClick={() => navigate('shop')} title="Market"><span className="nav-item-icon">🛒</span><span className="nav-item-label">Market</span></button>
        <button className={`sidebar-nav-item ${page === 'orders' ? 'active' : ''}`} onClick={() => navigate('orders')} title="Trades"><span className="nav-item-icon">⇄</span><span className="nav-item-label">Trades</span></button>
        <button className={`sidebar-nav-item ${page === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')} title="Profile"><span className="nav-item-icon">👤</span><span className="nav-item-label">{user?.username || (user ? `#${user.user_number}` : 'Profile')}</span></button>
        <button className={`sidebar-nav-item ${page === 'feedback' ? 'active' : ''}`} onClick={() => navigate('feedback')} title="Feedback"><span className="nav-item-icon">💬</span><span className="nav-item-label">Feedback</span></button>
        <button className={`sidebar-nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')} title="Admin"><span className="nav-item-icon">⚠</span><span className="nav-item-label">Admin</span></button>
      </div>
    </div>

    <div className="admin-page">
      <button className="page-back-btn" onClick={onBack}>←</button>

      <div className="admin-header">
        <div className="admin-header-left">
          <h1 className="admin-title">{isFullAdmin ? '⚠ Admin Panel' : '📋 My Status'}</h1>
          <p className="admin-sub">User #{user?.user_number}</p>
        </div>
        <div className="admin-stats">
          {isFullAdmin ? (
            <>
              <div className="admin-stat"><span className="admin-stat-val">{reports.length}</span><span className="admin-stat-label">Reports</span></div>
              <div className="admin-stat"><span className="admin-stat-val">{users.filter(u => u.trade_restricted).length}</span><span className="admin-stat-label">Restricted</span></div>
              <div className="admin-stat"><span className="admin-stat-val">{users.length}</span><span className="admin-stat-label">Users</span></div>
            </>
          ) : (
            <>
              <div className="admin-stat"><span className="admin-stat-val">{reports.length}</span><span className="admin-stat-label">My Reports</span></div>
              <div className="admin-stat"><span className="admin-stat-val">--</span><span className="admin-stat-label">Restriction</span></div>
            </>
          )}
        </div>
      </div>

      {isFullAdmin && (
        <div className="admin-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="admin-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading…</div>

      ) : !isFullAdmin ? (
        reports.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">✓</div><p>No reports involving you</p></div>
        ) : (
          <div className="admin-list">
            {reports.map(r => (
              <div key={r.id} className="admin-report-card">
                <div className="admin-report-header"><span className="admin-report-villager">{r.villager_name}</span><span className="admin-report-status">{r.status}</span></div>
                <div className="admin-report-parties">
                  <div className="admin-party"><span className="admin-party-label">Your Role</span><span className="admin-party-val">{r.requester_id === user?.id ? 'Requester' : 'Acceptor'}</span></div>
                  <div className="admin-party-sep">↔</div>
                  <div className="admin-party"><span className="admin-party-label">Other Party</span><span className="admin-party-val">{r.requester_id === user?.id ? `#${r.acceptor_number ?? '?'}${r.acceptor_username ? ` · ${r.acceptor_username}` : ''}` : `#${r.requester_number ?? '?'}${r.requester_username ? ` · ${r.requester_username}` : ''}`}</span></div>
                </div>
                <div className="admin-report-reason"><span className="admin-report-reason-label">Report Reason</span><blockquote className="admin-report-quote">"{r.report_reason}"</blockquote></div>
                <div className="admin-report-meta"><span className="admin-report-date">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}</span></div>
              </div>
            ))}
          </div>
        )

      ) : tab === 'reports' ? (
        reports.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">✓</div><p>No reported trades</p></div>
        ) : (
          <div className="admin-list">
            {reports.map(r => (
              <div key={r.id} className="admin-report-card">
                <div className="admin-report-header"><span className="admin-report-villager">{r.villager_name}</span><span className="admin-report-status">{r.status}</span></div>
                <div className="admin-report-parties">
                  <div className="admin-party"><span className="admin-party-label">Trader (owner)</span><span className="admin-party-val">#{r.acceptor_number ?? '?'}{r.acceptor_username ? ` · ${r.acceptor_username}` : ''}</span></div>
                  <div className="admin-party-sep">↔</div>
                  <div className="admin-party"><span className="admin-party-label">Tradee (requester)</span><span className="admin-party-val">#{r.requester_number ?? '?'}{r.requester_username ? ` · ${r.requester_username}` : ''}</span></div>
                </div>
                <div className="admin-report-reason"><span className="admin-report-reason-label">Report by #{r.reporter_number ?? '?'}</span><blockquote className="admin-report-quote">"{r.report_reason}"</blockquote></div>
                <div className="admin-report-actions">
                  <button className="admin-btn dismiss" disabled={busy === r.id} onClick={() => handleDismissReport(r)}>Dismiss Report</button>
                  {r.acceptor_id && <button className="admin-btn restrict" disabled={busy === r.id} onClick={() => { const u = users.find(u => u.id === r.acceptor_id); if (u) handleToggleRestrict(u); }}>{users.find(u => u.id === r.acceptor_id)?.trade_restricted ? 'Unrestrict Trader' : 'Restrict Trader'}</button>}
                  {r.requester_id && <button className="admin-btn restrict" disabled={busy === r.id} onClick={() => { const u = users.find(u => u.id === r.requester_id); if (u) handleToggleRestrict(u); }}>{users.find(u => u.id === r.requester_id)?.trade_restricted ? 'Unrestrict Tradee' : 'Restrict Tradee'}</button>}
                </div>
              </div>
            ))}
          </div>
        )

      ) : tab === 'help' ? (
        /* Help tickets — from feedback_tickets table */
        selectedTicket ? (
          <div className="admin-list">
            <button className="admin-btn dismiss" style={{marginBottom:16}} onClick={() => setSelectedTicket(null)}>← Back to tickets</button>
            <div className="admin-report-card">
              <div className="admin-report-header">
                <span className="admin-report-villager">{selectedTicket.category}</span>
                <span className="admin-report-status">{selectedTicket.status || 'open'}</span>
              </div>
              <div className="admin-report-reason">
                <span className="admin-report-reason-label">From #{selectedTicket.user_number ?? '?'}{selectedTicket.username ? ` · ${selectedTicket.username}` : ''}</span>
                <blockquote className="admin-report-quote">{selectedTicket.message}</blockquote>
              </div>
              <div className="admin-report-meta"><span className="admin-report-date">{new Date(selectedTicket.created_at).toLocaleString()}</span></div>
            </div>
          </div>
        ) : helpTickets.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">🆘</div><p>No help tickets</p></div>
        ) : (
          <div className="admin-list">
            {helpTickets.map(t => (
              <div key={t.id} className="admin-report-card" style={{cursor:'pointer'}} onClick={() => setSelectedTicket(t)}>
                <div className="admin-report-header">
                  <span className="admin-report-villager">{t.category}</span>
                  <span className="admin-report-status">{t.status || 'open'}</span>
                </div>
                <div className="admin-report-reason">
                  <span className="admin-report-reason-label">#{t.user_number ?? '?'}{t.username ? ` · ${t.username}` : ''}</span>
                  <blockquote className="admin-report-quote">{t.message.substring(0, 120)}{t.message.length > 120 ? '…' : ''}</blockquote>
                </div>
                <div className="admin-report-meta"><span className="admin-report-date">{new Date(t.created_at).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        )

      ) : tab === 'feedback' ? (
        /* User reports (from user_reports table) */
        userReports.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">💬</div><p>No user reports</p></div>
        ) : (
          <div className="admin-list">
            {userReports.map(r => (
              <div key={r.id} className="admin-report-card">
                <div className="admin-report-header">
                  <span className="admin-report-villager">User Report</span>
                  <span className="admin-report-status">open</span>
                </div>
                <div className="admin-report-parties">
                  <div className="admin-party"><span className="admin-party-label">Reported</span><span className="admin-party-val">#{r.reported_number ?? '?'}{r.reported_username ? ` · ${r.reported_username}` : ''}</span></div>
                  <div className="admin-party-sep">→</div>
                  <div className="admin-party"><span className="admin-party-label">Reporter</span><span className="admin-party-val">#{r.reporter_number ?? '?'}{r.reporter_username ? ` · ${r.reporter_username}` : ''}</span></div>
                </div>
                <div className="admin-report-reason"><blockquote className="admin-report-quote">"{r.reason}"</blockquote></div>
                <div className="admin-report-meta"><span className="admin-report-date">{new Date(r.created_at).toLocaleString()}</span></div>
                <div className="admin-report-actions">
                  {users.find(u => u.id === r.reported_id) && (
                    <button className="admin-btn restrict" disabled={busy === r.reported_id} onClick={() => { const u = users.find(u => u.id === r.reported_id); if (u) handleToggleRestrict(u); }}>
                      {users.find(u => u.id === r.reported_id)?.trade_restricted ? 'Unrestrict' : 'Restrict User'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )

      ) : tab === 'users' ? (
        <>
          <input className="admin-user-search" placeholder="Search by user number or username…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
          <div className="admin-list">
            {filteredUsers.map(u => (
              <div key={u.id} className={`admin-user-row ${u.trade_restricted ? 'restricted' : ''}`}>
                <div className="admin-user-info">
                  <span className="admin-user-num">#{u.user_number}</span>
                  {u.username && <span className="admin-user-name">{u.username}</span>}
                  <span className="admin-user-meta">{(u.owned || []).length} villagers</span>
                  {u.trade_restricted && <span className="admin-restricted-badge">Restricted</span>}
                </div>
                {u.user_number !== 0 && (
                  <button className={`admin-btn ${u.trade_restricted ? 'unrestrict' : 'restrict'}`} disabled={busy === u.id} onClick={() => handleToggleRestrict(u)}>
                    {u.trade_restricted ? 'Unrestrict' : 'Restrict'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>

      ) : tab === 'modlogs' ? (
        /* Reddit-style mod log */
        modLogs.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">📋</div><p>No mod actions yet</p></div>
        ) : (
          <div className="admin-list">
            {modLogs.map(l => (
              <div key={l.id} className="admin-modlog-row">
                <div className="admin-modlog-action-bar" style={{borderLeft:`3px solid ${ACTION_COLORS[l.action] || 'rgba(255,255,255,0.2)'}`}}>
                  <div className="admin-modlog-top">
                    <span className="admin-modlog-action" style={{color: ACTION_COLORS[l.action] || 'rgba(255,255,255,0.6)', textTransform:'uppercase', fontSize:10, fontWeight:700, letterSpacing:'0.8px'}}>
                      {l.action.replace('_', ' ')}
                    </span>
                    <span className="admin-modlog-time" style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginLeft:'auto'}}>{timeAgo(l.created_at)}</span>
                  </div>
                  <div className="admin-modlog-title" style={{color:'rgba(255,255,255,0.85)',fontSize:14,fontWeight:600,marginTop:4}}>
                    {l.title || l.action}
                  </div>
                  <div className="admin-modlog-meta" style={{display:'flex',gap:12,marginTop:6,flexWrap:'wrap'}}>
                    <span style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>
                      by <strong style={{color:'rgba(255,255,255,0.7)'}}>{l.mod_username || `#${l.mod_number}`}</strong>
                    </span>
                    {l.target_id && (
                      <span style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>
                        on <strong style={{color:'rgba(255,255,255,0.7)'}}>{l.target_username || `#${l.target_number}`}</strong>
                      </span>
                    )}
                    <span style={{color:'rgba(255,255,255,0.3)',fontSize:11}}>{new Date(l.created_at).toLocaleString()}</span>
                  </div>
                  {l.reason && (
                    <div className="admin-modlog-reason" style={{marginTop:6,padding:'6px 10px',background:'rgba(255,255,255,0.04)',borderRadius:6,color:'rgba(255,255,255,0.5)',fontSize:12,fontStyle:'italic'}}>
                      "{l.reason}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )

      ) : null}
    </div>
    </div>
    </>
  );
}
