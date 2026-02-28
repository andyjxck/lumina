import React, { useState, useEffect, useRef } from 'react';
import { useAuth, supabase } from './AuthContext';
import { VILLAGERS_DATA, SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData } from './villagerData.js';
import ProfileSidebar from './ProfileSidebar';
import ChatModal from './ChatModal';
import MobileNav from './MobileNav';
import type { OtherUser } from './ProfileSidebar';

interface MobileFriend {
  id: string; user_number: number; username?: string; last_seen_at?: string; owned: string[];
}
interface MobileLeaderEntry { id: string; user_number: number; username?: string; count: number; }
interface MobileFriendship {
  id: string; user_a_id: string; user_b_id: string;
  status: 'pending'|'accepted'|'blocked_by_a'|'blocked_by_b'; other?: MobileFriend;
}

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback';

interface ProfilePageProps {
  onBack: () => void;
  onNavigate: (page: Page, userId?: string) => void;
  currentPage: Page;
  viewingUserId?: string;
}

const AVATAR_EMOJIS = ['🐱','🐶','🐸','🐻','🐼','🐨','🦊','🐯','🦁','🐺','🦝','🐮','🐷','🐔','🐧','🦆','🦅','🦉','🦋','🐢','🌿','🍃','🌸','⭐','🌙'];

export default function ProfilePage({ onBack, onNavigate, currentPage, viewingUserId }: ProfilePageProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'owned'|'wishlist'>('owned');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatar, setAvatar] = useState<string>(() => localStorage.getItem('ac_avatar') || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [editingIsland, setEditingIsland] = useState(false);
  const [islandInput, setIslandInput] = useState('');
  const [savingExtra, setSavingExtra] = useState(false);
  const [chat, setChat] = useState<{ friendshipId: string; otherUser: OtherUser } | null>(null);
  const [viewingUser, setViewingUser] = useState<OtherUser | null>(null);
  const [ownExtra, setOwnExtra] = useState<{ bio: string|null; island_name: string|null; avg_rating: number|null; rating_count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Mobile social panel state
  const [mSearchQ, setMSearchQ] = useState('');
  const [mSearchResults, setMSearchResults] = useState<MobileFriend[]>([]);
  const [mSearching, setMSearching] = useState(false);
  const [mFriendships, setMFriendships] = useState<MobileFriendship[]>([]);
  const [mLeaderTrades, setMLeaderTrades] = useState<MobileLeaderEntry[]>([]);
  const [mLeaderOwned, setMLeaderOwned] = useState<MobileLeaderEntry[]>([]);
  const [mLeaderTab, setMLeaderTab] = useState<'trades'|'owned'>('trades');
  const [mBusy, setMBusy] = useState<string|null>(null);

  // Fetch own profile extra fields fresh from DB (handles stale localStorage)
  useEffect(() => {
    if (!user) return;
    supabase.from('ac_users').select('bio, island_name, avg_rating, rating_count').eq('id', user.id).single()
      .then(({ data }) => { if (data) setOwnExtra(data); });
  }, [user?.id]);

  // Load friendships for mobile panel
  const loadMFriendships = async () => {
    if (!user) return;
    const { data } = await supabase.from('friendships').select('*').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
    if (!data) return;
    const otherIds = data.map((f: any) => f.user_a_id === user.id ? f.user_b_id : f.user_a_id);
    let uMap: Record<string, MobileFriend> = {};
    if (otherIds.length) {
      const { data: uData } = await supabase.from('ac_users').select('id, user_number, username, owned, last_seen_at').in('id', otherIds);
      (uData || []).forEach((u: any) => { uMap[u.id] = u; });
    }
    setMFriendships(data.map((f: any) => ({ ...f, other: uMap[f.user_a_id === user.id ? f.user_b_id : f.user_a_id] })));
  };

  // Load leaderboard for mobile panel
  const loadMLeaderboard = async () => {
    const { data: td } = await supabase.from('trade_requests').select('requester_id, acceptor_id, villager_name').eq('status', 'completed');
    const counts: Record<string, number> = {};
    const vCounts: Record<string, Set<string>> = {};
    (td || []).forEach((t: any) => {
      if (t.requester_id) counts[t.requester_id] = (counts[t.requester_id] || 0) + 1;
      if (t.acceptor_id) counts[t.acceptor_id] = (counts[t.acceptor_id] || 0) + 1;
      if (t.acceptor_id && t.villager_name) {
        if (!vCounts[t.acceptor_id]) vCounts[t.acceptor_id] = new Set();
        vCounts[t.acceptor_id].add(t.villager_name);
      }
    });
    const allIds = Array.from(new Set([...Object.keys(counts), ...Object.keys(vCounts)])).slice(0, 10);
    if (!allIds.length) return;
    const { data: uData } = await supabase.from('ac_users').select('id, user_number, username').in('id', allIds);
    const uMap: Record<string, any> = {};
    (uData || []).forEach((u: any) => { uMap[u.id] = u; });
    setMLeaderTrades(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).filter(([id]) => uMap[id]).map(([id, c]) => ({ id, user_number: uMap[id].user_number, username: uMap[id].username, count: c as number })));
    setMLeaderOwned(Object.entries(vCounts).sort((a, b) => b[1].size - a[1].size).slice(0, 10).filter(([id]) => uMap[id]).map(([id, s]) => ({ id, user_number: uMap[id].user_number, username: uMap[id].username, count: s.size })));
  };

  useEffect(() => { if (user) { loadMFriendships(); loadMLeaderboard(); } }, [user?.id]);

  // Fetch viewing user data when viewingUserId changes
  useEffect(() => {
    if (viewingUserId && viewingUserId !== user?.id) {
      const fetchViewingUser = async () => {
        const { data } = await supabase
          .from('ac_users')
          .select('id, user_number, username, owned, favourites, wishlist, last_seen_at, bio, island_name, avg_rating, rating_count')
          .eq('id', viewingUserId)
          .single();
        if (data) {
          setViewingUser(data);
        }
      };
      fetchViewingUser();
    } else {
      setViewingUser(null);
    }
  }, [viewingUserId, user?.id]);

  // Display viewing user or current user; merge fresh DB fields for own profile
  const baseUser = viewingUser || user;
  if (!baseUser) return null;
  const displayUser = (!viewingUser && ownExtra)
    ? { ...baseUser, ...ownExtra }
    : baseUser;

  const handleSaveUsername = async () => {
    if (!user) return;
    const val = usernameInput.trim();
    if (!val || val === user.username) { setEditingUsername(false); return; }
    setSavingUsername(true);
    await supabase.from('ac_users').update({ username: val }).eq('id', user.id);
    const updated = { ...user, username: val };
    localStorage.setItem('ac_user', JSON.stringify(updated));
    setSavingUsername(false);
    setEditingUsername(false);
    window.location.reload();
  };

  const handleSaveBio = async () => {
    if (!user) return;
    setSavingExtra(true);
    await supabase.from('ac_users').update({ bio: bioInput.trim() || null }).eq('id', user.id);
    const updated = { ...user, bio: bioInput.trim() || null };
    localStorage.setItem('ac_user', JSON.stringify(updated));
    setSavingExtra(false);
    setEditingBio(false);
    window.location.reload();
  };

  const handleSaveIsland = async () => {
    if (!user) return;
    setSavingExtra(true);
    await supabase.from('ac_users').update({ island_name: islandInput.trim() || null }).eq('id', user.id);
    const updated = { ...user, island_name: islandInput.trim() || null };
    localStorage.setItem('ac_user', JSON.stringify(updated));
    setSavingExtra(false);
    setEditingIsland(false);
    window.location.reload();
  };

  const getVillagerData = (name: string) =>
    VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);
  const getIcon = (iconMap: any, key: string) => iconMap[key as keyof typeof iconMap] || '';

  const setAvatarEmoji = (emoji: string) => {
    setAvatar(emoji);
    localStorage.setItem('ac_avatar', emoji);
    setShowAvatarPicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setAvatar(url);
      localStorage.setItem('ac_avatar', url);
      setShowAvatarPicker(false);
    };
    reader.readAsDataURL(file);
  };

  const isImageUrl = avatar.startsWith('data:') || avatar.startsWith('http');
  const isOwnProfile = !viewingUser || viewingUserId === user?.id;

  const listMap = { owned: displayUser.owned || [], wishlist: displayUser.wishlist || [] };
  const currentList = listMap[activeTab];

  const emptyMsg: Record<string, string> = {
    owned: isOwnProfile ? 'Tick ✓ on any villager card to mark them as owned' : 'No owned villagers',
    wishlist: isOwnProfile ? 'Star ⭐ a villager to add to your dreamies list' : 'No dreamies',
  };

  const tabConfig = [
    { id: 'owned' as const,    icon: '✓', label: 'Owned',    accent: '#22c55e' },
    { id: 'wishlist' as const, icon: '⭐', label: 'Dreamies', accent: '#fbbf24' },
  ];

  const recentFavourites = displayUser.favourites?.slice(-5).reverse() || [];

  return (
    <>
    <MobileNav
      currentPage={currentPage}
      onNavigate={onNavigate}
      selectedSpecies={[]}
      setSelectedSpecies={() => {}}
      selectedPersonalities={[]}
      setSelectedPersonalities={() => {}}
      selectedGenders={[]}
      setSelectedGenders={() => {}}
      profileSocial={{
        friendships: mFriendships,
        leaderTrades: mLeaderTrades,
        leaderOwned: mLeaderOwned,
        currentUserId: user?.id,
        onNavigateProfile: (uid) => onNavigate('profile', uid),
        onAcceptFriend: async (fId) => { setMBusy(fId); await supabase.from('friendships').update({status:'accepted'}).eq('id',fId); await loadMFriendships(); setMBusy(null); },
        onOpenChat: (fId, other) => setChat({ friendshipId: fId, otherUser: other as OtherUser }),
        busy: mBusy,
      }}
    />
    <div className="profile-layout">
    <div className="profile-page">
      <button className="page-back-btn" onClick={onBack}>←</button>

      {/* ── MOBILE SEARCH — above hero on mobile only ── */}
      <div className="pro-mobile-search">
        <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'8px 12px',marginBottom:16}}>
          <span style={{color:'rgba(255,255,255,0.4)'}}>🔍</span>
          <input
            type="text"
            placeholder="Search users…"
            value={mSearchQ}
            onChange={async e => {
              const q = e.target.value;
              setMSearchQ(q);
              if (!q.trim()) { setMSearchResults([]); return; }
              setMSearching(true);
              const num = parseInt(q, 10);
              let query = supabase.from('ac_users').select('id, user_number, username, owned, last_seen_at').neq('id', user?.id || '').limit(8);
              if (!isNaN(num) && String(num) === q.trim()) query = query.or(`username.ilike.%${q}%,user_number.eq.${num}`);
              else query = query.ilike('username', `%${q}%`);
              const { data } = await query;
              setMSearchResults(data || []);
              setMSearching(false);
            }}
            style={{flex:1,background:'transparent',border:'none',outline:'none',color:'rgba(255,255,255,0.85)',fontSize:14}}
          />
          {mSearchQ && <button onClick={()=>{setMSearchQ('');setMSearchResults([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14}}>✕</button>}
        </div>
        {mSearching && <div style={{color:'rgba(255,255,255,0.4)',fontSize:12,marginBottom:8}}>Searching…</div>}
        {!mSearching && mSearchResults.map(u => (
          <div key={u.id} onClick={()=>onNavigate('profile',u.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:(u.last_seen_at&&Date.now()-new Date(u.last_seen_at).getTime()<180000)?'#22c55e':'rgba(255,255,255,0.2)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{color:'rgba(255,255,255,0.85)',fontSize:14,fontWeight:600}}>{u.username||`#${u.user_number}`}</div>
              <div style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>#{u.user_number} · {u.owned?.length||0} owned</div>
            </div>
            <span style={{color:'rgba(255,255,255,0.3)',fontSize:18}}>›</span>
          </div>
        ))}
        {!mSearching && mSearchQ && !mSearchResults.length && <div style={{color:'rgba(255,255,255,0.35)',fontSize:12,marginBottom:8}}>No users found</div>}
      </div>

      {/* ── HERO ── */}
      <div className="pro-hero">

        {/* Left: avatar + name */}
        <div className="pro-hero-left">
          <div className="pro-avatar-ring" onClick={() => setShowAvatarPicker(true)}>
            <div className="pro-avatar">
              {avatar ? (
                isImageUrl
                  ? <img src={avatar} alt="avatar" className="pro-avatar-img" />
                  : <span className="pro-avatar-emoji">{avatar}</span>
              ) : (
                <span className="pro-avatar-initials">
                  {user?.username ? user.username[0].toUpperCase() : '#'}
                </span>
              )}
            </div>
            <div className="pro-avatar-edit-ring">✎</div>
          </div>
          <div className="pro-hero-text">
            {editingUsername ? (
              <div className="pro-username-edit">
                <input
                  ref={usernameInputRef}
                  className="pro-username-input"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                  autoFocus
                  maxLength={24}
                  disabled={savingUsername}
                />
                <button className="pro-username-save" onClick={handleSaveUsername} disabled={savingUsername}>
                  {savingUsername ? '…' : '✓'}
                </button>
                <button className="pro-username-cancel" onClick={() => setEditingUsername(false)}>✕</button>
              </div>
            ) : (
              <h1 className={`pro-name ${isOwnProfile ? 'pro-name-editable' : ''}`} 
                  title={isOwnProfile ? 'Click to edit username' : viewingUser ? 'Viewing ' + (viewingUser.username || '#' + viewingUser.user_number) : ''}>
                {displayUser.username || 'Islander'} 
                {isOwnProfile && <span className="pro-name-edit-hint">✎</span>}
              </h1>
            )}
            <div className="pro-id-chip">#{displayUser.user_number}</div>
            {viewingUser && (
              <div className="pro-viewing-indicator">
                Viewing profile • Back to <button onClick={() => onNavigate('profile')} className="pro-back-link">your profile</button>
              </div>
            )}
          </div>
        </div>

        {/* Bio + island info */}
        <div className="pro-meta-col">
          {/* Island name */}
          <div className="pro-meta-row">
            <span className="pro-meta-icon">🏝️</span>
            {isOwnProfile && editingIsland ? (
              <span className="pro-meta-edit-wrap">
                <input className="pro-meta-input" value={islandInput} onChange={e => setIslandInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveIsland(); if (e.key === 'Escape') setEditingIsland(false); }} autoFocus maxLength={32} disabled={savingExtra} />
                <button className="pro-meta-save" onClick={handleSaveIsland} disabled={savingExtra}>{savingExtra ? '…' : '✓'}</button>
                <button className="pro-meta-cancel" onClick={() => setEditingIsland(false)}>✕</button>
              </span>
            ) : (
              <span className="pro-meta-val pro-meta-editable" onClick={() => { if (isOwnProfile) { setIslandInput(user?.island_name || ''); setEditingIsland(true); } }}>
                {displayUser.island_name || (isOwnProfile ? <span className="pro-meta-placeholder">Add island name ✎</span> : <span className="pro-meta-placeholder">No island name</span>)}
                {isOwnProfile && displayUser.island_name && <span className="pro-meta-edit-hint"> ✎</span>}
              </span>
            )}
          </div>

          {/* Bio */}
          <div className="pro-meta-row">
            <span className="pro-meta-icon">📝</span>
            {isOwnProfile && editingBio ? (
              <span className="pro-meta-edit-wrap">
                <textarea className="pro-meta-textarea" value={bioInput} onChange={e => setBioInput(e.target.value)} autoFocus maxLength={160} disabled={savingExtra} rows={2} />
                <button className="pro-meta-save" onClick={handleSaveBio} disabled={savingExtra}>{savingExtra ? '…' : '✓'}</button>
                <button className="pro-meta-cancel" onClick={() => setEditingBio(false)}>✕</button>
              </span>
            ) : (
              <span className="pro-meta-val pro-meta-editable" onClick={() => { if (isOwnProfile) { setBioInput(user?.bio || ''); setEditingBio(true); } }}>
                {displayUser.bio || (isOwnProfile ? <span className="pro-meta-placeholder">Add a bio ✎</span> : <span className="pro-meta-placeholder">No bio</span>)}
                {isOwnProfile && displayUser.bio && <span className="pro-meta-edit-hint"> ✎</span>}
              </span>
            )}
          </div>

          {/* Rating */}
          {((displayUser.rating_count ?? 0) > 0) && (
            <div className="pro-meta-row">
              <span className="pro-meta-icon">⭐</span>
              <span className="pro-meta-val">{displayUser.avg_rating ? parseFloat(String(displayUser.avg_rating)).toFixed(1) : '—'} <span className="pro-meta-dim">({displayUser.rating_count} ratings)</span></span>
            </div>
          )}
        </div>

        {/* Centre: favourites */}
        <div className="pro-favs-col">
          <div className="pro-favs-header">
            <span className="pro-favs-label">♥ Favourites</span>
            <span className="pro-favs-hint">Your 5 most recently hearted villagers</span>
          </div>
          <div className="pro-favs-row">
            {recentFavourites.length > 0 ? recentFavourites.map(name => {
              const d = getVillagerData(name);
              return (
                <div key={name} className="pro-fav-stat" title={name}>
                  <div className={`pro-fav-stat-icon ${d.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
                    <span className="villager-icon-emoji">{getIcon(SPECIES_ICONS, d.species) || '🏘️'}</span>
                  </div>
                  <span className="pro-fav-stat-name">{name}</span>
                </div>
              );
            }) : (
            <span className="pro-favs-empty">Heart ♥ a villager to see them here</span>
          )}
          </div>
        </div>

        {/* Right: logout */}
        <button className="pro-logout" onClick={logout}>Log out</button>

      </div>

      {/* ── AVATAR PICKER ── */}
      {showAvatarPicker && (
        <div className="avatar-picker-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="avatar-picker" onClick={e => e.stopPropagation()}>
            <div className="avatar-picker-header">
              <span>Choose avatar</span>
              <button onClick={() => setShowAvatarPicker(false)}>✕</button>
            </div>
            <div className="avatar-emoji-grid">
              {AVATAR_EMOJIS.map(e => (
                <button key={e} className="avatar-emoji-btn" onClick={() => setAvatarEmoji(e)}>{e}</button>
              ))}
            </div>
            <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()}>
              ↑ Upload image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} />
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="pro-tabs">
        {tabConfig.map(t => (
          <button
            key={t.id}
            className={`pro-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.id); setExpandedCard(null); }}
            style={activeTab === t.id ? {'--tab-accent': t.accent} as React.CSSProperties : {}}
          >
            <span className="pro-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {listMap[t.id].length > 0 && (
              <span className="pro-tab-badge" style={activeTab === t.id ? {background: t.accent} : {}}>
                {listMap[t.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      {currentList.length === 0 ? (
        <div className="pro-empty">
          <div className="pro-empty-icon">{tabConfig.find(t=>t.id===activeTab)?.icon}</div>
          <p>{emptyMsg[activeTab]}</p>
        </div>
      ) : (
        <div className="pro-grid">
          {currentList.map(name => {
            const data = getVillagerData(name);
            const isExpanded = expandedCard === name;
            return (
              <div
                key={name}
                className={`pro-card ${data.gender === 'female' ? 'f' : 'm'} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedCard(isExpanded ? null : name)}
              >
                <div className={`pro-card-icon ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`}>
                  <span className="villager-icon-emoji">{getIcon(SPECIES_ICONS, data.species) || '🏘️'}</span>
                  <span className="pro-card-badge">{getIcon(PERSONALITY_ICONS, data.personality)}</span>
                </div>
                <span className="pro-card-name">{name}</span>
                <span className="pro-card-trait">{data.species}</span>
                {isExpanded && (
                  <div className="pro-card-expanded">
                    <div className="pro-card-detail">
                      <span className="pro-detail-label">Personality</span>
                      <span className="pro-detail-val">{getIcon(PERSONALITY_ICONS, data.personality)} {data.personality}</span>
                    </div>
                    <div className="pro-card-detail">
                      <span className="pro-detail-label">Gender</span>
                      <span className="pro-detail-val">{data.gender === 'female' ? '♀ Female' : '♂ Male'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


    </div>

      <ProfileSidebar onOpenChat={(fId, other) => setChat({ friendshipId: fId, otherUser: other })} onNavigate={onNavigate} currentPage={currentPage} />
    </div>

    {chat && (
      <ChatModal
        friendshipId={chat.friendshipId}
        otherUser={chat.otherUser}
        onClose={() => setChat(null)}
      />
    )}
    </>
  );
}
