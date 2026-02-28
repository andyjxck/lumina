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

interface MobileFriend {
  id: string; user_number: number; username?: string; last_seen_at?: string; owned: string[];
}
interface MobileFriendship {
  id: string; user_a_id: string; user_b_id: string;
  status: 'pending'|'accepted'|'blocked_by_a'|'blocked_by_b'; other?: MobileFriend;
}
interface MobileLeaderEntry { id: string; user_number: number; username?: string; count: number; }

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
  profileSocial?: {
    friendships: MobileFriendship[];
    leaderTrades: MobileLeaderEntry[];
    leaderOwned: MobileLeaderEntry[];
    currentUserId?: string;
    onNavigateProfile: (userId: string) => void;
    onAcceptFriend: (fId: string) => void;
    onOpenChat: (fId: string, other: MobileFriend) => void;
    busy: string|null;
  };
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
  profileSocial,
}: MobileNavProps) {
  const [leaderTab, setLeaderTab] = useState<'trades'|'owned'>('trades');
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


          {/* Profile social: friends, leaderboard, unread */}
          {profileSocial && (
            <div style={{padding:'0 16px',overflowY:'auto',maxHeight:'50vh'}}>
              {/* Unread */}
              <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:14,marginTop:4}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:8}}>Unread Chats</div>
                <div style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>No unread messages</div>
              </div>
              {/* Friends */}
              <div style={{paddingTop:14,marginTop:4}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:8}}>
                  Friends ({profileSocial.friendships.filter(f=>f.status==='accepted').length})
                  {profileSocial.friendships.filter(f=>f.status==='pending'&&f.user_b_id===profileSocial.currentUserId).length > 0 && (
                    <span style={{marginLeft:8,background:'rgba(250,204,21,0.2)',color:'#fbbf24',borderRadius:8,padding:'1px 7px',fontSize:10}}>
                      {profileSocial.friendships.filter(f=>f.status==='pending'&&f.user_b_id===profileSocial.currentUserId).length} pending
                    </span>
                  )}
                </div>
                {profileSocial.friendships.filter(f=>f.status==='pending'&&f.user_b_id===profileSocial.currentUserId).map(f => f.other && (
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{flex:1,cursor:'pointer'}} onClick={()=>f.other&&profileSocial.onNavigateProfile(f.other.id)}>
                      <div style={{color:'rgba(255,255,255,0.85)',fontSize:13,fontWeight:600}}>{f.other.username||`#${f.other.user_number}`}</div>
                      <div style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>wants to be friends</div>
                    </div>
                    <button disabled={profileSocial.busy===f.id} onClick={()=>profileSocial.onAcceptFriend(f.id)} style={{background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',color:'#4ade80',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:12}}>✓</button>
                  </div>
                ))}
                {profileSocial.friendships.filter(f=>f.status==='accepted').map(f => f.other && (
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer'}} onClick={()=>f.other&&profileSocial.onNavigateProfile(f.other.id)}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:(f.other.last_seen_at&&Date.now()-new Date(f.other.last_seen_at).getTime()<180000)?'#22c55e':'rgba(255,255,255,0.2)',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{color:'rgba(255,255,255,0.85)',fontSize:13,fontWeight:600}}>{f.other.username||`#${f.other.user_number}`}</div>
                      <div style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>#{f.other.user_number} · {f.other.owned?.length||0} owned</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();f.other&&profileSocial.onOpenChat(f.id,f.other);}} style={{background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:12}}>💬</button>
                  </div>
                ))}
                {!profileSocial.friendships.filter(f=>f.status==='accepted').length && !profileSocial.friendships.filter(f=>f.status==='pending'&&f.user_b_id===profileSocial.currentUserId).length && (
                  <div style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>Search for a user to add friends</div>
                )}
              </div>
              {/* Leaderboard */}
              <div style={{paddingTop:14,marginTop:4,paddingBottom:16}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)',marginBottom:8}}>Leaderboard</div>
                <div style={{display:'flex',gap:6,marginBottom:10}}>
                  {(['trades','owned'] as const).map(tab=>(
                    <button key={tab} onClick={()=>setLeaderTab(tab)} style={{background:leaderTab===tab?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:leaderTab===tab?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.45)',borderRadius:8,padding:'3px 10px',cursor:'pointer',fontSize:11}}>
                      {tab==='trades'?'🔄 Trades':'✓ Verified'}
                    </button>
                  ))}
                </div>
                {(leaderTab==='trades'?profileSocial.leaderTrades:profileSocial.leaderOwned).length===0
                  ? <div style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>No data yet</div>
                  : (leaderTab==='trades'?profileSocial.leaderTrades:profileSocial.leaderOwned).map((e,i)=>(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                      <span style={{color:'rgba(255,255,255,0.5)',fontSize:12,width:18,textAlign:'center'}}>{['🥇','🥈','🥉'][i]||i+1}</span>
                      <span style={{flex:1,color:'rgba(255,255,255,0.85)',fontSize:13}}>{e.username||`#${e.user_number}`}</span>
                      <span style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>{e.count}</span>
                    </div>
                  ))
                }
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
