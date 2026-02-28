import React from 'react';
import { VILLAGERS_DATA, SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData } from './villagerData.js';
import { UNAVAILABLE_VILLAGERS } from './villagers.js';
import { useAuth, supabase } from './AuthContext';

function getVillagerData(name: string) {
  return VILLAGERS_DATA[name as keyof typeof VILLAGERS_DATA] || getDefaultVillagerData(name);
}

function getIcon(iconMap: any, key: string) {
  return iconMap[key as keyof typeof iconMap] || '';
}

interface VillagerGridProps {
  villagers: string[];
  basket: string[];
  onToggleBasket: (v: string, e?: React.MouseEvent) => void;
  expandedCard: string | null;
  onExpandCard: (v: string | null) => void;
  sidebarOpen: boolean;
}

export default function VillagerGrid({
  villagers,
  basket,
  onToggleBasket,
  expandedCard,
  onExpandCard,
  sidebarOpen
}: VillagerGridProps) {
  const { user, toggleFavourite, toggleWishlist, toggleOwned } = useAuth();
  const [currentLetter, setCurrentLetter] = React.useState('A');
  const [mostTraded, setMostTraded] = React.useState<string[]>([]);
  const [featuredExpandedCard, setFeaturedExpandedCard] = React.useState<string | null>(null);
  const swipeStartX = React.useRef<number | null>(null);

  // Reusable villager card component
  const VillagerCard = ({ 
    villager, 
    isExpanded, 
    onExpand, 
    isFeatured = false 
  }: { 
    villager: string; 
    isExpanded: boolean; 
    onExpand: (villager: string | null) => void; 
    isFeatured?: boolean;
  }) => {
    const [clickTimeout, setClickTimeout] = React.useState<NodeJS.Timeout | null>(null);
    const data = getVillagerData(villager);
    const inBasket = basket.includes(villager);
    const isUnavailable = UNAVAILABLE_VILLAGERS.includes(villager);
    const isFav = user?.favourites?.includes(villager) || false;
    const isWish = user?.wishlist?.includes(villager) || false;
    const isOwned = user?.owned?.includes(villager) || false;

    return (
      <div
        data-villager={isFeatured ? `featured-${villager}` : villager}
        className={`villager-tile ${
          inBasket ? 'selected' : ''
        } ${isUnavailable ? 'unavailable' : ''} ${
          isOwned ? 'owned' : ''
        } ${isFeatured ? 'featured-card' : ''}`}
        onClick={() => {
          if (isUnavailable) return;
          
          // Clear existing timeout
          if (clickTimeout) {
            clearTimeout(clickTimeout);
            setClickTimeout(null);
          }
          
          // Set new timeout for single click
          const timeout = setTimeout(() => {
            onExpand(isExpanded ? null : villager);
            setClickTimeout(null);
          }, 250); // Wait 250ms to see if it's a double click
          
          setClickTimeout(timeout);
        }}
        onDoubleClick={(e) => {
          if (!isUnavailable) {
            e?.stopPropagation();
            // Clear the single click timeout
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              setClickTimeout(null);
            }
            onToggleBasket(villager);
          }
        }}
        style={{
          width: isFeatured ? '160px' : 'auto',
          margin: isFeatured ? '0 auto' : undefined
        }}
      >
        {inBasket && <div className="cart-glow-border" />}

        <div className="card-top-actions" onClick={e => e.stopPropagation()}>
          <button
            className={`card-top-btn owned-btn ${isOwned ? 'owned-active' : ''}`}
            onClick={e => {
              e.stopPropagation();
              user && toggleOwned(villager);
            }}
            title="I own this"
          >
            ✓
          </button>

          <button
            className={`card-top-btn fav-btn ${isFav ? 'fav-active' : ''}`}
            onClick={e => {
              e.stopPropagation();
              user && toggleFavourite(villager);
            }}
            title="Favourite"
          >
            ♥
          </button>

          <button
            className={`card-top-btn wish-btn ${isWish ? 'wish-active' : ''}`}
            onClick={e => {
              e.stopPropagation();
              user && toggleWishlist(villager);
            }}
            title="Dreamies"
          >
            ⭐
          </button>

          {!isUnavailable && (
            <button
              className={`card-top-btn cart-arrow-btn ${inBasket ? 'in-cart' : ''}`}
              onClick={e => onToggleBasket(villager, e)}
              title={inBasket ? 'Remove from cart' : 'Add to cart'}
            >
              {inBasket ? '✕' : '→'}
            </button>
          )}
        </div>

        <div className="villager-top-row">
          <div
            className={`villager-icon-wrap ${
              data.gender === 'female'
                ? 'gender-female'
                : data.gender === 'male'
                ? 'gender-male'
                : ''
            }`}
          >
            <span className="villager-icon-emoji">
              {getIcon(SPECIES_ICONS, data.species) || '🏘️'}
            </span>
            <span className="personality-badge" title={data.personality}>
              {getIcon(PERSONALITY_ICONS, data.personality)}
            </span>
          </div>

          <div className="villager-name-col">
            <h3 className="villager-name">{villager}</h3>
            {isUnavailable && (
              <span className="unavailable-label">Not Available</span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="card-expanded" onClick={e => e.stopPropagation()}>
            <div className="card-detail-row">
              <span className="card-detail-label">Species</span>
              <span className="card-detail-value">
                {getIcon(SPECIES_ICONS, data.species)} {data.species}
              </span>
            </div>

            <div className="card-detail-row">
              <span className="card-detail-label">Personality</span>
              <span className="card-detail-value">
                {getIcon(PERSONALITY_ICONS, data.personality)} {data.personality}
              </span>
            </div>

            <div className="card-detail-row">
              <span className="card-detail-label">Gender</span>
              <span className="card-detail-value">
                {data.gender === 'female' ? '♀️ Female' : '♂️ Male'}
              </span>
            </div>

            <div className="card-detail-row">
              <span className="card-detail-label">Popularity</span>
              <span className="card-detail-value card-popularity">
                — last 24h
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Fetch most traded villagers from database
  React.useEffect(() => {
    const fetchMostTraded = async () => {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data, error } = await supabase
          .from('trade_requests')
          .select('villager_name')
          .gte('created_at', twentyFourHoursAgo)
          .in('status', ['completed', 'ongoing']);

        if (error) {
          console.error('Error fetching trade data:', error);
          return;
        }

        // Count trades per villager
        const tradeCounts: Record<string, number> = {};
        data?.forEach(trade => {
          tradeCounts[trade.villager_name] = (tradeCounts[trade.villager_name] || 0) + 1;
        });

        // Sort by count and get top 5
        const sorted = Object.entries(tradeCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([villager]) => villager);

        setMostTraded(sorted);
      } catch (error) {
        console.error('Error fetching most traded:', error);
      }
    };

    fetchMostTraded();
  }, []);

  // Navigation functions
  const goToPreviousLetter = () => {
    const currentIndex = alphabet.indexOf(currentLetter);
    if (currentIndex > 0) {
      const prevLetter = alphabet[currentIndex - 1];
      if (groupedVillagers[prevLetter]) {
        setCurrentLetter(prevLetter);
      } else {
        // Find previous letter with villagers
        for (let i = currentIndex - 1; i >= 0; i--) {
          const letter = alphabet[i];
          if (groupedVillagers[letter]) {
            setCurrentLetter(letter);
            break;
          }
        }
      }
    }
  };

  const goToNextLetter = () => {
    const currentIndex = alphabet.indexOf(currentLetter);
    if (currentIndex < alphabet.length - 1) {
      const nextLetter = alphabet[currentIndex + 1];
      if (groupedVillagers[nextLetter]) {
        setCurrentLetter(nextLetter);
      } else {
        // Find next letter with villagers
        for (let i = currentIndex + 1; i < alphabet.length; i++) {
          const letter = alphabet[i];
          if (groupedVillagers[letter]) {
            setCurrentLetter(letter);
            break;
          }
        }
      }
    }
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const diff = swipeStartX.current - e.changedTouches[0].clientX;
    swipeStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNextLetter();
      else goToPreviousLetter();
    }
  };

  // Group villagers by first letter
  const groupedVillagers = villagers.reduce((acc, villager) => {
    let letter = villager.charAt(0).toUpperCase();
    if (villager === 'Étoile') letter = 'E';

    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(villager);

    return acc;
  }, {} as Record<string, string[]>);

  Object.keys(groupedVillagers).forEach(letter => {
    groupedVillagers[letter].sort();
  });

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <>
      {/* Screen Edge Navigation Arrows */}
      {alphabet.indexOf(currentLetter) > 0 && (
        <button
          className="letter-nav-arrow letter-nav-arrow-left"
          onClick={goToPreviousLetter}
          style={{
            position: 'fixed',
            left: sidebarOpen ? '280px' : '20px', // Dynamic position based on sidebar
            top: '60%',
            transform: 'translateY(-50%)',
            minWidth: '50px',
            height: '50px',
            border: 'none',
            background: 'rgba(99,102,241,0.3)',
            color: 'white',
            borderRadius: '50%',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          ‹
        </button>
      )}

      <button
        className="letter-nav-arrow letter-nav-arrow-right"
        onClick={goToNextLetter}
        disabled={alphabet.indexOf(currentLetter) >= alphabet.length - 1}
        style={{
          position: 'fixed',
          right: '20px',
          top: '60%',
          transform: 'translateY(-50%)',
          minWidth: '50px',
          height: '50px',
          border: 'none',
          background: 'rgba(99,102,241,0.3)',
          color: 'white',
          borderRadius: '50%',
          fontSize: '24px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          opacity: alphabet.indexOf(currentLetter) >= alphabet.length - 1 ? '0.3' : '1',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        ›
      </button>

      <div className="villager-grid-horizontal">
        {/* Featured Villagers - Top 3 */}
        <div style={{
          marginBottom: '30px'
        }}>
          <h2 style={{
            color: 'white',
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '20px',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)'
          }}>
            🏆 Top Traded (24h)
          </h2>
          
          {mostTraded.length > 0 ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              padding: '0 20px'
            }}>
              {mostTraded.slice(0, 3).map((villager, index) => {
                const letter = villager.charAt(0).toUpperCase();
                const hasVillager = groupedVillagers[letter]?.includes(villager);
                
                return (
                  <div key={villager} style={{ position: 'relative' }}>
                    {/* Medal badge */}
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      zIndex: 10,
                      background: index === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' 
                        : index === 1 ? 'linear-gradient(135deg, #C0C0C0, #808080)'
                        : 'linear-gradient(135deg, #CD7F32, #8B4513)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                    
                    <VillagerCard
                      villager={villager}
                      isExpanded={featuredExpandedCard === villager}
                      onExpand={setFeaturedExpandedCard}
                      isFeatured={true}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
              textAlign: 'center',
              padding: '20px'
            }}>
              No trades in the last 24 hours
            </div>
          )}
        </div>

        {/* A-Z Navigation */}
      <div className="alphabet-nav-top" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0',
        padding: '4px 0',
        marginBottom: '12px',
        width: '100%'
      }}>
        {/* Previous Arrow */}
        <button
          onClick={goToPreviousLetter}
          disabled={alphabet.indexOf(currentLetter) <= 0}
          style={{
            minWidth: '24px',
            height: '24px',
            border: 'none',
            background: 'transparent',
            color: alphabet.indexOf(currentLetter) <= 0 ? 'rgba(255,255,255,0.3)' : 'white',
            borderRadius: '0',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: alphabet.indexOf(currentLetter) <= 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            padding: '0',
            margin: '0'
          }}
        >
          ‹
        </button>

        {alphabet.map(letter => (
          <button
            key={letter}
            className={`alphabet-btn-top ${
              groupedVillagers[letter] ? 'active' : 'disabled'
            } ${currentLetter === letter ? 'current' : ''}`}
            onClick={() => {
              if (groupedVillagers[letter]) {
                setCurrentLetter(letter);
              }
            }}
            style={{
              minWidth: '24px',
              height: '24px',
              border: 'none',
              background: currentLetter === letter ? 'rgba(99,102,241,0.5)' : 'transparent',
              color: 'white',
              borderRadius: '0',
              fontSize: '12px',
              fontWeight: '600',
              cursor: groupedVillagers[letter] ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              padding: '0',
              margin: '0',
              opacity: groupedVillagers[letter] ? '1' : '0.3'
            }}
          >
            {letter}
          </button>
        ))}

        {/* Next Arrow */}
        <button
          onClick={goToNextLetter}
          disabled={alphabet.indexOf(currentLetter) >= alphabet.length - 1}
          style={{
            minWidth: '24px',
            height: '24px',
            border: 'none',
            background: 'transparent',
            color: alphabet.indexOf(currentLetter) >= alphabet.length - 1 ? 'rgba(255,255,255,0.3)' : 'white',
            borderRadius: '0',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: alphabet.indexOf(currentLetter) >= alphabet.length - 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            padding: '0',
            margin: '0'
          }}
        >
          ›
        </button>
      </div>

        {/* Current letter section with swipe */}
        <div 
          className="current-letter-section"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {(() => {
            const letterVillagers = groupedVillagers[currentLetter];
            if (!letterVillagers || letterVillagers.length === 0) {
              return (
                <div className="no-villagers">
                  <h2>No villagers for {currentLetter}</h2>
                </div>
              );
            }

            return (
              <div className="letter-section-horizontal">
                <div className="letter-header-horizontal">
                  <h2>{currentLetter}</h2>
                  <div className="letter-count">
                    {letterVillagers.length} villagers
                  </div>
                </div>

                
                <div className="villager-grid">
                  {letterVillagers.map(villager => (
                    <VillagerCard
                      key={villager}
                      villager={villager}
                      isExpanded={expandedCard === villager}
                      onExpand={onExpandCard}
                      isFeatured={false}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}