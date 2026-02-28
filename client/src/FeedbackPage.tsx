import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './AuthContext';
import ChatModal from './ChatModal';

interface FeedbackPageProps {
  onBack: () => void;
  onNavigate: (page: 'shop' | 'profile' | 'login' | 'orders' | 'admin' | 'feedback') => void;
  currentPage: string;
}

export default function FeedbackPage({ onBack, onNavigate, currentPage }: FeedbackPageProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackTickets, setFeedbackTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [adminChatOpen, setAdminChatOpen] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const categories = [
    'Bug Report', 'Feature Request', 'Trading Issue', 'Profile Issue', 
    'General Feedback', 'Other'
  ];

  // Load user's feedback tickets
  useEffect(() => {
    if (!user) return;
    
    const loadTickets = async () => {
      const { data } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setFeedbackTickets(data || []);
      setLoadingTickets(false);
    };
    
    loadTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !message.trim() || submitting || !user) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          category,
          message: message.trim(),
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial message in chat
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          friendship_id: `admin_${data.id}`,
          sender_id: user.id,
          receiver_id: 'admin',
          message: `**${category} Request:**\n\n${message.trim()}`,
          message_type: 'text'
        });

      if (messageError) console.error('Error creating initial message:', messageError);

      // Reset form
      setCategory('');
      setMessage('');
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="feedback-success">
          <div className="feedback-success-icon">✓</div>
          <h2>Feedback submitted!</h2>
          <p>Thanks for helping improve Dreamie Store.</p>
          <button className="request-btn" onClick={onBack}>
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-layout">
      <div className="psb-sidebar">
        <div className="psb-sidebar-inner">
          {/* Logo */}
          <div className="sidebar-logo-header">
            <img src="/logo192.png" alt="Dreamie Store" className="sidebar-logo-img" />
          </div>
          
          {/* Your Tickets Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">Your Tickets</div>
            {loadingTickets ? (
              <div className="psb-loading">Loading tickets…</div>
            ) : feedbackTickets.length === 0 ? (
              <div className="psb-no-results">
                <div style={{fontSize: '24px', marginBottom: '8px'}}>📝</div>
                <div>No tickets yet</div>
                <div style={{fontSize: '12px', opacity: 0.7}}>Submit feedback to create your first ticket</div>
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {feedbackTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    className="psb-result-row"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className={`psb-online-dot ${false ? 'online' : 'offline'}`} />
                    <div className="psb-result-info">
                      <span className="psb-result-name">{ticket.category}</span>
                      <span className="psb-result-meta">
                        {new Date(ticket.created_at).toLocaleDateString()} · {ticket.message.substring(0, 60)}...
                      </span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(ticket);
                        setAdminChatOpen(true);
                      }}
                      className="psb-result-arrow"
                      style={{background: 'none', border: 'none', cursor: 'pointer'}}
                    >
                      💬
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation at bottom */}
        <div className="sidebar-nav">
        <button className="sidebar-nav-item" onClick={onBack} title="Marketplace">
          <span className="nav-item-icon">🛒</span>
          <span className="nav-item-label">Market</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => onNavigate('orders')} title="Trades">
          <span className="nav-item-icon">⇄</span>
          <span className="nav-item-label">Trades</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => onNavigate('profile')} title="Profile">
          <span className="nav-item-icon">👤</span>
          <span className="nav-item-label">{user?.username || (user ? `#${user.user_number}` : 'Profile')}</span>
        </button>
        <button className={`sidebar-nav-item active`} onClick={() => onNavigate('feedback')} title="Help Centre">
          <span className="nav-item-icon">💬</span>
          <span className="nav-item-label">Feedback</span>
        </button>
        <button className="sidebar-nav-item" onClick={() => onNavigate('admin')} title="Admin">
          <span className="nav-item-icon">⚠</span>
          <span className="nav-item-label">Admin</span>
        </button>
      </div>
      </div>

      {/* Main Content Area */}
      <div className="feedback-page">
        <div className="feedback-main" style={{maxWidth: '900px', padding: '0 20px'}}>
          <div className="feedback-header" style={{textAlign: 'left', marginBottom: '40px'}}>
            <div className="feedback-icon" style={{fontSize: '48px', marginBottom: '16px'}}>💬</div>
            <h1 className="feedback-title" style={{marginBottom: '8px'}}>Help & Feedback</h1>
            <p className="feedback-sub">Report issues or suggest features to make Dreamie Store better</p>
          </div>

          <form className="feedback-form" onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div style={{textAlign: 'left'}}>
              <label style={{display: 'block', marginBottom: '12px', fontWeight: 500, color: 'white', fontSize: '16px'}}>What do you need help with?</label>
              <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-start'}}>
                <button
                  type="button"
                  onClick={() => setCategory('Help')}
                  style={{
                    padding: '12px 24px',
                    border: `2px solid ${category === 'Help' ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '12px',
                    background: category === 'Help' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)',
                    color: category === 'Help' ? '#4ade80' : 'rgba(255,255,255,0.8)',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🆘 Help
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('Feedback')}
                  style={{
                    padding: '12px 24px',
                    border: `2px solid ${category === 'Feedback' ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '12px',
                    background: category === 'Feedback' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                    color: category === 'Feedback' ? '#c4b5fd' : 'rgba(255,255,255,0.8)',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💭 Feedback
                </button>
              </div>
            </div>

            <div>
              <label style={{display: 'block', marginBottom: '12px', fontWeight: 500, color: 'white', fontSize: '16px'}}>Tell us more</label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '150px',
                  maxHeight: '250px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  color: 'white',
                  fontFamily: 'inherit',
                  fontSize: '16px',
                  resize: 'vertical',
                  lineHeight: '1.5'
                }}
                placeholder={category === 'Help' ? 'Describe what you need help with in detail...' : 'Share your feedback or suggestions...'}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={1000}
              />
              <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: '8px'}}>
                {message.length}/1000
              </div>
            </div>

            <div style={{textAlign: 'left', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontSize: '14px', color: 'rgba(255,255,255,0.7)'}}>
              Submitted as: <strong>{user?.username || 'Islander'} (#{user?.user_number})</strong>
            </div>

            <button
              type="submit"
              style={{
                padding: '16px 32px',
                background: !category || !message.trim() || submitting || !user ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                border: 'none',
                borderRadius: '16px',
                color: !category || !message.trim() || submitting || !user ? 'rgba(255,255,255,0.3)' : 'white',
                fontSize: '18px',
                fontWeight: 600,
                cursor: !category || !message.trim() || submitting || !user ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                alignSelf: 'flex-start'
              }}
              disabled={!category || !message.trim() || submitting || !user}
            >
              {submitting ? 'Submitting…' : `Submit ${category}`}
            </button>
          </form>
        </div>
      </div>

      {/* Admin Chat Modal */}
      {adminChatOpen && selectedTicket && (
        <ChatModal
          friendshipId={`admin_${selectedTicket.id}`}
          otherUser={{
            id: 'admin',
            user_number: 0,
            username: 'Admin',
            owned: [],
            favourites: [],
            wishlist: []
          }}
          onClose={() => {
            setAdminChatOpen(false);
            setSelectedTicket(null);
          }}
        />
      )}
    </div>
  );
}
