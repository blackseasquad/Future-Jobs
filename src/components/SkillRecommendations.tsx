import { useState } from 'react';
import { careers } from '../data/careers';
import {
  CONFIDENCE_LABELS,
  fetchRecommendations,
  fmtDate,
  readQuizCategory,
  type MarketSnapshot,
  type RecommendationItem,
  type RecommendationsResponse,
} from '../lib/marketData';

const HORIZON_ICONS = { short: 'fa-bolt', medium: 'fa-route', long: 'fa-mountain-sun' } as const;
const CATEGORY_LABELS: Record<string, string> = { ai: 'AI & Tech', green: 'Зелена енергия', biomed: 'БиоМед', space: 'Космос & Роботи', meta: 'Метавселена' };

interface Props {
  data: MarketSnapshot | null;
  favorites: string[];
  knownSkills: string[];
  onToggleKnown: (id: string) => void;
}

export function RecommendationItemView({ item, aiText, compact = false }: { item: RecommendationItem; aiText?: string; compact?: boolean }) {
  const careerTitle = (id: string) => careers.find((c) => c.id === id)?.title ?? id;
  if (compact) {
    const lead = item.facts[0] ?? item.forecasts[0];
    return (
      <li className="rec rec--compact">
        <div className="rec__head">
          <strong>{item.label_bg}</strong>
          <span className="rec__score" title="Оценка за хоризонта по модела на приложението (0–100)">{item.model.horizon_score} <span className="tag tag--model">Модел</span></span>
        </div>
        {lead && <p className="rec__why"><span className={`tag ${item.facts[0] ? 'tag--fact' : 'tag--forecast'}`}>{item.facts[0] ? 'Факт' : 'Прогноза'}</span> {lead.text}</p>}
        <details className="rec__more">
          <summary>Защо, данни и къде да уча</summary>
          <ul><RecommendationItemView item={item} aiText={aiText} /></ul>
        </details>
      </li>
    );
  }
  return (
    <li className="rec">
      <div className="rec__head">
        <strong>{item.label_bg}</strong>
        <span className="rec__score" title="Оценка за хоризонта по модела на приложението (0–100)">
          {item.model.horizon_score} <span className="tag tag--model">Модел</span>
        </span>
      </div>
      <p className="rec__why">
        {item.relevance.map((r, i) => (
          <span key={i}>
            {r.type === 'favorites' && <>Свързано с любимите ви професии: {r.careers!.map(careerTitle).join(', ')}. </>}
            {r.type === 'quiz' && <>Отговаря на резултата от теста ({r.label}). </>}
            {r.type === 'complements' && <>Често се търси заедно с умения, които вече имате. </>}
            {r.type === 'answers' && <>Отговаря на избора ви: {r.answers!.join('; ')}. </>}
          </span>
        ))}
        <span className="muted">Увереност: {CONFIDENCE_LABELS[item.model.confidence]}.</span>
      </p>
      {aiText && (
        <p className="rec__ai"><span className="tag tag--ai">AI обяснение</span> {aiText}</p>
      )}
      <ul className="facts">
        {item.facts.map((f, i) => (
          <li key={`f${i}`}><span className="tag tag--fact">Факт</span> {f.text} <small className="muted">— {f.source}{f.period ? `, ${f.period}` : ''}</small></li>
        ))}
        {item.forecasts.map((f, i) => (
          <li key={`p${i}`}><span className="tag tag--forecast">Прогноза</span> {f.text} <small className="muted">— {f.source}{f.period ? `, ${f.period}` : ''}</small></li>
        ))}
      </ul>
      {item.next_skills.length > 0 && (
        <p className="rec__next"><i className="fa-solid fa-arrow-right" /> След това: {item.next_skills.map((n) => n.label_bg).join(', ')}</p>
      )}
      <p className="rec__learn">
        <i className="fa-solid fa-graduation-cap" /> Къде да учите:{' '}
        {item.learning.map((l, i) => (
          <span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>
        ))}
      </p>
      {item.limitations.length > 0 && (
        <details className="rec__limits">
          <summary>Ограничения</summary>
          <ul>{item.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}
    </li>
  );
}

/** Personalised plan built from favourites, quiz result and the skills the visitor already has. */
export default function SkillRecommendations({ data, favorites, knownSkills, onToggleKnown }: Props) {
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [busy, setBusy] = useState<false | 'plain' | 'ai'>(false);
  const [error, setError] = useState<string | null>(null);
  const quizCategory = readQuizCategory();

  if (!data?.configured || !data.skills?.length) return null;

  const load = async (explain: boolean) => {
    setBusy(explain ? 'ai' : 'plain');
    setError(null);
    try {
      setResult(await fetchRecommendations({ knownSkills, favoriteCareerIds: favorites, quizCategory }, explain));
    } catch {
      setError('Препоръките временно не са достъпни.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel panel--lg glass">
      <h3 className="skills__title gradient-text">Моят план за умения</h3>
      <p className="skills__lead">
        Препоръките използват {favorites.length ? `${favorites.length} запазени професии` : 'запазените ви професии'}
        {quizCategory ? `, резултата от теста (${CATEGORY_LABELS[quizCategory] ?? quizCategory})` : ''} и уменията, които отбележите по-долу.
      </p>

      <div className="known">
        <span className="stats__label">Кои умения вече имате?</span>
        <div className="chips chips--compact">
          {data.skills.map((s) => (
            <button key={s.id} className={`chip${knownSkills.includes(s.id) ? ' chip--active' : ''}`} onClick={() => onToggleKnown(s.id)}>
              {s.label_bg}
            </button>
          ))}
        </div>
      </div>

      <div className="rec-actions">
        <button className="btn btn--gradient btn--sm" onClick={() => load(false)} disabled={!!busy}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {busy === 'plain' ? 'Изчисляване…' : 'Покажи препоръки'}
        </button>
        {result?.ready && (
          <button className="btn btn--ghost btn--sm" onClick={() => load(true)} disabled={!!busy}>
            <i className="fa-solid fa-robot" /> {busy === 'ai' ? 'AI анализира…' : 'Обясни с AI'}
          </button>
        )}
      </div>

      {error && <p className="data-note">{error}</p>}
      {result && !result.ready && <p className="data-note">Все още няма изчислени данни — първото ежедневно обновяване не е завършило.</p>}
      {result?.ai && !result.ai.available && <p className="data-note">{result.ai.reason}</p>}

      {result?.ready && result.horizons && (
        <>
          <div className="horizons">
            {(['short', 'medium', 'long'] as const).map((key) => {
              const h = result.horizons![key];
              return (
                <section key={key} className="horizon">
                  <h4><i className={`fa-solid ${HORIZON_ICONS[key]}`} /> {h.label}</h4>
                  {h.available ? (
                    <ol className="rec-list">
                      {h.items.map((it) => <RecommendationItemView key={it.skill_id} item={it} aiText={result.ai?.explanations?.[`${key}:${it.skill_id}`]} />)}
                    </ol>
                  ) : (
                    <p className="data-note">{h.reason}</p>
                  )}
                </section>
              );
            })}
          </div>
          <p className="source-note">
            <span className="tag tag--fact">Факт</span> измерени данни · <span className="tag tag--forecast">Прогноза</span> публикувани прогнози
            или експертни оценки · <span className="tag tag--model">Модел</span> собствена оценка на FUTURE-JOBS ·{' '}
            <span className="tag tag--ai">AI</span> текст, генериран само от показаните факти (без числа). Данни към {fmtDate(result.computedDate)}.
            Това е ориентир, а не гаранция за бъдеща заетост.
          </p>
        </>
      )}
    </div>
  );
}
