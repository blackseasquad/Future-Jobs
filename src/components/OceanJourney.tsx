import type { CSSProperties } from 'react';
import { careers } from '../data/careers';
import './OceanJourney.css';

interface OceanJourneyProps {
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (id: string) => void;
  onSimulate: (id: string) => void;
  onGoQuiz: () => void;
}

export default function OceanJourney({ isFavorite, onToggleFavorite, onOpen, onSimulate, onGoQuiz }: OceanJourneyProps) {
  return (
    <div className="jj">
      <section className="jj__hero">
        <div className="jj__sun" aria-hidden="true" />
        <div className="jj__text">
          <h1 className="jj__title">
            Открийте Вашата <span className="gradient-text">Бъдеща Кариера</span>
          </h1>
          <p className="jj__lead">
            Потопете се в професиите на следващото десетилетие: колкото по-надолу скролвате, толкова по-дълбоко
            навлизате в бъдещето на труда.
          </p>
          <span className="jj__cue">
            <i className="fa-solid fa-chevron-down" /> Скролвайте надолу
          </span>
        </div>
        <svg className="jj__land" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M0 220 L120 150 L220 200 L340 120 L470 205 L600 140 L720 210 L860 130 L990 205 L1120 150 L1250 200 L1350 160 L1440 190 V300 H0Z" fill="#2a3f7a" opacity=".75" />
          <path d="M0 250 C180 190 320 200 480 240 C640 280 760 210 940 230 C1120 250 1260 205 1440 235 V300 H0Z" fill="#1f7a5c" />
          <path d="M0 238 C160 236 320 250 470 268 H0Z" fill="#f0d39a" />
          <path d="M0 264 C120 252 240 276 360 264 S600 252 720 264 S960 276 1080 264 S1320 252 1440 264 V300 H0Z" fill="#19b9c9" />
          <path d="M1010 262 H1070 L1040 232Z M1038 262 V228" fill="#f5e9d0" stroke="#f5e9d0" strokeWidth="2" />
        </svg>
      </section>

      <section className="jj__sea">
        <div className="jj__stack">
          {careers.map((c, i) => (
            <article
              key={c.id}
              className={`jj__panel jj__panel--${i % 2 === 0 ? 'left' : 'right'}`}
              style={{ '--g1': c.gradient[0], '--g2': c.gradient[1] } as CSSProperties}
              aria-labelledby={`jj-${c.id}`}
            >
              <div className="jj__main">
                <div className="jj__head">
                  <div className="jj__icon">
                    <i className={`fa-solid ${c.icon}`} />
                  </div>
                  <div>
                    <span className="badge">{c.catLabel}</span>
                    <h2 id={`jj-${c.id}`} className="jj__name">{c.title}</h2>
                  </div>
                </div>
                <p className="jj__desc">{c.fullDesc}</p>
              </div>

              <div className="jj__side">
                <div className="jj__stats">
                  <div><span>Ръст</span><strong className="jj__up">+{c.growth}%</strong></div>
                  <div><span>Заплата</span><strong className="jj__cy">${c.salary.toLocaleString()}</strong></div>
                  <div><span>AI риск</span><strong className="jj__pk">{c.risk}%</strong></div>
                </div>
                <div className="jj__pills">
                  {c.skills.map((s) => (
                    <span key={s} className="pill">{s}</span>
                  ))}
                </div>
                <div className="jj__actions">
                  <button className="btn btn--ghost" onClick={() => onOpen(c.id)}>Детайли</button>
                  <button className="btn btn--gradient" onClick={() => onSimulate(c.id)}>Симулация</button>
                  <button
                    className={`jj__fav${isFavorite(c.id) ? ' jj__fav--on' : ''}`}
                    onClick={() => onToggleFavorite(c.id)}
                    aria-pressed={isFavorite(c.id)}
                    aria-label={isFavorite(c.id) ? 'Премахни от любими' : 'Запази в любими'}
                  >
                    <i className={`${isFavorite(c.id) ? 'fa-solid' : 'fa-regular'} fa-bookmark`} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="jj__end">
          <h2>Стигнахте дъното на океана</h2>
          <p>Не знаете откъде да започнете? Тестът ще ви каже кой отрасъл ви подхожда.</p>
          <button className="btn btn--gradient" onClick={onGoQuiz}>Към теста за съвместимост</button>
        </div>

        <svg className="jj__bed" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M0 170 C200 130 380 190 600 160 S1000 120 1200 165 S1400 150 1440 140 V260 H0Z" fill="#1d3548" />
          <path d="M0 210 C240 185 480 225 720 200 S1200 185 1440 205 V260 H0Z" fill="#14283a" />
          <g fill="none" strokeLinecap="round" strokeWidth="7">
            <path d="M150 200 C130 170 170 150 150 110" stroke="#1fae7a" />
            <path d="M178 205 C160 180 195 165 180 130" stroke="#17956a" />
            <path d="M700 178 v-40 M700 152 l-18 -22 M700 142 l18 -26" stroke="#ff4fa0" />
            <path d="M1100 172 v-34 M1100 150 l-16 -18 M1100 144 l16 -22" stroke="#7000ff" />
            <path d="M1290 160 C1270 130 1310 112 1290 76" stroke="#1fae7a" />
          </g>
          <ellipse cx="420" cy="196" rx="38" ry="16" fill="#0f1f2e" />
          <ellipse cx="900" cy="190" rx="52" ry="20" fill="#0f1f2e" />
        </svg>
      </section>
    </div>
  );
}
