import { useEffect, useMemo, useState } from 'react';
import { careers } from '../data/careers';
import { simulations } from '../data/simulations';
import { fetchRecommendations, fmtPct, type MarketSnapshot, type RecommendationsResponse } from '../lib/marketData';
import { CareerLiveSection } from './CareerLiveData';
import { RecommendationItemView } from './SkillRecommendations';

interface SimulatorTabProps {
  roleId: string;
  onChange: (id: string) => void;
  market: MarketSnapshot | null;
  knownSkills: string[];
}

type Mode = 'day' | 'path';

function InteractiveDay({ roleId, market, onPath }: { roleId: string; market: MarketSnapshot | null; onPath: () => void }) {
  const steps = simulations[roleId] ?? [];
  const [picks, setPicks] = useState<number[]>([]);
  useEffect(() => setPicks([]), [roleId]);
  const done = picks.length >= steps.length;
  const current = steps[picks.length];
  const skillById = useMemo(() => new Map((market?.skills ?? []).map((s) => [s.id, s])), [market]);

  const used = useMemo(() => {
    const m = new Map<string, number>();
    picks.forEach((p, i) => steps[i].choices[p].skills.forEach((s) => m.set(s, (m.get(s) || 0) + 1)));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [picks, steps]);

  return (
    <div>
      <ol className="timeline">
        {picks.map((p, i) => (
          <li key={i} className="timeline__item">
            <span className="timeline__dot" />
            <span className="timeline__time">{steps[i].time}</span>
            <p className="timeline__task">{steps[i].situation}</p>
            <p className="sim__picked"><i className="fa-solid fa-check" /> {steps[i].choices[p].text}</p>
            <p className="sim__outcome">{steps[i].choices[p].outcome}</p>
          </li>
        ))}
        {!done && current && (
          <li className="timeline__item timeline__item--active">
            <span className="timeline__dot" />
            <span className="timeline__time">{current.time} · ситуация {picks.length + 1} от {steps.length}</span>
            <p className="timeline__task">{current.situation}</p>
            <p className="sim__ask">Какво правите?</p>
            <div className="quiz__options">
              {current.choices.map((c, ci) => (
                <button key={ci} className="quiz__option" onClick={() => setPicks([...picks, ci])}>
                  <span>{c.text}</span><i className="fa-solid fa-chevron-right" />
                </button>
              ))}
            </div>
          </li>
        )}
      </ol>

      {done && (
        <div className="sim__summary">
          <h4 className="section-label">Уменията, които използвахте днес</h4>
          <ul className="sim__skills">
            {used.map(([id, n]) => {
              const s = skillById.get(id);
              const d = s?.score?.inputs.demand;
              return (
                <li key={id}>
                  <strong>{s?.label_bg ?? id}</strong> <small className="muted">×{n}</small>
                  {d ? <span> — <span className="tag tag--fact">Факт</span> търси се в {fmtPct(d.share)} от анализираните обяви</span> : null}
                  {s?.score?.value != null && <span> · <span className="tag tag--model">Модел</span> Future Skills Score {s.score.value}</span>}
                </li>
              );
            })}
          </ul>
          <p className="source-note">
            <span className="tag tag--model">Сценарий</span> Ситуациите са измислени, за да покажат каква е работата. Няма правилни и грешни
            отговори — всеки избор показва различно умение. Данните за търсенето са реални (Remotive, Arbeitnow).
          </p>
          <div className="forecast__actions">
            <button className="btn btn--gradient btn--sm" onClick={onPath}><i className="fa-solid fa-route" /> Виж пътя към тази професия</button>
            <button className="btn btn--muted btn--sm" onClick={() => setPicks([])}><i className="fa-solid fa-rotate-right" /> Изиграй деня отново</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CareerPath({ roleId, market, knownSkills }: { roleId: string; market: MarketSnapshot | null; knownSkills: string[] }) {
  const role = careers.find((c) => c.id === roleId) ?? careers[0];
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelById = new Map((market?.skills ?? []).map((s) => [s.id, s.label_bg]));

  useEffect(() => {
    setResult(null);
    setError(null);
    fetchRecommendations({ knownSkills, favoriteCareerIds: [role.id], quizCategory: role.category }, false)
      .then(setResult)
      .catch(() => setError('Пътят не може да бъде изчислен в момента.'));
  }, [role.id, role.category, knownSkills]);

  if (!market?.configured) return <p className="data-note">Пазарните данни не са налични.</p>;

  return (
    <div>
      <ol className="path">
        <li className="path__stop">
          <span className="path__label">Днес</span>
          <p>{knownSkills.length
            ? <>Вече имате: {knownSkills.map((k) => labelById.get(k) ?? k).join(', ')}.</>
            : <>Отбележете уменията си в „Топ Умения“ или в „Кариерна прогноза“, за да получите по-точен път.</>}</p>
        </li>
        {error && <li className="path__stop"><p className="data-note">{error}</p></li>}
        {!result && !error && <li className="path__stop"><p className="data-note">Изчисляване…</p></li>}
        {result && !result.ready && <li className="path__stop"><p className="data-note">Пазарните данни още не са заредени.</p></li>}
        {result?.ready && result.horizons && (['short', 'medium', 'long'] as const).map((k) => {
          const h = result.horizons![k];
          return (
            <li key={k} className="path__stop">
              <span className="path__label">{h.label}</span>
              {h.available
                ? <ol className="rec-list">{h.items.map((it) => <RecommendationItemView key={it.skill_id} item={it} />)}</ol>
                : <p className="data-note">{h.reason}</p>}
            </li>
          );
        })}
        <li className="path__stop path__stop--goal">
          <span className="path__label">2035</span>
          <p><strong>{role.title}</strong></p>
          <CareerLiveSection live={market.careers?.[role.id]} market={market} />
        </li>
      </ol>
    </div>
  );
}

export default function SimulatorTab({ roleId, onChange, market, knownSkills }: SimulatorTabProps) {
  const role = careers.find((c) => c.id === roleId) ?? careers[0];
  const [mode, setMode] = useState<Mode>('day');

  return (
    <section className="narrow narrow--wide">
      <div className="panel panel--lg glass">
        <div className="sim__head">
          <div>
            <h3 className="sim__title">Симулатор: „Един ден през 2035 г.“</h3>
            <p className="sim__lead">Изживейте работния ден на професия или вижте пътя до нея</p>
          </div>
          <select className="select" value={role.id} onChange={(e) => onChange(e.target.value)} aria-label="Професия за симулация">
            {careers.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="chips chips--compact" role="tablist">
          <button role="tab" aria-selected={mode === 'day'} className={`chip${mode === 'day' ? ' chip--active' : ''}`} onClick={() => setMode('day')}>
            <i className="fa-solid fa-gamepad" /> Интерактивен ден
          </button>
          <button role="tab" aria-selected={mode === 'path'} className={`chip${mode === 'path' ? ' chip--active' : ''}`} onClick={() => setMode('path')}>
            <i className="fa-solid fa-route" /> Път към професията
          </button>
        </div>
        {mode === 'day'
          ? <InteractiveDay roleId={role.id} market={market} onPath={() => setMode('path')} />
          : <CareerPath roleId={role.id} market={market} knownSkills={knownSkills} />}
      </div>
    </section>
  );
}
