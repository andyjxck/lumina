import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, supabase } from './AuthContext';
import MobileNav from './MobileNav';
import ChatModal from './ChatModal';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';
type AdminTab = 'reports' | 'help' | 'feedback' | 'users' | 'modlogs';

interface AdminPageProps {
  onBack: () => void;
  onNavigate?: (page: Page, userId?: string) => void;
  currentPage?: Page;
}

// ── Shared admin user for ChatModal ──
const ADMIN_USER = { id: 'admin', user_number: 0, username: 'Admin', owned: [] as string[], favourites: [] as string[], wishlist: [] as string[] };

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
  status?: string;
  created_at: string;
  reported_username?: string;
  reported_number?: number;
  reporter_username?: string;
  reporter_number?: number;
}

interface FeedbackTicket {
  id: string;
  user_id: string;
  category: string;
  message: string;
  feedback_status: string;
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
  restrict: '#ef4444', unrestrict: '#22c55e', dismiss_report: '#f59e0b',
  ban: '#dc2626', unban: '#16a34a', warn: '#f97316',
};

const FEEDBACK_STATUSES = ['open', 'implementing', 'implemented', 'rejected'];
const HELP_STATUSES = ['open', 'resolved'];
const REPORT_STATUSES = ['open', 'dismissed', 'closed'];

const STATUS_COLORS: Record<string, string> = {
  open: '#60a5fa', implementing: '#f59e0b', implemented: '#22c55e',
  rejected: '#ef4444', resolved: '#22c55e', dismissed: '#f59e0b', closed: '#6b7280',
};

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const writeModLog = async (modId: string, action: string, title: string, targetId?: string, reason?: string, meta?: any) => {
  await supabase.from('mod_logs').insert({ mod_id: modId, target_id: targetId, action, title, reason, meta });
};

function StatusPill({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
      color: STATUS_COLORS[status] || 'rgba(255,255,255,0.4)',
      background: (STATUS_COLORS[status] || 'rgba(255,255,255,0.1)') + '22',
      border: `1px solid ${(STATUS_COLORS[status] || 'rgba(255,255,255,0.2)')}55`,
      borderRadius: 6, padding: '2px 8px',
    }}>{status}</span>
  );
}

function StatusSwitcher({ current, options, onChange, busy }: { current: string; options: string[]; onChange: (s: string) => void; busy: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(s => (
        <button key={s} disabled={busy || current === s} onClick={() => onChange(s)} style={{
          fontFamily: 'inherit', fontSize: 10, fontWeight: 700, padding: '3px 9px',
          borderRadius: 6, cursor: current === s ? 'default' : 'pointer', border: '1px solid',
          background: current === s ? (STATUS_COLORS[s] || 'rgba(255,255,255,0.1)') + '33' : 'rgba(255,255,255,0.04)',
          borderColor: current === s ? (STATUS_COLORS[s] || 'rgba(255,255,255,0.2)') + '88' : 'rgba(255,255,255,0.1)',
          color: current === s ? (STATUS_COLORS[s] || 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase', letterSpacing: '0.5px', opacity: busy ? 0.5 : 1,
        }}>{s}</button>
      ))}
    </div>
  );
}

// Compact icon-style action button
function AB({ label, color, disabled, onClick }: { label: string; color?: string; disabled?: boolean; onClick: () => void }) {
  const c = color || 'rgba(255,255,255,0.5)';
  return (
    <button disabled={disabled} onClick={onClick} style={{
      fontFamily: 'inherit', fontSize: 10, fontWeight: 700, padding: '4px 8px',
      border: `1px solid ${c}44`, borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      background: `${c}11`, color: c, whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
      textTransform: 'uppercase', letterSpacing: '0.4px',
    }}>{label}</button>
  );
}

export default function AdminPage({ onBack, onNavigate, currentPage }: AdminPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<ReportedTrade[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  // user_feedback where category = 'Help'
  const [helpTickets, setHelpTickets] = useState<FeedbackTicket[]>([]);
  // user_feedback where category = 'Feedback'
  const [feedbackTickets, setFeedbackTickets] = useState<FeedbackTicket[]>([]);
  // non-admin: own feedback tickets
  const [myTickets, setMyTickets] = useState<FeedbackTicket[]>([]);
  const [users, setUsers] = useState<AcUser[]>([]);
  const [modLogs, setModLogs] = useState<ModLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [chatTicket, setChatTicket] = useState<FeedbackTicket | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const closeDrawerRef = useRef<(() => void) | null>(null);

  const isFullAdmin = user?.user_number === 0 || user?.user_number === 2;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [reportsRes, usersRes, userReportsRes, allFeedbackRes, logsRes] = await Promise.all([
      supabase
        .from('trade_requests')
        .select('*, req:ac_users!requester_id(user_number,username), acc:ac_users!acceptor_id(user_number,username), rep:ac_users!report_by(user_number,username)')
        .eq('reported', true)
        .order('created_at', { ascending: false }),
      supabase.from('ac_users').select('id,user_number,username,trade_restricted,owned,created_at').order('user_number', { ascending: true }),
      supabase.from('user_reports').select('*,rep:ac_users!reported_id(user_number,username),rer:ac_users!reporter_id(user_number,username)').order('created_at', { ascending: false }),
      supabase.from('user_feedback').select('*,u:ac_users!user_id(user_number,username)').order('created_at', { ascending: false }),
      supabase.from('mod_logs').select('*,mod:ac_users!mod_id(user_number,username),tgt:ac_users!target_id(user_number,username)').order('created_at', { ascending: false }).limit(100),
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
    const allFb = (allFeedbackRes.data || []).map((t: any) => ({
      ...t, user_number: t.u?.user_number, username: t.u?.username,
    }));
    setHelpTickets(allFb.filter((t: FeedbackTicket) => t.category === 'Help'));
    setFeedbackTickets(allFb.filter((t: FeedbackTicket) => t.category === 'Feedback'));
    setModLogs((logsRes.data || []).map((l: any) => ({
      ...l,
      mod_username: l.mod?.username, mod_number: l.mod?.user_number,
      target_username: l.tgt?.username, target_number: l.tgt?.user_number,
    })));
    setLoading(false);
  }, []);

  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [reportsRes, myFeedbackRes] = await Promise.all([
      supabase
        .from('trade_requests')
        .select('*,req:ac_users!requester_id(user_number,username),acc:ac_users!acceptor_id(user_number,username)')
        .or(`requester_id.eq.${user.id},acceptor_id.eq.${user.id}`)
        .eq('reported', true)
        .order('created_at', { ascending: false }),
      supabase.from('user_feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setReports((reportsRes.data || []).map((r: any) => ({
      ...r,
      requester_number: r.req?.user_number, requester_username: r.req?.username,
      acceptor_number: r.acc?.user_number, acceptor_username: r.acc?.username,
    })));
    setMyTickets(myFeedbackRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isFullAdmin) loadData();
    else loadUserData();
  }, [isFullAdmin, loadData, loadUserData]);

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

  const handleFeedbackStatus = async (ticketId: string, newStatus: string) => {
    setBusy(ticketId);
    await supabase.from('user_feedback').update({ feedback_status: newStatus }).eq('id', ticketId);
    await loadData();
    setBusy(null);
  };

  const handleUserReportStatus = async (reportId: string, newStatus: string) => {
    setBusy(reportId);
    await supabase.from('user_reports').update({ status: newStatus }).eq('id', reportId);
    await loadData();
    setBusy(null);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return String(u.user_number).includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  const openProfile = useCallback(async (userId: string) => {
    setViewingProfileId(userId);
    setProfileLoading(true);
    const { data } = await supabase
      .from('ac_users')
      .select('id,user_number,username,trade_restricted,owned,favourites,wishlist,bio,island_name,avg_rating,rating_count,created_at')
      .eq('id', userId)
      .single();
    setProfileData(data || null);
    setProfileLoading(false);
  }, []);

  const navigate = (page: Page, userId?: string) => {
    if (page === 'profile' && userId) {
      openProfile(userId);
    } else if (onNavigate) {
      onNavigate(page, userId);
    }
  };
  const page = currentPage || 'admin';

  const TABS: { id: AdminTab; label: string; count?: number }[] = isFullAdmin ? [
    { id: 'reports',  label: '⚠ Reports',  count: reports.length },
    { id: 'help',     label: '🆘 Help',     count: helpTickets.length },
    { id: 'feedback', label: '💬 Feedback', count: feedbackTickets.length },
    { id: 'users',    label: '👥 Users',    count: users.length },
    { id: 'modlogs',  label: '📋 Logs' },
  ] : [];

  const drawerContent = isFullAdmin ? (
    <div style={{padding:'0 4px'}}>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:10,marginTop:4}}>Admin Sections</div>
      {TABS.map(t => (
        <div key={t.id} onClick={()=>{ setTab(t.id); closeDrawerRef.current?.(); }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer'}}>
          <span style={{flex:1,color:tab===t.id?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.7)',fontSize:14,fontWeight:tab===t.id?700:400}}>{t.label}</span>
          {t.count!==undefined&&t.count>0&&<span style={{background:'rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',borderRadius:8,padding:'1px 7px',fontSize:11}}>{t.count}</span>}
          {tab===t.id&&<span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>✓</span>}
        </div>
      ))}
    </div>
  ) : null;

  // ── Reusable feedback ticket card (used for both Help and Feedback tabs + user own tickets) ──
  const renderTicketCard = (t: FeedbackTicket, statusOptions: string[], isOwn?: boolean) => (
    <div key={t.id} className="admin-report-card">
      <div className="admin-report-header">
        <span className="admin-report-villager">{t.category || 'Ticket'}</span>
        <StatusPill status={t.feedback_status || 'open'} />
      </div>
      <div className="admin-report-reason">
        {!isOwn && <span className="admin-report-reason-label">#{t.user_number ?? '?'}{t.username ? ` · ${t.username}` : ''}</span>}
        <blockquote className="admin-report-quote">{t.message}</blockquote>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,marginTop:4}}>
        <span className="admin-report-date">{timeAgo(t.created_at)}</span>
        {isFullAdmin && (
          <StatusSwitcher current={t.feedback_status||'open'} options={statusOptions} onChange={s=>handleFeedbackStatus(t.id,s)} busy={busy===t.id} />
        )}
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
        <AB label="💬 Chat" color="#a78bfa" onClick={()=>setChatTicket(t)} />
        {!isOwn && <AB label="👤 Profile" color="#60a5fa" onClick={()=>navigate('profile', t.user_id)} />}
      </div>
    </div>
  );

  return (
    <>
    <MobileNav
      currentPage={page}
      onNavigate={navigate}
      extraFilters={drawerContent||undefined}
      onCloseDrawer={fn=>{ closeDrawerRef.current=fn; }}
    />
    <div className="admin-layout">

    {/* Desktop sidebar */}
    <div className="psb-sidebar">
      <div className="psb-sidebar-inner">
        <div className="sidebar-logo-header">
          <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
        </div>
      </div>
      <div className="sidebar-nav">
        <button className={`sidebar-nav-item ${page==='shop'?'active':''}`} onClick={()=>navigate('shop')}><span className="nav-item-icon">🛒</span><span className="nav-item-label">Market</span></button>
        <button className={`sidebar-nav-item ${page==='orders'?'active':''}`} onClick={()=>navigate('orders')}><span className="nav-item-icon">⇄</span><span className="nav-item-label">Trades</span></button>
        <button className={`sidebar-nav-item ${page==='profile'?'active':''}`} onClick={()=>navigate('profile')}><span className="nav-item-icon">👤</span><span className="nav-item-label">{user?.username||(user?`#${user.user_number}`:'Profile')}</span></button>
        <button className={`sidebar-nav-item ${page==='feedback'?'active':''}`} onClick={()=>navigate('feedback')}><span className="nav-item-icon">💬</span><span className="nav-item-label">Feedback</span></button>
        <button className={`sidebar-nav-item active`} onClick={()=>navigate('admin')}><span className="nav-item-icon">⚠</span><span className="nav-item-label">Admin</span></button>
      </div>
    </div>

    <div className="admin-page">
      <button className="page-back-btn" onClick={onBack}>←</button>

      <div className="admin-header">
        <div>
          <h1 className="admin-title">{isFullAdmin ? '⚠ Admin Panel' : '📋 My Activity'}</h1>
          <p className="admin-sub">User #{user?.user_number}</p>
        </div>
        {isFullAdmin && (
          <div className="admin-stats">
            <div className="admin-stat"><span className="admin-stat-val">{reports.length}</span><span className="admin-stat-label">Reports</span></div>
            <div className="admin-stat"><span className="admin-stat-val">{users.filter(u=>u.trade_restricted).length}</span><span className="admin-stat-label">Restricted</span></div>
            <div className="admin-stat"><span className="admin-stat-val">{users.length}</span><span className="admin-stat-label">Users</span></div>
          </div>
        )}
      </div>

      {isFullAdmin && (
        <div className="admin-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`admin-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {t.label}
              {t.count!==undefined&&t.count>0&&<span className="admin-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading…</div>

      ) : !isFullAdmin ? (
        /* ── Non-admin: own report history + own tickets ── */
        <div className="admin-list">
          {reports.length === 0 && myTickets.length === 0 ? (
            <div className="admin-empty"><div className="admin-empty-icon">✓</div><p>No activity yet</p></div>
          ) : (
            <>
              {reports.length > 0 && (
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:4}}>Trade Reports</div>
                  {reports.map(r => (
                    <div key={r.id} className="admin-report-card">
                      <div className="admin-report-header">
                        <span className="admin-report-villager">{r.villager_name}</span>
                        <StatusPill status={r.status||'open'} />
                      </div>
                      <div className="admin-report-parties">
                        <div className="admin-party"><span className="admin-party-label">Your Role</span><span className="admin-party-val">{r.requester_id===user?.id?'Requester':'Acceptor'}</span></div>
                      </div>
                      <div className="admin-report-reason"><blockquote className="admin-report-quote">"{r.report_reason}"</blockquote></div>
                      <div className="admin-report-meta"><span className="admin-report-date">{timeAgo(r.created_at)}</span></div>
                    </div>
                  ))}
                </>
              )}
              {myTickets.length > 0 && (
                <>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.7px',marginTop:12,marginBottom:4}}>My Tickets</div>
                  {myTickets.map(t => renderTicketCard(t, t.category==='Help' ? HELP_STATUSES : FEEDBACK_STATUSES, true))}
                </>
              )}
            </>
          )}
        </div>

      ) : tab === 'reports' ? (
        /* ── Admin: Trade Reports ── */
        reports.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">✓</div><p>No reported trades</p></div>
        ) : (
          <div className="admin-list">
            {reports.map(r => {
              const trader = users.find(u=>u.id===r.acceptor_id);
              const tradee = users.find(u=>u.id===r.requester_id);
              return (
                <div key={r.id} className="admin-report-card">
                  <div className="admin-report-header">
                    <span className="admin-report-villager">{r.villager_name}</span>
                    <StatusPill status={r.status||'open'} />
                  </div>
                  <div className="admin-report-parties">
                    <div className="admin-party"><span className="admin-party-label">Trader</span><span className="admin-party-val">#{r.acceptor_number??'?'}{r.acceptor_username?` · ${r.acceptor_username}`:''}</span></div>
                    <div className="admin-party-sep">↔</div>
                    <div className="admin-party"><span className="admin-party-label">Tradee</span><span className="admin-party-val">#{r.requester_number??'?'}{r.requester_username?` · ${r.requester_username}`:''}</span></div>
                  </div>
                  <div className="admin-report-reason">
                    <span className="admin-report-reason-label">Report by #{r.reporter_number??'?'}</span>
                    <blockquote className="admin-report-quote">"{r.report_reason}"</blockquote>
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:6}}>
                    <AB label="Dismiss" color="#f59e0b" disabled={busy===r.id} onClick={()=>handleDismissReport(r)} />
                    {trader && <AB label={trader.trade_restricted?'Unrestrict Trader':'Restrict Trader'} color={trader.trade_restricted?'#22c55e':'#ef4444'} disabled={busy===r.id} onClick={()=>handleToggleRestrict(trader)} />}
                    {tradee && <AB label={tradee.trade_restricted?'Unrestrict Tradee':'Restrict Tradee'} color={tradee.trade_restricted?'#22c55e':'#ef4444'} disabled={busy===r.id} onClick={()=>handleToggleRestrict(tradee)} />}
                    {r.acceptor_id && <AB label="👤 Trader" color="#60a5fa" onClick={()=>navigate('profile',r.acceptor_id)} />}
                    {r.requester_id && <AB label="👤 Tradee" color="#60a5fa" onClick={()=>navigate('profile',r.requester_id)} />}
                  </div>
                  <div className="admin-report-meta" style={{marginTop:6}}><span className="admin-report-date">{timeAgo(r.created_at)}</span></div>
                </div>
              );
            })}
          </div>
        )

      ) : tab === 'help' ? (
        /* ── Admin: Help tickets (category=Help from user_feedback) ── */
        helpTickets.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">🆘</div><p>No help tickets</p></div>
        ) : (
          <div className="admin-list">
            {helpTickets.map(t => renderTicketCard(t, HELP_STATUSES))}
          </div>
        )

      ) : tab === 'feedback' ? (
        /* ── Admin: Feedback tickets (category=Feedback from user_feedback) ── */
        feedbackTickets.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">💬</div><p>No feedback tickets</p></div>
        ) : (
          <div className="admin-list">
            {feedbackTickets.map(t => renderTicketCard(t, FEEDBACK_STATUSES))}
          </div>
        )

      ) : tab === 'users' ? (
        /* ── Admin: Users ── */
        <>
          <input className="admin-user-search" placeholder="Search by number or username…" value={userSearch} onChange={e=>setUserSearch(e.target.value)} />
          <div className="admin-list">
            {filteredUsers.map(u => (
              <div key={u.id} className={`admin-user-row ${u.trade_restricted?'restricted':''}`}>
                <div className="admin-user-info" style={{cursor:'pointer'}} onClick={()=>navigate('profile',u.id)}>
                  <span className="admin-user-num">#{u.user_number}</span>
                  {u.username&&<span className="admin-user-name">{u.username}</span>}
                  <span className="admin-user-meta">{(u.owned||[]).length} villagers</span>
                  {u.trade_restricted&&<span className="admin-restricted-badge">Restricted</span>}
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  <AB label="👤" color="#60a5fa" onClick={()=>navigate('profile',u.id)} />
                  {u.user_number!==0&&(
                    <AB label={u.trade_restricted?'Unrestrict':'Restrict'} color={u.trade_restricted?'#22c55e':'#ef4444'} disabled={busy===u.id} onClick={()=>handleToggleRestrict(u)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>

      ) : tab === 'modlogs' ? (
        /* ── Admin: Mod Logs ── */
        modLogs.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">📋</div><p>No mod actions yet</p></div>
        ) : (
          <div className="admin-list">
            {modLogs.map(l => (
              <div key={l.id} className="admin-modlog-row">
                <div className="admin-modlog-action-bar" style={{borderLeft:`3px solid ${ACTION_COLORS[l.action]||'rgba(255,255,255,0.2)'}`}}>
                  <div className="admin-modlog-top">
                    <span style={{color:ACTION_COLORS[l.action]||'rgba(255,255,255,0.6)',textTransform:'uppercase',fontSize:10,fontWeight:700,letterSpacing:'0.8px'}}>{l.action.replace('_',' ')}</span>
                    <span style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginLeft:'auto'}}>{timeAgo(l.created_at)}</span>
                  </div>
                  <div style={{color:'rgba(255,255,255,0.85)',fontSize:14,fontWeight:600,marginTop:4}}>{l.title||l.action}</div>
                  <div style={{display:'flex',gap:12,marginTop:6,flexWrap:'wrap'}}>
                    <span style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>by <strong style={{color:'rgba(255,255,255,0.7)'}}>{l.mod_username||`#${l.mod_number}`}</strong></span>
                    {l.target_id&&<span style={{color:'rgba(255,255,255,0.45)',fontSize:12}}>on <strong style={{color:'rgba(255,255,255,0.7)'}}>{l.target_username||`#${l.target_number}`}</strong></span>}
                    <span style={{color:'rgba(255,255,255,0.3)',fontSize:11}}>{new Date(l.created_at).toLocaleString()}</span>
                  </div>
                  {l.reason&&<div style={{marginTop:6,padding:'6px 10px',background:'rgba(255,255,255,0.04)',borderRadius:6,color:'rgba(255,255,255,0.5)',fontSize:12,fontStyle:'italic'}}>"{l.reason}"</div>}
                </div>
              </div>
            ))}
          </div>
        )

      ) : null}
    </div>
    </div>

    {/* Chat modal for Help/Feedback tickets */}
    {chatTicket && (
      <ChatModal
        friendshipId={`admin_${chatTicket.id}`}
        otherUser={isFullAdmin
          ? { id: chatTicket.user_id, user_number: chatTicket.user_number||0, username: chatTicket.username||'User', owned:[], favourites:[], wishlist:[] }
          : ADMIN_USER
        }
        onClose={()=>setChatTicket(null)}
      />
    )}

    {/* Inline profile panel */}
    {viewingProfileId && (
      <div style={{
        position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',
      }} onClick={()=>{ setViewingProfileId(null); setProfileData(null); }}>
        <div style={{
          width:'min(420px,100vw)',height:'100%',background:'linear-gradient(160deg,#0f1108 0%,#181a06 40%,#12140a 100%)',
          borderLeft:'1px solid rgba(255,255,255,0.1)',overflowY:'auto',padding:'24px 20px',boxSizing:'border-box',
        }} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <button onClick={()=>{ setViewingProfileId(null); setProfileData(null); }} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,color:'rgba(255,255,255,0.7)',cursor:'pointer',fontFamily:'inherit',fontSize:13,padding:'6px 12px'}}>← Back</button>
            <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>User Profile</span>
          </div>
          {profileLoading ? (
            <div style={{color:'rgba(255,255,255,0.4)',textAlign:'center',paddingTop:40}}>Loading…</div>
          ) : profileData ? (
            <>
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,padding:'16px',background:'rgba(255,255,255,0.04)',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>👤</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:16,color:'white'}}>{profileData.username || `User #${profileData.user_number}`}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>#{profileData.user_number}{profileData.island_name ? ` · ${profileData.island_name}` : ''}</div>
                  {profileData.trade_restricted && <span style={{fontSize:10,fontWeight:700,background:'rgba(239,68,68,0.15)',color:'#f87171',borderRadius:5,padding:'2px 7px',border:'1px solid rgba(239,68,68,0.25)',marginTop:4,display:'inline-block'}}>Restricted</span>}
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  {isFullAdmin && (() => {
                    const u = users.find(x=>x.id===profileData.id);
                    return u ? (
                      <AB label={u.trade_restricted?'Unrestrict':'Restrict'} color={u.trade_restricted?'#22c55e':'#ef4444'} disabled={busy===u.id} onClick={()=>handleToggleRestrict(u)} />
                    ) : null;
                  })()}
                </div>
              </div>
              {profileData.bio && (
                <div style={{marginBottom:16,padding:'12px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.7)',fontSize:13,lineHeight:1.5}}>
                  {profileData.bio}
                </div>
              )}
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:80,background:'rgba(255,255,255,0.04)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:'white'}}>{(profileData.owned||[]).length}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Owned</div>
                </div>
                <div style={{flex:1,minWidth:80,background:'rgba(255,255,255,0.04)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:'white'}}>{(profileData.favourites||[]).length}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Favourites</div>
                </div>
                <div style={{flex:1,minWidth:80,background:'rgba(255,255,255,0.04)',borderRadius:10,border:'1px solid rgba(255,255,255,0.07)',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:'white'}}>{profileData.rating_count||0}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Ratings</div>
                </div>
              </div>
              {(profileData.owned||[]).length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:8}}>Villagers Owned</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {(profileData.owned||[]).slice(0,40).map((v:string)=>(
                      <span key={v} style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:5,padding:'2px 7px',fontSize:11,color:'rgba(255,255,255,0.7)'}}>{v}</span>
                    ))}
                    {(profileData.owned||[]).length>40&&<span style={{color:'rgba(255,255,255,0.3)',fontSize:11}}>+{(profileData.owned||[]).length-40} more</span>}
                  </div>
                </div>
              )}
              <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',marginTop:8}}>Joined {new Date(profileData.created_at).toLocaleDateString()}</div>
            </>
          ) : (
            <div style={{color:'rgba(255,255,255,0.4)',textAlign:'center',paddingTop:40}}>User not found</div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
