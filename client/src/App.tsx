import React, { useState, useEffect } from 'react';
import './App.css';
import { VILLAGERS, UNAVAILABLE_VILLAGERS } from './villagers.js';
import { VILLAGERS_DATA, SPECIES_ICONS } from './villagerData.js';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from './AuthContext';
import LoginPage from './LoginPage';
import ProfilePage from './ProfilePage';
import Sidebar from './Sidebar';
import VillagerGrid from './VillagerGrid';
import TradesPage from './TradesPage';
import AdminPage from './AdminPage';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin';

function ShopInner() {
  const { user } = useAuth();
  const [basket, setBasket] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [offers, setOffers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('shop');

  useEffect(() => {
    if (!user) setPage('shop');
  }, [user]);

  const getFilteredVillagers = () => {
    let filtered = [...VILLAGERS];
    if (searchTerm) filtered = filtered.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedSpecies.length > 0) filtered = filtered.filter(v => selectedSpecies.includes(VILLAGERS_DATA[v as keyof typeof VILLAGERS_DATA]?.species || ''));
    if (selectedPersonalities.length > 0) filtered = filtered.filter(v => selectedPersonalities.includes(VILLAGERS_DATA[v as keyof typeof VILLAGERS_DATA]?.personality || ''));
    if (selectedGenders.length > 0) filtered = filtered.filter(v => selectedGenders.includes(VILLAGERS_DATA[v as keyof typeof VILLAGERS_DATA]?.gender || ''));
    return filtered;
  };

  const searchResults = searchTerm ? getFilteredVillagers().slice(0, 10) : [];

  const toggleBasket = (villager: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (UNAVAILABLE_VILLAGERS.includes(villager)) return;
    setBasket(prev => prev.includes(villager) ? prev.filter(v => v !== villager) : [...prev, villager]);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const sidebarEl = document.querySelector('.sidebar');
      if (sidebarEl && !sidebarEl.contains(target)) {
        setShowSearch(false);
        setOpenFilter(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCheckout = async () => {
    if (!user) { setPage('login'); return; }
    setSubmitting(true);

    // Check for existing active (open/ongoing) requests by this user for any of the basket villagers
    const { data: existing } = await supabase
      .from('trade_requests')
      .select('villager_name')
      .eq('requester_id', user.id)
      .in('status', ['open', 'ongoing'])
      .in('villager_name', basket);

    const alreadyActive = new Set((existing || []).map((r: any) => r.villager_name));
    const newRows = basket
      .filter(v => !alreadyActive.has(v))
      .map(villager => ({
        requester_id: user.id,
        villager_name: villager,
        offer_text: offers[villager] || '',
        status: 'open',
      }));

    if (newRows.length > 0) {
      await supabase.from('trade_requests').insert(newRows);
    }
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setBasket([]);
      setOffers({});
      setCheckoutOpen(false);
      setCartOpen(false);
      setSubmitted(false);
    }, 2000);
  };

  if (page === 'login') return <LoginPage onLogin={() => setPage('shop')} onBack={() => setPage('shop')} />;
  if (page === 'profile') return <ProfilePage onBack={() => setPage('shop')} onNavigate={setPage} currentPage={page} />;
  if (page === 'orders') return <TradesPage onBack={() => setPage('shop')} onNavigate={setPage} currentPage={page} />;
  if (page === 'admin') return <AdminPage onBack={() => setPage('shop')} onNavigate={setPage} currentPage={page} />;

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        showSearch={showSearch}
        onSearchFocus={() => setShowSearch(true)}
        searchResults={searchResults}
        basket={basket}
        onToggleBasket={toggleBasket}
        selectedSpecies={selectedSpecies}
        setSelectedSpecies={setSelectedSpecies}
        selectedPersonalities={selectedPersonalities}
        setSelectedPersonalities={setSelectedPersonalities}
        selectedGenders={selectedGenders}
        setSelectedGenders={setSelectedGenders}
        openFilter={openFilter}
        setOpenFilter={setOpenFilter}
        onNavigate={setPage}
        currentPage={page}
      />

      <main className={`main-content ${sidebarOpen ? 'with-sidebar' : ''}`}>
        <VillagerGrid
          villagers={getFilteredVillagers()}
          basket={basket}
          onToggleBasket={toggleBasket}
          expandedCard={expandedCard}
          onExpandCard={setExpandedCard}
        />
      </main>

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="checkout-overlay" onClick={() => !submitting && setCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={e => e.stopPropagation()}>
            <div className="checkout-header">
              <h2 className="checkout-title">Trade Request</h2>
              <button className="checkout-close" onClick={() => setCheckoutOpen(false)}>✕</button>
            </div>
            {submitted ? (
              <div className="checkout-success">
                <div className="checkout-success-icon">✓</div>
                <p>Trade requests sent!</p>
                <p className="checkout-success-sub">Owners will be notified and can accept your offer.</p>
              </div>
            ) : (
              <>
                <p className="checkout-sub">Leave an offer message for each villager's owner</p>
                <div className="checkout-items">
                  {basket.map(villager => {
                    const vData = VILLAGERS_DATA[villager as keyof typeof VILLAGERS_DATA];
                    return (
                      <div key={villager} className="checkout-item">
                        <div className={`checkout-item-icon ${vData?.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
                          <span className="villager-icon-emoji">
                            {(SPECIES_ICONS as any)[vData?.species || ''] || '🏘️'}
                          </span>
                        </div>
                        <div className="checkout-item-info">
                          <span className="checkout-item-name">{villager}</span>
                          <textarea
                            className="checkout-offer-input"
                            placeholder={`Your offer for ${villager}…`}
                            value={offers[villager] || ''}
                            onChange={e => setOffers(prev => ({ ...prev, [villager]: e.target.value }))}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!user && (
                  <p className="checkout-login-note">
                    You need to <button className="link-btn" onClick={() => { setCheckoutOpen(false); setPage('login'); }}>log in</button> to send trade requests.
                  </p>
                )}
                <button
                  className="request-btn"
                  onClick={handleCheckout}
                  disabled={submitting || !user}
                >
                  {submitting ? 'Sending…' : `Send ${basket.length} Trade Request${basket.length !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cart pill */}
      {basket.length > 0 && (
        <div className={`cart-pill-wrap ${cartOpen ? 'cart-expanded' : ''}`}>
          {cartOpen && (
            <div className="cart-panel">
              <div className="cart-panel-header">
                <span className="cart-panel-title">Cart</span>
                <button className="cart-panel-close" onClick={() => setCartOpen(false)}>✕</button>
              </div>
              <div className="cart-panel-grid">
                {basket.map(villager => {
                  const vData = VILLAGERS_DATA[villager as keyof typeof VILLAGERS_DATA];
                  return (
                    <div key={villager} className="cart-card">
                      <div className={`cart-card-icon ${vData?.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
                        <span className="villager-icon-emoji">
                          {(SPECIES_ICONS as any)[vData?.species || ''] || '🏘️'}
                        </span>
                      </div>
                      <span className="cart-card-name">{villager}</span>
                      <button className="cart-card-remove" onClick={e => toggleBasket(villager, e)}>✕</button>
                    </div>
                  );
                })}
              </div>
              <button className="request-btn" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                Request Trade →
              </button>
            </div>
          )}
          <button className="cart-pill" onClick={() => setCartOpen(o => !o)}>
            <span className="cart-pill-icon">🛒</span>
            <span className="cart-pill-count">{basket.length} villager{basket.length !== 1 ? 's' : ''}</span>
            <span className="cart-pill-arrow">{cartOpen ? '▼' : '▲'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen app-bg">
        <ShopInner />
      </div>
    </AuthProvider>
  );
}

export default App;
