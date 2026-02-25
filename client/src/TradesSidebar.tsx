import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin';

interface TradesSidebarProps {
  tab: 'incoming' | 'my' | 'ongoing' | 'history';
  incoming: any[];
  myRequests: any[];
  ongoingTrades: any[];
  historyTrades: any[];
  onFilter: (filtered: any[]) => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

export default function TradesSidebar({ tab, incoming, myRequests, ongoingTrades, historyTrades, onFilter, onNavigate, currentPage }: TradesSidebarProps) {
  const { user } = useAuth();
  const [villagerFilter, setVillagerFilter] = useState('');
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reset all filters when the active tab changes
  useEffect(() => {
    setVillagerFilter('');
    setAwaitingOnly(false);
    setStatusFilter('all');
  }, [tab]);

  const list = tab === 'incoming' ? incoming : tab === 'my' ? myRequests : tab === 'ongoing' ? ongoingTrades : historyTrades;

  // Collect unique villager names from current list for quick-pick
  const uniqueVillagers = Array.from(new Set(list.map((t: any) => t.villager_name))).sort() as string[];

  const applyFilters = (vFilter = villagerFilter, awaiting = awaitingOnly, status = statusFilter) => {
    let filtered = [...list];

    if (vFilter) {
      filtered = filtered.filter(t => t.villager_name.toLowerCase().includes(vFilter.toLowerCase()));
    }

    if (awaiting && tab === 'ongoing') {
      filtered = filtered.filter(t => {
        if (!user) return false;
        const isTrader = t.acceptor_id === user.id;
        const isTradee = t.requester_id === user.id;
        const step = t.trade_step ?? 1;
        if (isTrader && (step === 1 || step === 3)) return true;
        if (isTradee && step === 2) return true;
        return false;
      });
    }

    if (status !== 'all') {
      filtered = filtered.filter(t => t.status === status);
    }

    onFilter(filtered);
  };

  const handleVillager = (v: string) => {
    const newVal = villagerFilter === v ? '' : v;
    setVillagerFilter(newVal);
    applyFilters(newVal, awaitingOnly, statusFilter);
  };

  const handleAwaiting = () => {
    const next = !awaitingOnly;
    setAwaitingOnly(next);
    applyFilters(villagerFilter, next, statusFilter);
  };

  const handleStatus = (s: string) => {
    setStatusFilter(s);
    applyFilters(villagerFilter, awaitingOnly, s);
  };

  const handleReset = () => {
    setVillagerFilter('');
    setAwaitingOnly(false);
    setStatusFilter('all');
    onFilter(list);
  };

  const activeFilterCount = [
    villagerFilter ? 1 : 0,
    awaitingOnly ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="tsb-sidebar">
      <div className="tsb-sidebar-inner">
      <div className="tsb-header">
        <span className="tsb-title">Filters</span>
        {activeFilterCount > 0 && (
          <button className="tsb-reset" onClick={handleReset}>Clear ({activeFilterCount})</button>
        )}
      </div>

      {/* Awaiting action — only on ongoing */}
      {tab === 'ongoing' && (
        <div className="tsb-section">
          <div className="tsb-section-label">Quick</div>
          <button
            className={`tsb-filter-pill ${awaitingOnly ? 'active' : ''}`}
            onClick={handleAwaiting}
          >
            ⏳ Awaiting my action
          </button>
        </div>
      )}

      {/* Status filter — history */}
      {tab === 'history' && (
        <div className="tsb-section">
          <div className="tsb-section-label">Status</div>
          {(['all', 'completed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              className={`tsb-filter-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => handleStatus(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Villager search */}
      <div className="tsb-section">
        <div className="tsb-section-label">Villager</div>
        <input
          className="tsb-villager-input"
          placeholder="Search villager…"
          value={villagerFilter}
          onChange={e => {
            setVillagerFilter(e.target.value);
            applyFilters(e.target.value, awaitingOnly, statusFilter);
          }}
        />
        <div className="tsb-villager-pills">
          {uniqueVillagers.slice(0, 15).map(v => (
            <button
              key={v}
              className={`tsb-filter-pill small ${villagerFilter === v ? 'active' : ''}`}
              onClick={() => handleVillager(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="tsb-summary">
        {activeFilterCount > 0
          ? `${list.filter(t => {
              if (villagerFilter && !t.villager_name.toLowerCase().includes(villagerFilter.toLowerCase())) return false;
              return true;
            }).length} of ${list.length} shown`
          : `${list.length} total`
        }
      </div>

      </div>{/* end tsb-sidebar-inner */}

      {/* Spacer pushes nav to bottom */}
      <div style={{flex:1}} />

      {/* Nav footer */}
      <div className="sidebar-nav">
        <button className={`sidebar-nav-item ${currentPage === 'shop' ? 'active' : ''}`} onClick={() => onNavigate('shop')} title="Marketplace">
          <span className="nav-item-icon">🛒</span>
          <span className="nav-item-label">Marketplace</span>
        </button>
        <button className={`sidebar-nav-item ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => onNavigate('orders')} title="Trades">
          <span className="nav-item-icon">⇄</span>
          <span className="nav-item-label">Trades</span>
        </button>
        <button className={`sidebar-nav-item ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => onNavigate('profile')} title="Profile">
          <span className="nav-item-icon">👤</span>
          <span className="nav-item-label">{user?.username || (user ? `#${user.user_number}` : 'Profile')}</span>
        </button>
        {user?.user_number === 0 && (
          <button className={`sidebar-nav-item ${currentPage === 'admin' ? 'active' : ''}`} onClick={() => onNavigate('admin')} title="Admin">
            <span className="nav-item-icon">⚠</span>
            <span className="nav-item-label">Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
