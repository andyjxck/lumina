import React, { useState, useEffect } from 'react';
import { SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData, VILLAGERS_DATA } from './villagerData.js';
import { UNAVAILABLE_VILLAGERS } from './villagers.js';
import { useAuth, supabase } from './AuthContext';

const FEMALE_PERSONALITIES = ['Snooty', 'Uchi', 'Peppy', 'Normal'];
const MALE_PERSONALITIES = ['Cranky', 'Lazy', 'Jock', 'Smug'];

function getIcon(iconMap: any, key: string) {
  return iconMap[key as keyof typeof iconMap] || '';
}

function getVillagerData(name: string) {
  return VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);
}

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

interface MobileNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedSpecies?: string[];
  setSelectedSpecies?: (v: string[] | ((prev: string[]) => string[])) => void;
  selectedPersonalities?: string[];
  setSelectedPersonalities?: (v: string[] | ((prev: string[]) => string[])) => void;
  selectedGenders?: string[];
  setSelectedGenders?: (v: string[] | ((prev: string[]) => string[])) => void;
  extraFilters?: React.ReactNode;
}

export default function MobileNav({
  currentPage,
  onNavigate,
  selectedSpecies = [],
  setSelectedSpecies = () => {},
  selectedPersonalities = [],
  setSelectedPersonalities = () => {},
  selectedGenders = [],
  setSelectedGenders = () => {},
  extraFilters,
}: MobileNavProps) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get page-specific content for mobile nav
  const getPageContent = () => {
    switch (currentPage) {
      case 'shop':
        return {
          title: 'Marketplace',
          showFilters: true,
          showCategories: true,
          extraContent: null
        };
      case 'profile':
        return {
          title: user ? (user.username || `#${user.user_number}`) : 'Profile',
          showFilters: false,
          showCategories: false,
          extraContent: 'ranks_friends'
        };
      case 'orders':
        return {
          title: 'Trades',
          showFilters: false,
          showCategories: false,
          extraContent: null
        };
      case 'feedback':
        return {
          title: 'Feedback',
          showFilters: false,
          showCategories: false,
          extraContent: 'feedback_cards'
        };
      case 'admin':
        return {
          title: 'Admin',
          showFilters: false,
          showCategories: false,
          extraContent: 'feedback_cards'
        };
      default:
        return {
          title: 'Menu',
          showFilters: false,
          showCategories: false,
          extraContent: null
        };
    }
  };

  const pageContent = getPageContent();
  // Prevent body scroll when dropdown is open
  useEffect(() => {
    if (dropdownOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
    };
  }, [dropdownOpen]);

  const NavItem = ({ icon, label, active, onClick, badge }: { 
    icon: string; 
    label: string; 
    active?: boolean; 
    onClick?: () => void;
    badge?: number;
  }) => (
    <button className={`mobnav-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mobnav-nav-icon">{icon}</span>
      <span className="mobnav-nav-label">{label}</span>
      {badge && badge > 0 && <span className="mobnav-nav-badge">{badge}</span>}
    </button>
  );

  return (
    <>
      {/* Floating pill */}
      <div className="mobnav-pill-wrap">
        <button className="mobnav-pill" onClick={() => setDropdownOpen(!dropdownOpen)}>
          <span className="mobnav-pill-icon">🛒</span>
          <span>Menu</span>
          <span className="mobnav-pill-arrow">{dropdownOpen ? '▼' : '▲'}</span>
        </button>
      </div>

      {/* Backdrop */}
      {dropdownOpen && <div className="mobnav-backdrop" onClick={() => setDropdownOpen(false)} />}

      {/* Top Drawer */}
      {dropdownOpen && (
        <div className="mobnav-drawer">
          {/* Logo header */}
          <div className="mobnav-logo-header">
            <img src="/logo192.png" alt="Dreamie Store" className="mobnav-logo-img" />
          </div>

          {/* Page Title */}
          <div className="mobnav-page-title">
            <h2>{pageContent.title}</h2>
          </div>

          {/* Navigation - always show navigation tabs */}
          <div className="mobnav-nav">
            <NavItem icon="🛒" label="Market" active={currentPage === 'shop'} onClick={() => { onNavigate('shop'); setDropdownOpen(false); }} />
            <NavItem icon="⇄" label="Trades" active={currentPage === 'orders'} onClick={() => { onNavigate('orders'); setDropdownOpen(false); }} />
            <NavItem 
              icon="👤"
              label={user ? (user.username || `#${user.user_number}`) : 'Log In'}
              active={currentPage === 'profile' || currentPage === 'login'}
              onClick={() => { onNavigate(user ? 'profile' : 'login'); setDropdownOpen(false); }}
            />
            <NavItem icon="💬" label="Feedback" active={currentPage === 'feedback'} onClick={() => { onNavigate('feedback'); setDropdownOpen(false); }} />
            {user?.user_number === 0 && (
              <NavItem icon="⚠" label="Admin" active={currentPage === 'admin'} onClick={() => { onNavigate('admin'); setDropdownOpen(false); }} />
            )}
          </div>

          {/* Extra filters (e.g. trades) */}
          {extraFilters && (
            <div className="mobnav-filters">
              {extraFilters}
            </div>
          )}

          {/* Page-specific content */}
          {pageContent.showFilters && (
            <div className="mobnav-filters">
              <div className="mobnav-filter-section">
                <div className="mobnav-filter-label">Gender</div>
                <div className="mobnav-filter-chips">
                  <button
                    className={`mobnav-filter-chip ${selectedGenders.includes('male') ? 'active' : ''}`}
                    onClick={() => setSelectedGenders((prev: string[]) => 
                      prev.includes('male') ? prev.filter((g: string) => g !== 'male') : [...prev, 'male']
                    )}
                  >
                    Male
                  </button>
                  <button
                    className={`mobnav-filter-chip ${selectedGenders.includes('female') ? 'active' : ''}`}
                    onClick={() => setSelectedGenders((prev: string[]) => 
                      prev.includes('female') ? prev.filter((g: string) => g !== 'female') : [...prev, 'female']
                    )}
                  >
                    Female
                  </button>
                </div>
              </div>

              <div className="mobnav-filter-section">
                <div className="mobnav-filter-label">Personality</div>
                <div className="mobnav-filter-chips">
                  {['Lazy', 'Normal', 'Peppy', 'Snooty', 'Cranky', 'Jock', 'Smug', 'Uchi'].map(personality => (
                    <button
                      key={personality}
                      className={`mobnav-filter-chip ${selectedPersonalities.includes(personality) ? 'active' : ''}`}
                      onClick={() => setSelectedPersonalities((prev: string[]) => 
                        prev.includes(personality) ? prev.filter((p: string) => p !== personality) : [...prev, personality]
                      )}
                    >
                      {personality}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mobnav-filter-section">
                <div className="mobnav-filter-label">Species</div>
                <div className="mobnav-filter-chips">
                  {['Cat', 'Dog', 'Elephant', 'Fox', 'Frog', 'Hamster', 'Horse', 'Koala', 'Lion', 'Monkey', 'Octopus', 'Penguin', 'Rabbit', 'Rhino', 'Tiger', 'Wolf'].map(species => (
                    <button
                      key={species}
                      className={`mobnav-filter-chip ${selectedSpecies.includes(species) ? 'active' : ''}`}
                      onClick={() => setSelectedSpecies((prev: string[]) => 
                        prev.includes(species) ? prev.filter((s: string) => s !== species) : [...prev, species]
                      )}
                    >
                      {species}
                    </button>
                  ))}
                </div>
              </div>
              
              {(selectedSpecies.length > 0 || selectedPersonalities.length > 0 || selectedGenders.length > 0) && (
                <button className="mobnav-clear-filters" onClick={() => {
                  setSelectedSpecies([]);
                  setSelectedPersonalities([]);
                  setSelectedGenders([]);
                }}>
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {pageContent.extraContent === 'ranks_friends' && (
            <div className="mobnav-extra-content">
              <div className="mobnav-section">
                <div className="mobnav-section-label">My Rank</div>
                <div className="mobnav-rank-info">
                  <div className="mobnav-rank-badge">🌟 Gold</div>
                  <div className="mobnav-rank-details">Level 42</div>
                </div>
              </div>
              <div className="mobnav-section">
                <div className="mobnav-section-label">My Friends</div>
                <div className="mobnav-friends-list">
                  <div className="mobnav-friend-item">
                    <span className="mobnav-friend-avatar">👤</span>
                    <span className="mobnav-friend-name">Alice</span>
                    <span className="mobnav-friend-status online">●</span>
                  </div>
                  <div className="mobnav-friend-item">
                    <span className="mobnav-friend-avatar">👤</span>
                    <span className="mobnav-friend-name">Bob</span>
                    <span className="mobnav-friend-status offline">●</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pageContent.extraContent === 'feedback_cards' && (
            <div className="mobnav-extra-content">
              <div className="mobnav-section">
                <div className="mobnav-section-label">Recent Feedback</div>
                <div className="mobnav-feedback-list">
                  <div className="mobnav-feedback-item">
                    <div className="mobnav-feedback-category">Help</div>
                    <div className="mobnav-feedback-preview">How do I trade villagers?</div>
                    <div className="mobnav-feedback-status">Open</div>
                  </div>
                  <div className="mobnav-feedback-item">
                    <div className="mobnav-feedback-category">Bug</div>
                    <div className="mobnav-feedback-preview">App crashes on profile page</div>
                    <div className="mobnav-feedback-status">In Progress</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Close handle */}
          <div className="mobnav-drawer-handle">
            <button onClick={() => setDropdownOpen(false)} className="mobnav-close-btn">
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
