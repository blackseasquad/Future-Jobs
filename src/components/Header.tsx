import { useState } from 'react';
import type { Tab } from '../types';

const NAV: { id: Tab; label: string; icon: string; mobileColor: string }[] = [
  { id: 'catalog', label: 'Каталог Професии', icon: 'fa-briefcase', mobileColor: 'var(--cyan)' },
  { id: 'quiz', label: 'Тест за съвместимост', icon: 'fa-wand-magic-sparkles', mobileColor: 'var(--purple)' },
  { id: 'analytics', label: 'Анализи & Трендове', icon: 'fa-chart-pie', mobileColor: 'var(--emerald)' },
  { id: 'skills', label: 'Топ Умения', icon: 'fa-brain', mobileColor: 'var(--pink)' },
  { id: 'simulator', label: 'Един ден през 2035', icon: 'fa-clock-rotate-left', mobileColor: 'var(--cyan)' },
];

interface HeaderProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  favCount: number;
  userLabel: string;
  onOpenFavorites: () => void;
  onOpenAuth: () => void;
}

export default function Header({
  tab,
  onTab,
  favCount,
  userLabel,
  onOpenFavorites,
  onOpenAuth,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header glass">
      <div className="header__inner">
        <button className="logo" onClick={() => onTab('catalog')} aria-label="Към каталога">
          <span className="logo__mark glow-cyan">
            <i className="fa-solid fa-atom spin-slow" />
          </span>
          <span>
            <span className="logo__name gradient-text">FUTURE-JOBS</span>
            <span className="logo__badge">2030+ Vision</span>
          </span>
        </button>

        <nav className="nav" aria-label="Основна навигация">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav__btn${tab === item.id ? ' nav__btn--active' : ''}`}
              onClick={() => onTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <i className={`fa-solid ${item.icon}`} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="header__actions">
          <button className="user-badge" onClick={onOpenAuth}>
            <i className="fa-solid fa-user-shield" />
            <span className="user-badge__name">{userLabel}</span>
          </button>

          <button className="icon-btn" onClick={onOpenFavorites} title="Запазени любими" aria-label="Запазени любими">
            <i className="fa-solid fa-bookmark" />
            <span className="icon-btn__count">{favCount}</span>
          </button>

          <button
            className="icon-btn menu-toggle"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Меню"
            aria-expanded={menuOpen}
          >
            <i className="fa-solid fa-bars" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          {NAV.map((item) => (
            <button
              key={item.id}
              className="mobile-menu__btn"
              onClick={() => {
                onTab(item.id);
                setMenuOpen(false);
              }}
            >
              <i className={`fa-solid ${item.icon}`} style={{ color: item.mobileColor }} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
