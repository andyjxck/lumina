import React, { useState, useRef } from 'react';
import { useAuth, supabase } from './AuthContext';
import { VILLAGERS_DATA, SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData } from './villagerData.js';
import ProfileSidebar from './ProfileSidebar';
import ChatModal from './ChatModal';
import type { OtherUser } from './ProfileSidebar';

type Page = 'shop' | 'profile' | 'login' | 'orders' | 'admin';

interface ProfilePageProps {
  onBack: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

const AVATAR_EMOJIS = ['🐱','🐶','🐸','🐻','🐼','🐨','🦊','🐯','🦁','🐺','🦝','🐮','🐷','🐔','🐧','🦆','🦅','🦉','🦋','🐢','🌿','🍃','🌸','⭐','🌙'];

export default function ProfilePage({ onBack, onNavigate, currentPage }: ProfilePageProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'owned'|'wishlist'>('owned');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatar, setAvatar] = useState<string>(() => localStorage.getItem('ac_avatar') || '');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [chat, setChat] = useState<{ friendshipId: string; otherUser: OtherUser } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleSaveUsername = async () => {
    const val = usernameInput.trim();
    if (!val || val === user.username) { setEditingUsername(false); return; }
    setSavingUsername(true);
    await supabase.from('ac_users').update({ username: val }).eq('id', user.id);
    const updated = { ...user, username: val };
    // Update localStorage cache so it persists
    localStorage.setItem('ac_user', JSON.stringify(updated));
    setSavingUsername(false);
    setEditingUsername(false);
    window.location.reload(); // simplest way to refresh AuthContext user state
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

  const listMap = { owned: user.owned, wishlist: user.wishlist };
  const currentList = listMap[activeTab];

  const emptyMsg: Record<string, string> = {
    owned: 'Tick ✓ on any villager card to mark them as owned',
    wishlist: 'Banner 🏴 a villager to add to your dreamies list',
  };

  const tabConfig = [
    { id: 'owned' as const,    icon: '✓', label: 'Owned',    accent: '#22c55e' },
    { id: 'wishlist' as const, icon: '🏴', label: 'Dreamies', accent: '#fbbf24' },
  ];

  const recentFavourites = user.favourites.slice(-5).reverse();

  return (
    <>
    <div className="profile-layout">
    <div className="profile-page">
      <button className="page-back-btn" onClick={onBack}>←</button>

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
                  {user.username ? user.username[0].toUpperCase() : '#'}
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
              <h1
                className="pro-name pro-name-editable"
                onClick={() => { setUsernameInput(user.username || ''); setEditingUsername(true); }}
                title="Click to edit username"
              >
                {user.username || 'Islander'} <span className="pro-name-edit-hint">✎</span>
              </h1>
            )}
            <div className="pro-id-chip">#{user.user_number}</div>
          </div>
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
