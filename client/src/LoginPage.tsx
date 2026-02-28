import React, { useState } from 'react';
import { supabase, hashSecret, UserProfile, useAuth } from './AuthContext';
import { VILLAGERS } from './villagers.js';
import { VILLAGERS_DATA, SPECIES_ICONS, getDefaultVillagerData } from './villagerData.js';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
  onBack?: () => void;
}

type Mode = 'landing' | 'login' | 'signup-username' | 'signup-credentials' | 'select-owned';

export default function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const { login: contextLogin } = useAuth();
  const [mode, setMode] = useState<Mode>('landing');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [secretType, setSecretType] = useState<'password' | 'pin'>('password');
  const [secret, setSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState<UserProfile | null>(null);
  const [selectedOwned, setSelectedOwned] = useState<string[]>([]);
  const [assignedNumber, setAssignedNumber] = useState<number | null>(null);

  const getVillagerData = (name: string) =>
    VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);

  const getIcon = (iconMap: any, key: string) => iconMap[key as keyof typeof iconMap] || '';

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const err = await contextLogin(identifier, secret);
    setLoading(false);
    if (err) { setError(err); return; }
    onLogin({} as UserProfile);
  };

  // Step 1: reserve a user number and move to credentials screen
  const handleStartSignup = async () => {
    setError('');
    setLoading(true);
    const { data: maxData } = await supabase
      .from('ac_users')
      .select('user_number')
      .order('user_number', { ascending: false })
      .limit(1);
    const nextNumber = maxData && maxData.length > 0 ? maxData[0].user_number + 1 : 1000;
    setAssignedNumber(nextNumber);
    setLoading(false);
    setMode('signup-credentials');
  };

  // Step 2: create the account with the pre-assigned number
  const handleSignup = async () => {
    setError('');
    if (secret.length < 3) { setError('Password/PIN must be at least 3 characters'); return; }
    if (secret !== confirmSecret) { setError('Secrets do not match'); return; }
    setLoading(true);

    const hash = await hashSecret(secret);

    const { data, error: err } = await supabase
      .from('ac_users')
      .insert({
        user_number: assignedNumber,
        username: username.trim() || null,
        secret_hash: hash,
        secret_type: secretType,
        owned: [],
        favourites: [],
        wishlist: [],
      })
      .select()
      .single();

    if (err || !data) { setError(err?.message || 'Failed to create account'); setLoading(false); return; }

    const profile: UserProfile = {
      id: data.id,
      username: data.username,
      user_number: data.user_number,
      owned: [],
      favourites: [],
      wishlist: [],
      verified_cards: [],
    };
    setNewUser(profile);
    setLoading(false);
    setMode('select-owned');
  };

  const handleFinishOwned = async (skip: boolean) => {
    if (!newUser) return;
    const owned = skip ? [] : selectedOwned;
    await supabase.from('ac_users').update({ owned }).eq('id', newUser.id);
    const profile = { ...newUser, owned };
    localStorage.setItem('ac_user', JSON.stringify(profile));
    onLogin(profile);
  };

  const toggleOwned = (v: string) =>
    setSelectedOwned(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  if (mode === 'select-owned') {
    return (
      <div className="login-screen" style={{position:'relative'}}>
        <div className="login-glass owned-selector">
          <h2 className="login-title">Which villagers do you already own?</h2>
          <p className="login-sub">Select everyone you currently have on your island</p>
          <div className="owned-grid">
            {VILLAGERS.map((v: string) => {
              const data = getVillagerData(v);
              const selected = selectedOwned.includes(v);
              return (
                <button
                  key={v}
                  className={`owned-tile ${selected ? 'selected' : ''} ${data.gender === 'female' ? 'gender-female' : 'gender-male'}`}
                  onClick={() => toggleOwned(v)}
                >
                  <span className="owned-icon villager-icon-emoji">{getIcon(SPECIES_ICONS, data.species) || '🏘️'}</span>
                  <span className="owned-name">{v}</span>
                  {selected && <span className="owned-check">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="owned-actions">
            <button className="btn-secondary" onClick={() => handleFinishOwned(true)}>Skip for now</button>
            <button className="btn-primary" onClick={() => handleFinishOwned(false)}>
              Save ({selectedOwned.length} selected)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      {onBack && (
        <button className="page-back-btn" onClick={onBack} title="Back to shop">
          ←
        </button>
      )}
      {mode === 'landing' && (
        <div className="login-glass">
          <div className="login-logo">🍃</div>
          <h1 className="login-title">Villager Trade</h1>
          <p className="login-sub">Find and trade Animal Crossing villagers</p>
          <div className="login-actions">
            <button className="btn-primary big" onClick={() => setMode('signup-username')}>
              Create Account
            </button>
            <button className="btn-ghost" onClick={() => setMode('login')}>
              I already have an account
            </button>
          </div>
        </div>
      )}

      {mode === 'login' && (
        <div className="login-glass">
          <button className="back-btn" onClick={() => setMode('landing')}>← Back</button>
          <h2 className="login-title">Welcome back</h2>
          <div className="login-form">
            <input
              className="login-input"
              placeholder="Username or User ID"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
            />
            <input
              className="login-input"
              type="password"
              placeholder="Password or PIN"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            {error && <div className="login-error">{error}</div>}
            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </div>
          <p className="login-footer">
            No account?{' '}
            <button className="link-btn" onClick={() => setMode('signup-username')}>Create one</button>
          </p>
        </div>
      )}

      {/* Step 1: enter username */}
      {mode === 'signup-username' && (
        <div className="login-glass">
          <button className="back-btn" onClick={() => setMode('landing')}>← Back</button>
          <h2 className="login-title">Create Account</h2>
          <p className="login-sub">Choose a username (optional)</p>
          <div className="login-form">
            <input
              className="login-input"
              placeholder="Username (optional)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartSignup()}
            />
            {error && <div className="login-error">{error}</div>}
            <button className="btn-primary" onClick={handleStartSignup} disabled={loading}>
              {loading ? 'Getting your ID…' : 'Continue'}
            </button>
          </div>
          <p className="login-footer">
            Already have one?{' '}
            <button className="link-btn" onClick={() => setMode('login')}>Log in</button>
          </p>
        </div>
      )}

      {/* Step 2: show assigned user number + set password */}
      {mode === 'signup-credentials' && (
        <div className="login-glass">
          <button className="back-btn" onClick={() => setMode('signup-username')}>← Back</button>
          <h2 className="login-title">Your Account</h2>
          <div className="user-number-display">
            <span className="user-number-label">Your User ID</span>
            <span className="user-number-value">#{assignedNumber}</span>
            <span className="user-number-hint">Save this — you’ll need it to log in</span>
          </div>
          <div className="login-form">
            <div className="secret-type-toggle">
              <button
                className={`toggle-btn ${secretType === 'password' ? 'active' : ''}`}
                onClick={() => setSecretType('password')}
              >Password</button>
              <button
                className={`toggle-btn ${secretType === 'pin' ? 'active' : ''}`}
                onClick={() => setSecretType('pin')}
              >PIN</button>
            </div>
            <input
              className="login-input"
              type="password"
              placeholder={secretType === 'pin' ? 'Enter PIN (numbers)' : 'Enter password'}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              inputMode={secretType === 'pin' ? 'numeric' : 'text'}
            />
            <input
              className="login-input"
              type="password"
              placeholder={`Confirm ${secretType}`}
              value={confirmSecret}
              onChange={e => setConfirmSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignup()}
            />
            {error && <div className="login-error">{error}</div>}
            <button className="btn-primary" onClick={handleSignup} disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
