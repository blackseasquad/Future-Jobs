import { useMemo, useState } from 'react';
import { careers, categoryFilters } from '../data/careers';
import type { CategoryFilter } from '../types';
import CareerCard from './CareerCard';

interface CatalogTabProps {
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
  onSimulate: (id: string) => void;
}

export default function CatalogTab({ isFavorite, onToggleFavorite, onOpen, onSimulate }: CatalogTabProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return careers.filter((c) => {
      const matchesCategory = filter === 'all' || c.category === filter;
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.shortDesc.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [filter, search]);

  return (
    <section className="stack">
      <div className="toolbar glass">
        <div className="search">
          <i className="fa-solid fa-magnifying-glass search__icon" />
          <input
            type="text"
            className="search__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Търсене по име или ключова дума..."
            aria-label="Търсене на професии"
          />
        </div>

        <div className="chips">
          {categoryFilters.map((f) => (
            <button
              key={f.id}
              className={`chip${filter === f.id ? ' chip--active' : ''}`}
              onClick={() => setFilter(f.id as CategoryFilter)}
            >
              {f.icon && <i className={`fa-solid ${f.icon}`} />} {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <i className="fa-solid fa-ghost" />
          <p>Няма намерени професии по дадените критерии.</p>
        </div>
      ) : (
        <div className="careers-grid">
          {filtered.map((c) => (
            <CareerCard
              key={c.id}
              career={c}
              isFavorite={isFavorite(c.id)}
              onToggleFavorite={onToggleFavorite}
              onOpen={onOpen}
              onSimulate={onSimulate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
