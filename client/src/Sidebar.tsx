import React, { useRef } from 'react';
import { SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData, VILLAGERS_DATA } from './villagerData.js';
import { UNAVAILABLE_VILLAGERS } from './villagers.js';
import { useAuth } from './AuthContext';

const FEMALE_PERSONALITIES = ['Snooty', 'Uchi', 'Peppy', 'Normal'];
const MALE_PERSONALITIES = ['Cranky', 'Lazy', 'Jock', 'Smug'];

function getIcon(iconMap: any, key: string) {
  return iconMap[key as keyof typeof iconMap] || '';
}

function getVillagerData(name: string) {
  return VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);
}

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  showSearch: boolean;
  onSearchFocus: () => void;
  searchResults: string[];
  basket: string[];
  onToggleBasket: (v: string) => void;
  selectedSpecies: string[];
  setSelectedSpecies: (v: string[]) => void;
  selectedPersonalities: string[];
  setSelectedPersonalities: (v: string[]) => void;
  selectedGenders: string[];
  setSelectedGenders: (v: string[]) => void;
  openFilter: string | null;
  setOpenFilter: (v: string | null) => void;
  onNavigate: (page: 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback', userId?: string) => void;
  currentPage: string;
}

export default function Sidebar({
  open, onToggle,
  searchTerm, onSearchChange, showSearch, onSearchFocus, searchResults,
  basket, onToggleBasket,
  selectedSpecies, setSelectedSpecies,
  selectedPersonalities, setSelectedPersonalities,
  selectedGenders, setSelectedGenders,
  openFilter, setOpenFilter,
  onNavigate, currentPage,
}: SidebarProps) {
  const { user } = useAuth();
  const searchRef = useRef<HTMLDivElement>(null);

  const getAvailablePersonalities = () => {
    if (selectedGenders.length === 1 && selectedGenders[0] === 'female') return FEMALE_PERSONALITIES;
    if (selectedGenders.length === 1 && selectedGenders[0] === 'male') return MALE_PERSONALITIES;
    return Object.keys(PERSONALITY_ICONS);
  };

  const toggleFilter = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter(x => x !== value) : [...list, value]);
  };

  const hasFilters = selectedSpecies.length > 0 || selectedPersonalities.length > 0 || selectedGenders.length > 0;

  const NavItem = ({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) => (
    <button className={`sidebar-nav-item ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </button>
  );

  return (
    <div className={`sidebar ${open ? 'open' : 'closed'}`}>
      <button className="sidebar-toggle" onClick={onToggle} title={open ? 'Close sidebar' : 'Open sidebar'}>
        {open ? '◀' : '▶'}
      </button>

      {open && (
        <div className="sidebar-shell">
          <div className="sidebar-inner">
          {/* Logo */}
          <div className="sidebar-logo-header">
            <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
            <button className="tutorial-trigger-btn" title="Tutorial">?</button>
          </div>
          
          {/* Search — no background box */}
          <div className="sidebar-search-wrap" ref={searchRef}>
            <div className="sidebar-search-bare">
              <span className="search-icon-inline">🔍</span>
              <input
                type="text"
                placeholder="Search villagers..."
                className="search-input"
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                onFocus={onSearchFocus}
              />
              {searchTerm && (
                <button className="search-clear" onClick={() => onSearchChange('')}>✕</button>
              )}
            </div>
          </div>

          {/* Personality Guide */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">Personality Guide</div>
            <div className="guide-grid-sidebar">
              {Object.entries(PERSONALITY_ICONS).map(([name, icon]) => (
                <div key={name} className="guide-item">
                  <span className="guide-icon">{icon as string}</span>
                  <span className="guide-name">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gender filter — always visible */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">
              Gender
              {selectedGenders.length > 0 && (
                <button className="inline-clear" onClick={() => { setSelectedGenders([]); setSelectedPersonalities([]); }}>clear</button>
              )}
            </div>
            <div className="inline-filter-row">
              {[['male', 'Male'], ['female', 'Female']].map(([val, label], i) => (
                <span key={val} style={{display:'flex',alignItems:'baseline'}}>
                  {i > 0 && <span className="species-sep">|</span>}
                  <button
                    className={`species-chip ${selectedGenders.includes(val) ? 'active' : ''}`}
                    onClick={() => {
                      const next = selectedGenders.includes(val)
                        ? selectedGenders.filter(g => g !== val)
                        : [...selectedGenders, val];
                      setSelectedGenders(next);
                      if (next.length === 1) {
                        const valid = next[0] === 'female' ? FEMALE_PERSONALITIES : MALE_PERSONALITIES;
                        setSelectedPersonalities(selectedPersonalities.filter((p: string) => valid.includes(p)));
                      }
                    }}
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Personality filter — female row then male row, no divider */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">
              Personality
              {selectedPersonalities.length > 0 && (
                <button className="inline-clear" onClick={() => setSelectedPersonalities([])}>clear</button>
              )}
            </div>
            {(() => {
              const showFemale = selectedGenders.length === 0 || selectedGenders.includes('female');
              const showMale = selectedGenders.length === 0 || selectedGenders.includes('male');
              return (
                <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                  {showFemale && (
                    <div className="inline-filter-row">
                      {FEMALE_PERSONALITIES.map((p, i) => (
                        <span key={p} style={{display:'flex',alignItems:'baseline'}}>
                          {i > 0 && <span className="species-sep">|</span>}
                          <button
                            className={`species-chip ${selectedPersonalities.includes(p) ? 'active' : ''}`}
                            onClick={() => toggleFilter(p, selectedPersonalities, setSelectedPersonalities)}
                          >{p}</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {showMale && (
                    <div className="inline-filter-row">
                      {MALE_PERSONALITIES.map((p, i) => (
                        <span key={p} style={{display:'flex',alignItems:'baseline'}}>
                          {i > 0 && <span className="species-sep">|</span>}
                          <button
                            className={`species-chip ${selectedPersonalities.includes(p) ? 'active' : ''}`}
                            onClick={() => toggleFilter(p, selectedPersonalities, setSelectedPersonalities)}
                          >{p}</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Species filter — grouped by first letter, pipe-separated */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">
              Species
              {selectedSpecies.length > 0 && (
                <button className="inline-clear" onClick={() => setSelectedSpecies([])}>clear</button>
              )}
            </div>
            <div className="species-letter-list">
              {(() => {
                const allSpecies = Object.keys(SPECIES_ICONS).sort();
                const groups: Record<string, string[]> = {};
                allSpecies.forEach(s => {
                  const letter = s[0].toUpperCase();
                  if (!groups[letter]) groups[letter] = [];
                  groups[letter].push(s);
                });
                return Object.entries(groups).map(([, items]) => (
                  <div key={items[0]} className="species-letter-row">
                    {items.map((species, i) => (
                      <span key={species}>
                        {i > 0 && <span className="species-sep"> | </span>}
                        <button
                          className={`species-chip ${selectedSpecies.includes(species) ? 'active' : ''}`}
                          onClick={() => toggleFilter(species, selectedSpecies, setSelectedSpecies)}
                        >
                          {species}
                        </button>
                      </span>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>

          </div>

          {/* Nav footer — always at bottom, outside scroll area */}
          <div className="sidebar-nav">
            <NavItem icon="🛒" label="Market" active={currentPage === 'shop'} onClick={() => onNavigate('shop')} />
            <NavItem icon="⇄" label="Trades" active={currentPage === 'orders'} onClick={() => onNavigate('orders')} />
            <NavItem
              icon="👤"
              label={user ? (user.username || `#${user.user_number}`) : 'Log In'}
              active={currentPage === 'profile' || currentPage === 'login'}
              onClick={() => onNavigate(user ? 'profile' : 'login')}
            />
            <NavItem icon="💬" label="Feedback" active={currentPage === 'feedback'} onClick={() => onNavigate('feedback')} />
            <NavItem icon="⚠" label="Admin" active={currentPage === 'admin'} onClick={() => onNavigate('admin')} />
                      </div>
        </div>
      )}
    </div>
  );
}
