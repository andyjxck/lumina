import React, { useState, useEffect } from 'react';
import './App.css';
import { VILLAGERS, UNAVAILABLE_VILLAGERS } from './villagers.js';
import { VILLAGERS_DATA, SPECIES_ICONS } from './villagerData.js';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from './AuthContext';
import { NotificationProvider } from './notifications';
import LoginPage from './LoginPage';
import ProfilePage from './ProfilePage';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import VillagerGrid from './VillagerGrid';
import TradesPage from './TradesPage';
import AdminPage from './AdminPage';
import FeedbackPage from './FeedbackPage';
import bgImage from './bg.png';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

function ShopInner() {
  const { user, loading: authLoading } = useAuth();
  const [basket, setBasket] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [offers, setOffers] = useState<Record<string, string>>({});
  const [offerTypes, setOfferTypes] = useState<Record<string, 'bells' | 'nmt' | 'other' | 'no_offer'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [plotAvailable, setPlotAvailable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('shop');
  const [viewingUserId, setViewingUserId] = useState<string | undefined>();

  // Hash routing - sync page state with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash) {
        const [pageName, userId] = hash.split('/');
        if (pageName && ['shop', 'profile', 'login', 'orders', 'admin', 'feedback'].includes(pageName)) {
          setPage(pageName as Page);
          if (userId) {
            setViewingUserId(userId);
          }
        }
      } else {
        setPage('shop');
        setViewingUserId(undefined);
      }
    };

    // Set initial page from hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when page changes
  useEffect(() => {
    const hash = viewingUserId ? `#${page}/${viewingUserId}` : `#${page}`;
    window.location.hash = hash.slice(1); // Remove # for cleaner URL
  }, [page, viewingUserId]);

  useEffect(() => {
    if (!authLoading && !user && page !== 'login') setPage('shop');
  }, [authLoading, user, page]);

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
    
    console.log('Current user data:', user);
    console.log('User ID:', user.id);
    console.log('User number:', user.user_number);

    // Verify user exists in ac_users table
    const { data: userCheck, error: userCheckError } = await supabase
      .from('ac_users')
      .select('id, user_number, username')
      .eq('id', user.id)
      .single();
    
    console.log('User verification:', { userCheck, userCheckError });
    
    if (userCheckError || !userCheck) {
      console.error('User not found in ac_users table!');
      setSubmitting(false);
      return;
    }

    // Check for existing active (open/ongoing) requests by this user for any of the basket villagers
    const { data: existing, error: existingError } = await supabase
      .from('trade_requests')
      .select('villager_name, status')
      .eq('requester_id', user.id)
      .in('status', ['open', 'ongoing'])
      .in('villager_name', basket);

    console.log('Existing requests check:', { existing, existingError, basket });
    
    if (existingError) {
      console.error('Error checking existing requests:', existingError);
    }

    const alreadyActive = new Set((existing || []).map((r: any) => r.villager_name));
    console.log('Already active villagers:', Array.from(alreadyActive));
    console.log('Basket before filtering:', basket);
    const filteredBasket = basket.filter(v => !alreadyActive.has(v));
    console.log('Basket after filtering:', filteredBasket);
    
    const newRows = filteredBasket
      .map(villager => {
        const offerType = offerTypes[villager] || 'bells';
        let offerText = '';
        
        if (offerType === 'no_offer') {
          offerText = 'No offer - requesting for free';
        } else if (offerType === 'bells' || offerType === 'nmt') {
          offerText = offers[villager] || '';
        } else {
          offerText = offers[villager] || '';
        }
        
        return {
          requester_id: user.id,
          villager_name: villager,
          offer_text: offerText,
          status: 'open',
          trade_step: 1,
          plot_available: plotAvailable,
          dodo_code: '',
        };
      });

    if (newRows.length > 0) {
      console.log('Inserting trade requests:', newRows);
      console.log('User ID:', user.id);
      console.log('Plot available:', plotAvailable);
      
      const { data, error } = await supabase.from('trade_requests').insert(newRows);
      
      if (error) {
        console.error('Error inserting trade requests:', error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Error code:', error.code);
      } else {
        console.log('Successfully inserted trade requests:', data);
      }
    } else {
      console.log('No new rows to insert - all villagers already have active requests');
    }
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setBasket([]);
      setOffers({});
      setOfferTypes({});
      setPlotAvailable(false);
      setCheckoutOpen(false);
      setCartOpen(false);
      setSubmitted(false);
      setPage('orders'); // Navigate to trades page to see the new request
    }, 2000);
  };

  if (page === 'login') return <LoginPage onLogin={() => setPage('shop')} onBack={() => setPage('shop')} />;
  if (page === 'profile') return <ProfilePage onBack={() => { setPage('shop'); setViewingUserId(undefined); }} onNavigate={(newPage, userId) => { setPage(newPage); setViewingUserId(userId); }} currentPage={page} viewingUserId={viewingUserId} />;
  if (page === 'orders') return <TradesPage onBack={() => setPage('shop')} onNavigate={setPage} currentPage={page} />;
  if (page === 'admin') return <AdminPage onBack={() => setPage('shop')} onNavigate={(newPage, userId) => { setPage(newPage); if (userId) setViewingUserId(userId); }} currentPage={page} />;
  if (page === 'feedback') return <FeedbackPage onBack={() => setPage('shop')} onNavigate={setPage} currentPage={page} />;

  return (
    <div className="app-layout">
      {/* Web Sidebar - hidden on mobile */}
      <div className="web-sidebar-only">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showSearch={showSearch}
          onSearchFocus={() => setShowSearch(true)}
          searchResults={getFilteredVillagers()}
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
          onNavigate={(newPage, userId) => { setPage(newPage); setViewingUserId(userId); }}
          currentPage={page}
        />
      </div>

      {/* Mobile Navigation - shown on mobile */}
      <div className="mobile-nav-only">
        <MobileNav
          currentPage={page}
          onNavigate={(p) => setPage(p)}
          selectedSpecies={selectedSpecies}
          setSelectedSpecies={setSelectedSpecies}
          selectedPersonalities={selectedPersonalities}
          setSelectedPersonalities={setSelectedPersonalities}
          selectedGenders={selectedGenders}
          setSelectedGenders={setSelectedGenders}
        />
      </div>

      <main className={`main-content ${sidebarOpen ? 'with-sidebar' : ''}`}>
        {/* Mobile Search Bar - only show on mobile */}
        <div className="mobile-search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search villagers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="mobile-search-input"
          />
          {searchTerm && (
            <button className="mobile-search-clear" onClick={() => setSearchTerm('')}>
              ✕
            </button>
          )}
        </div>

        <VillagerGrid
          villagers={getFilteredVillagers()}
          basket={basket}
          onToggleBasket={toggleBasket}
          expandedCard={expandedCard}
          onExpandCard={setExpandedCard}
          sidebarOpen={sidebarOpen}
        />
      </main>

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="checkout-overlay" onClick={() => !submitting && setCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={e => e.stopPropagation()}>
            <div className="checkout-header">
              <h2 className="checkout-title">Offer</h2>
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
                    const offerType = offerTypes[villager] || 'bells';
                    return (
                      <div key={villager} className="checkout-item">
                        <div className={`checkout-item-icon ${vData?.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
                          <span className="villager-icon-emoji">
                            {(SPECIES_ICONS as any)[vData?.species || ''] || '🏘️'}
                          </span>
                        </div>
                        <div className="checkout-item-info">
                          <span className="checkout-item-name">{villager}</span>
                          <div className="offer-type-buttons">
                            <button
                              className={`offer-type-btn ${offerType === 'bells' ? 'active' : ''}`}
                              onClick={() => setOfferTypes(prev => ({ ...prev, [villager]: 'bells' }))}
                            >
                              Bells
                            </button>
                            <button
                              className={`offer-type-btn ${offerType === 'nmt' ? 'active' : ''}`}
                              onClick={() => setOfferTypes(prev => ({ ...prev, [villager]: 'nmt' }))}
                            >
                              NMT
                            </button>
                            <button
                              className={`offer-type-btn ${offerType === 'other' ? 'active' : ''}`}
                              onClick={() => setOfferTypes(prev => ({ ...prev, [villager]: 'other' }))}
                            >
                              Other
                            </button>
                            <button
                              className={`offer-type-btn ${offerType === 'no_offer' ? 'active' : ''}`}
                              onClick={() => setOfferTypes(prev => ({ ...prev, [villager]: 'no_offer' }))}
                            >
                              No Offer
                            </button>
                          </div>
                          {offerType === 'no_offer' ? (
                            <div className="no-offer-message">
                              <span>No offer - requesting for free</span>
                            </div>
                          ) : (offerType === 'bells' || offerType === 'nmt') ? (
                            <input
                              type="number"
                              className="checkout-amount-input"
                              placeholder="Amount"
                              value={offers[villager] || ''}
                              onChange={e => setOffers(prev => ({ ...prev, [villager]: e.target.value }))}
                              min="1"
                            />
                          ) : (
                            <textarea
                              className="checkout-offer-input"
                              placeholder={`Your offer for ${villager}…`}
                              value={offers[villager] || ''}
                              onChange={e => setOffers(prev => ({ ...prev, [villager]: e.target.value }))}
                              rows={2}
                            />
                          )}
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
                <div className="checkout-checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={plotAvailable}
                      onChange={e => setPlotAvailable(e.target.checked)}
                    />
                    I have or can have a plot available
                  </label>
                </div>
                <button
                  className="request-btn"
                  onClick={handleCheckout}
                  disabled={submitting || !user || !plotAvailable}
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
  // Set CSS variable for background image
  useEffect(() => {
    document.documentElement.style.setProperty('--bg-image', `url(${bgImage})`);
  }, [bgImage]);

  return (
    <AuthProvider>
      <NotificationProvider>
        <div className="min-h-screen app-bg">
          <ShopInner />
        </div>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
