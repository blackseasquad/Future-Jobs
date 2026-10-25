import type { CareerLive } from '../lib/marketData';
import type { Career } from '../types';
import { CareerLiveLine } from './CareerLiveData';

interface CareerCardProps {
  career: Career;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
  onSimulate: (id: string) => void;
  live?: CareerLive;
}

export default function CareerCard({
  career: c,
  isFavorite,
  onToggleFavorite,
  onOpen,
  onSimulate,
  live,
}: CareerCardProps) {
  return (
    <article className="card glass">
      <div>
        <div className="card__top">
          <div
            className="card__icon"
            style={{ background: `linear-gradient(to top right, ${c.gradient[0]}, ${c.gradient[1]})` }}
          >
            <i className={`fa-solid ${c.icon}`} />
          </div>
          <button
            className={`card__fav${isFavorite ? ' card__fav--on' : ''}`}
            onClick={() => onToggleFavorite(c.id)}
            title={isFavorite ? 'Премахни от любими' : 'Запази'}
            aria-pressed={isFavorite}
          >
            <i className={`${isFavorite ? 'fa-solid' : 'fa-regular'} fa-bookmark`} />
          </button>
        </div>

        <span className="badge">{c.catLabel}</span>
        <h3 className="card__title">{c.title}</h3>
        <p className="card__desc">{c.shortDesc}</p>
      </div>

      <div className="card__footer">
        <div className="stats">
          <div>
            <span className="stats__label">Ръст</span>
            <span className="stats__value stats__value--growth">+{c.growth}%</span>
          </div>
          <div>
            <span className="stats__label">Заплата</span>
            <span className="stats__value stats__value--salary">${(c.salary / 1000).toFixed(0)}k</span>
          </div>
          <div>
            <span className="stats__label">AI Риск</span>
            <span className="stats__value stats__value--risk">{c.risk}%</span>
          </div>
        </div>
        <p className="card__note" title="Ръстът, заплатата и рискът от AI са редакционни оценки за професията, не измерени статистики.">
          <span className="tag tag--model">Илюстративно</span> оценки на FUTURE-JOBS
        </p>
        <CareerLiveLine live={live} />

        <div className="pills">
          {c.skills.slice(0, 3).map((s) => (
            <span key={s} className="pill">
              {s}
            </span>
          ))}
        </div>

        <div className="card__actions">
          <button className="btn btn--ghost" onClick={() => onOpen(c.id)}>
            Детайли
          </button>
          <button className="btn btn--gradient" onClick={() => onSimulate(c.id)}>
            Симулация
          </button>
        </div>
      </div>
    </article>
  );
}
