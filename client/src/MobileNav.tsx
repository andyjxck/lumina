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
  selectedSpecies: string[];
  setSelectedSpecies: (v: string[]) => void;
  selectedPersonalities: string[];
  setSelectedPersonalities: (v: string[]) => void;
  selectedGenders: string[];
  setSelectedGenders: (v: string[]) => void;
}

export default function MobileNav({
  currentPage,
  onNavigate,
  selectedSpecies,
  setSelectedSpecies,
  selectedPersonalities,
  setSelectedPersonalities,
  selectedGenders,
  setSelectedGenders,
}: MobileNavProps) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

          {/* Navigation - same order as web sidebar */}
          <div className="mobnav-nav">
            <NavItem icon="🛒" label="Market" active={currentPage === 'shop'} onClick={() => { onNavigate('shop'); setDropdownOpen(false); }} />
            <NavItem icon="⇄" label="Trades" active={currentPage === 'orders'} onClick={() => { onNavigate('orders'); setDropdownOpen(false); }} />
            <NavItem 
              icon="👤"
              label={user ? (user.username || `#${user.user_number}`) : 'Profile'}
              active={currentPage === 'profile'}
              onClick={() => { onNavigate('profile'); setDropdownOpen(false); }}
            />
            <NavItem icon="💬" label="Feedback" active={currentPage === 'feedback'} onClick={() => { onNavigate('feedback'); setDropdownOpen(false); }} />
            {user?.user_number === 0 && (
              <NavItem icon="⚠" label="Admin" active={currentPage === 'admin'} onClick={() => { onNavigate('admin'); setDropdownOpen(false); }} />
            )}
          </div>

          {/* Filters */}
          <div className="mobnav-filters">
            <div className="mobnav-filter-section">
              <div className="mobnav-filter-label">Gender</div>
              <div className="mobnav-filter-chips">
                <button
                  className={`mobnav-filter-chip ${selectedGenders.includes('male') ? 'active' : ''}`}
                  onClick={() => setSelectedGenders(prev => 
                    prev.includes('male') ? prev.filter(g => g !== 'male') : [...prev, 'male']
                  )}
                >
                  Male
                </button>
                <button
                  className={`mobnav-filter-chip ${selectedGenders.includes('female') ? 'active' : ''}`}
                  onClick={() => setSelectedGenders(prev => 
                    prev.includes('female') ? prev.filter(g => g !== 'female') : [...prev, 'female']
                  )}
                >
                  Female
                </button>
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
