import React, { useState, useEffect } from 'react';
import { useAuth, supabase } from './AuthContext';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

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

export default function AdminPage({ onBack, onNavigate, currentPage }: AdminPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const [reports, setReports] = useState<ReportedTrade[]>([]);
  const [users, setUsers] = useState<AcUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Users 0 & 2 are admins, others get limited view
  const isFullAdmin = user?.user_number === 0 || user?.user_number === 2;
  const isLimitedUser = user && !isFullAdmin;

  useEffect(() => {
    if (isFullAdmin) {
      loadData();
    } else if (isLimitedUser) {
      loadUserData();
    }
  }, [isFullAdmin, isLimitedUser]);

  const loadData = async () => {
    setLoading(true);
    const [reportsRes, usersRes] = await Promise.all([
      supabase
        .from('trade_requests')
        .select('*, req:ac_users!requester_id(user_number, username), acc:ac_users!acceptor_id(user_number, username), rep:ac_users!report_by(user_number, username)')
        .eq('reported', true)
        .order('completed_at', { ascending: false }),
      supabase
        .from('ac_users')
        .select('id, user_number, username, trade_restricted, owned, created_at')
        .order('user_number', { ascending: true }),
    ]);

    setReports((reportsRes.data || []).map((r: any) => ({
      ...r,
      requester_number: r.req?.user_number,
      requester_username: r.req?.username,
      acceptor_number: r.acc?.user_number,
      acceptor_username: r.acc?.username,
      reporter_number: r.rep?.user_number,
      reporter_username: r.rep?.username,
    })));
    setUsers(usersRes.data || []);
    setLoading(false);
  };

  const handleDismissReport = async (trade: ReportedTrade) => {
    setBusy(trade.id);
    await supabase.from('trade_requests').update({ reported: false, report_reason: '' }).eq('id', trade.id);
    await loadData();
    setBusy(null);
  };

  const handleToggleRestrict = async (u: AcUser) => {
    setBusy(u.id);
    await supabase.from('ac_users').update({ trade_restricted: !u.trade_restricted }).eq('id', u.id);
    await loadData();
    setBusy(null);
  };

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);
    // Load user's own reports with other party info
    const reportsRes = await supabase
      .from('trade_requests')
      .select('*, req:ac_users!requester_id(user_number, username), acc:ac_users!acceptor_id(user_number, username)')
      .or(`requester_id.eq.${user.id},acceptor_id.eq.${user.id}`)
      .eq('reported', true)
      .order('completed_at', { ascending: false });
    
    const userRes = await supabase
      .from('ac_users')
      .select('trade_restricted, created_at')
      .eq('id', user.id)
      .single();
    
    setReports((reportsRes.data || []).map((r: any) => ({
      ...r,
      requester_number: r.req?.user_number,
      requester_username: r.req?.username,
      acceptor_number: r.acc?.user_number,
      acceptor_username: r.acc?.username,
    })));
    setLoading(false);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return String(u.user_number).includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  const navigate = onNavigate || (() => {});
  const page = currentPage || 'admin';

  return (
    <div className="admin-layout">

    {/* Nav sidebar */}
    <div className="psb-sidebar">
      <div className="psb-sidebar-inner">
        {/* Logo */}
        <div className="sidebar-logo-header">
          <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
          <button className="tutorial-trigger-btn" title="Tutorial">?</button>
        </div>
      </div>
      <div className="sidebar-nav">
        <button className={`sidebar-nav-item ${page === 'shop' ? 'active' : ''}`} onClick={() => navigate('shop')} title="Market">
          <span className="nav-item-icon">🛒</span>
          <span className="nav-item-label">Market</span>
        </button>
        <button className={`sidebar-nav-item ${page === 'orders' ? 'active' : ''}`} onClick={() => navigate('orders')} title="Trades">
          <span className="nav-item-icon">⇄</span>
          <span className="nav-item-label">Trades</span>
        </button>
        <button className={`sidebar-nav-item ${page === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')} title="Profile">
          <span className="nav-item-icon">👤</span>
          <span className="nav-item-label">{user?.username || (user ? `#${user.user_number}` : 'Profile')}</span>
        </button>
        <button className={`sidebar-nav-item ${page === 'feedback' ? 'active' : ''}`} onClick={() => navigate('feedback')} title="Feedback">
          <span className="nav-item-icon">💬</span>
          <span className="nav-item-label">Feedback</span>
        </button>
        <button className={`sidebar-nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')} title="Admin">
          <span className="nav-item-icon">⚠</span>
          <span className="nav-item-label">Admin</span>
        </button>
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
              <div className="admin-stat">
                <span className="admin-stat-val">{reports.length}</span>
                <span className="admin-stat-label">Reports</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-val">{users.filter(u => u.trade_restricted).length}</span>
                <span className="admin-stat-label">Restricted</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-val">{users.length}</span>
                <span className="admin-stat-label">Total Users</span>
              </div>
            </>
          ) : (
            <>
              <div className="admin-stat">
                <span className="admin-stat-val">{reports.length}</span>
                <span className="admin-stat-label">My Reports</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat-val">--</span>
                <span className="admin-stat-label">Restriction</span>
              </div>
            </>
          )}
        </div>
      </div>

      {isFullAdmin && (
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
            Reports
            {reports.length > 0 && <span className="admin-tab-count">{reports.length}</span>}
          </button>
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            Users
            <span className="admin-tab-count">{users.length}</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading…</div>
      ) : !isFullAdmin ? (
        // Limited user view - show their reports only
        reports.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">✓</div>
            <p>No reports involving you</p>
          </div>
        ) : (
          <div className="admin-list">
            {reports.map(r => (
              <div key={r.id} className="admin-report-card">
                <div className="admin-report-header">
                  <span className="admin-report-villager">{r.villager_name}</span>
                  <span className="admin-report-status">{r.status}</span>
                </div>

                <div className="admin-report-parties">
                  <div className="admin-party">
                    <span className="admin-party-label">Your Role</span>
                    <span className="admin-party-val">
                      {r.requester_id === user?.id ? 'Requester' : 'Acceptor'}
                    </span>
                  </div>
                  <div className="admin-party-sep">↔</div>
                  <div className="admin-party">
                    <span className="admin-party-label">Other Party</span>
                    <span className="admin-party-val">
                      {r.requester_id === user?.id 
                        ? `#${r.acceptor_number ?? '?'}${r.acceptor_username ? ` · ${r.acceptor_username}` : ''}`
                        : `#${r.requester_number ?? '?'}${r.requester_username ? ` · ${r.requester_username}` : ''}`
                      }
                    </span>
                  </div>
                </div>

                <div className="admin-report-reason">
                  <span className="admin-report-reason-label">Report Reason</span>
                  <blockquote className="admin-report-quote">"{r.report_reason}"</blockquote>
                </div>

                <div className="admin-report-meta">
                  <span className="admin-report-date">
                    {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'reports' ? (
        reports.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty-icon">✓</div>
            <p>No reported trades</p>
          </div>
        ) : (
          <div className="admin-list">
            {reports.map(r => (
              <div key={r.id} className="admin-report-card">
                <div className="admin-report-header">
                  <span className="admin-report-villager">{r.villager_name}</span>
                  <span className="admin-report-status">{r.status}</span>
                </div>

                <div className="admin-report-parties">
                  <div className="admin-party">
                    <span className="admin-party-label">Trader (owner)</span>
                    <span className="admin-party-val">
                      #{r.acceptor_number ?? '?'}{r.acceptor_username ? ` · ${r.acceptor_username}` : ''}
                    </span>
                  </div>
                  <div className="admin-party-sep">↔</div>
                  <div className="admin-party">
                    <span className="admin-party-label">Tradee (requester)</span>
                    <span className="admin-party-val">
                      #{r.requester_number ?? '?'}{r.requester_username ? ` · ${r.requester_username}` : ''}
                    </span>
                  </div>
                </div>

                <div className="admin-report-reason">
                  <span className="admin-report-reason-label">Report by #{r.reporter_number ?? '?'}</span>
                  <blockquote className="admin-report-quote">"{r.report_reason}"</blockquote>
                </div>

                <div className="admin-report-actions">
                  <button
                    className="admin-btn dismiss"
                    disabled={busy === r.id}
                    onClick={() => handleDismissReport(r)}
                  >
                    Dismiss Report
                  </button>
                  {r.acceptor_id && (
                    <button
                      className="admin-btn restrict"
                      disabled={busy === r.id}
                      onClick={() => {
                        const u = users.find(u => u.id === r.acceptor_id);
                        if (u) handleToggleRestrict(u);
                      }}
                    >
                      {users.find(u => u.id === r.acceptor_id)?.trade_restricted ? 'Unrestrict Trader' : 'Restrict Trader'}
                    </button>
                  )}
                  {r.requester_id && (
                    <button
                      className="admin-btn restrict"
                      disabled={busy === r.id}
                      onClick={() => {
                        const u = users.find(u => u.id === r.requester_id);
                        if (u) handleToggleRestrict(u);
                      }}
                    >
                      {users.find(u => u.id === r.requester_id)?.trade_restricted ? 'Unrestrict Tradee' : 'Restrict Tradee'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <input
            className="admin-user-search"
            placeholder="Search by user number or username…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
          />
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
                  <button
                    className={`admin-btn ${u.trade_restricted ? 'unrestrict' : 'restrict'}`}
                    disabled={busy === u.id}
                    onClick={() => handleToggleRestrict(u)}
                  >
                    {u.trade_restricted ? 'Unrestrict' : 'Restrict'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    </div>
  );
}
