import React from 'react';
import { VILLAGERS_DATA, SPECIES_ICONS, PERSONALITY_ICONS, getDefaultVillagerData } from './villagerData.js';
import { UNAVAILABLE_VILLAGERS } from './villagers.js';
import { useAuth } from './AuthContext';

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
}

export default function VillagerGrid({ villagers, basket, onToggleBasket, expandedCard, onExpandCard }: VillagerGridProps) {
  const { user, toggleFavourite, toggleWishlist, toggleOwned } = useAuth();

  return (
    <div className="villager-grid">
      {villagers.map(villager => {
        const data = getVillagerData(villager);
        const inBasket = basket.includes(villager);
        const isUnavailable = UNAVAILABLE_VILLAGERS.includes(villager);
        const isExpanded = expandedCard === villager;
        const isFav = user?.favourites?.includes(villager) || false;
        const isWish = user?.wishlist?.includes(villager) || false;
        const isOwned = user?.owned?.includes(villager) || false;

        return (
          <div
            key={villager}
            className={`villager-tile ${inBasket ? 'selected' : ''} ${isUnavailable ? 'unavailable' : ''} ${isOwned ? 'owned' : ''}`}
            onClick={() => !isUnavailable && onExpandCard(isExpanded ? null : villager)}
            onDoubleClick={() => !isUnavailable && onToggleBasket(villager)}
          >
            {/* Glowing cart border */}
            {inBasket && <div className="cart-glow-border" />}

            {/* Absolutely-positioned top-right action cluster */}
            <div className="card-top-actions" onClick={e => e.stopPropagation()}>
              <button
                className={`card-top-btn owned-btn ${isOwned ? 'owned-active' : ''}`}
                onClick={e => { e.stopPropagation(); user && toggleOwned(villager); }}
                title="I own this"
              >✓</button>
              <button
                className={`card-top-btn fav-btn ${isFav ? 'fav-active' : ''}`}
                onClick={e => { e.stopPropagation(); user && toggleFavourite(villager); }}
                title="Favourite"
              >♥</button>
              <button
                className={`card-top-btn wish-btn ${isWish ? 'wish-active' : ''}`}
                onClick={e => { e.stopPropagation(); user && toggleWishlist(villager); }}
                title="Dreamies"
              >⭐</button>
              {!isUnavailable && (
                <button
                  className={`card-top-btn cart-arrow-btn ${inBasket ? 'in-cart' : ''}`}
                  onClick={e => onToggleBasket(villager, e)}
                  title={inBasket ? 'Remove from cart' : 'Add to cart'}
                >{inBasket ? '✕' : '→'}</button>
              )}
            </div>

            {/* Top row: icon + name only */}
            <div className="villager-top-row">
              <div className={`villager-icon-wrap ${data.gender === 'female' ? 'gender-female' : data.gender === 'male' ? 'gender-male' : ''}`}>
                <span className="villager-icon-emoji">{getIcon(SPECIES_ICONS, data.species) || '🏘️'}</span>
                <span className="personality-badge" title={data.personality}>
                  {getIcon(PERSONALITY_ICONS, data.personality)}
                </span>
              </div>
              <div className="villager-name-col">
                <h3 className="villager-name">{villager}</h3>
                {isUnavailable && <span className="unavailable-label">Not Available</span>}
              </div>
            </div>

            {/* Expanded detail view — inline, no grid spanning */}
            {isExpanded && (
              <div className="card-expanded" onClick={e => e.stopPropagation()}>
                <div className="card-detail-row">
                  <span className="card-detail-label">Species</span>
                  <span className="card-detail-value">{getIcon(SPECIES_ICONS, data.species)} {data.species}</span>
                </div>
                <div className="card-detail-row">
                  <span className="card-detail-label">Personality</span>
                  <span className="card-detail-value">{getIcon(PERSONALITY_ICONS, data.personality)} {data.personality}</span>
                </div>
                <div className="card-detail-row">
                  <span className="card-detail-label">Gender</span>
                  <span className="card-detail-value">{data.gender === 'female' ? '♀️ Female' : '♂️ Male'}</span>
                </div>
                <div className="card-detail-row">
                  <span className="card-detail-label">Popularity</span>
                  <span className="card-detail-value card-popularity">— last 24h</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
