import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { QUESTIONS } from '../../api/_lib/quiz-data.js';
import { careers, categoryNames } from '../data/careers';
import { fmtDate, QUIZ_CATEGORY_KEY, type MarketSnapshot } from '../lib/marketData';
import { createForecast, getForecast, myForecasts, readSavedForecast, writeSavedForecast, type Answers, type SavedForecast } from '../lib/forecast';
import { supabase } from '../lib/supabase';
import type { Category, Notify } from '../types';
import ForecastReport from './ForecastReport';

interface Props {
  market: MarketSnapshot | null;
  user: User | null;
  notify: Notify;
  onOpenCareer: (id: string) => void;
  /** token from a "?report=" link */
  initialToken: string | null;
}

type Phase = 'intro' | 'questions' | 'loading' | 'result' | 'fallback';

function remember(saved: SavedForecast, user: User | null) {
  writeSavedForecast(saved);
  try {
    if (saved.report.top_category) localStorage.setItem(QUIZ_CATEGORY_KEY, saved.report.top_category);
  } catch { /* storage unavailable */ }
  if (supabase && user) void supabase.auth.updateUser({ data: { last_forecast_token: saved.token } });
}

export default function ForecastQuiz({ market, user, notify, onOpenCareer, initialToken }: Props) {
  const [saved, setSaved] = useState<SavedForecast | null>(readSavedForecast);
  const [phase, setPhase] = useState<Phase>(saved ? 'result' : 'intro');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ interests: [], known: [] });
  const [error, setError] = useState<string | null>(null);
  const [showSavedIntro, setShowSavedIntro] = useState(Boolean(saved));

  // Open a report from a "?report=" link (e.g. from the e-mail), or the signed-in user's latest one.
  useEffect(() => {
    const token = initialToken || (!saved && user?.user_metadata?.last_forecast_token) || null;
    if (!token || token === saved?.token) return;
    getForecast(token)
      .then((r) => { setSaved(r); remember(r, null); setPhase('result'); setShowSavedIntro(true); })
      .catch((e) => initialToken && setError(e.message));
  }, [initialToken, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || saved) return;
    void myForecasts().then((list) => {
      if (list[0]) getForecast(list[0].token).then((r) => { setSaved(r); remember(r, null); setPhase('result'); }).catch(() => {});
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const skills = market?.skills ?? [];
  const questions = QUESTIONS.filter((q) => q.type !== 'skills' || skills.length > 0);
  const q = questions[step];
  const value = q ? answers[q.id] : undefined;
  const canNext = q && (q.type === 'single' ? typeof value === 'string' : q.type === 'multi' ? (value as string[] | undefined)?.length : true);

  const start = () => { setAnswers({ interests: [], known: [] }); setStep(0); setError(null); setPhase('questions'); setShowSavedIntro(false); };

  const toggle = (id: string) => {
    const cur = (answers[q.id] as string[]) ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : q.max && cur.length >= q.max ? cur : [...cur, id];
    setAnswers({ ...answers, [q.id]: next });
  };

  const finish = async (final: Answers) => {
    setPhase('loading');
    try {
      const r = await createForecast(final);
      setSaved(r);
      remember(r, user);
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
      setPhase('fallback');
    }
  };

  const next = () => {
    if (step < questions.length - 1) setStep(step + 1);
    else void finish(answers);
  };

  if (phase === 'result' && saved) {
    return (
      <section className="narrow narrow--wide">
        {showSavedIntro && (
          <p className="freshness"><i className="fa-solid fa-bookmark" /> Вашата запазена прогноза от <strong>{fmtDate(saved.report.created_at)}</strong>.</p>
        )}
        <div className="quiz glass">
          <ForecastReport token={saved.token} report={saved.report} market={market} notify={notify} onRetake={start} onOpenCareer={onOpenCareer} />
        </div>
      </section>
    );
  }

  return (
    <section className="narrow">
      <div className="quiz glass">
        {phase === 'intro' && (
          <div className="result">
            <div className="result__badge glow-cyan"><i className="fa-solid fa-compass" /></div>
            <h3 className="result__title gradient-text">Кариерна прогноза</h3>
            <p className="result__text">
              {questions.length} кратки въпроса за вашите интереси, умения и цели. Ще получите прогноза кои групи професии ви подхождат
              според реалните данни на Eurostat и Cedefop и кои умения да започнете да развивате — за 6–12 месеца, 2–5 и 5–10 години.
              Резултатът се запазва и може да го получите по имейл.
            </p>
            {error && <p className="forecast__error">{error}</p>}
            <button className="btn btn--gradient btn--lg" onClick={start}><i className="fa-solid fa-play" /> Започни теста</button>
          </div>
        )}

        {phase === 'questions' && q && (
          <>
            <div className="quiz__head">
              <div className="quiz__meta">
                <span className="quiz__eyebrow">Кариерна прогноза</span>
                <span className="quiz__step">Въпрос {step + 1} от {questions.length}</span>
              </div>
              <div className="progress"><div className="progress__bar" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
            </div>
            <h3 className="quiz__question">{q.title}</h3>
            {q.hint && <p className="quiz__hint">{q.hint}</p>}

            {q.type === 'single' && (
              <div className="quiz__options">
                {q.options!.map((o) => (
                  <button key={o.id} className={`quiz__option${value === o.id ? ' quiz__option--on' : ''}`}
                    onClick={() => { const a = { ...answers, [q.id]: o.id }; setAnswers(a); if (step < questions.length - 1) setStep(step + 1); else void finish(a); }}>
                    <span>{o.label}</span><i className="fa-solid fa-chevron-right" />
                  </button>
                ))}
              </div>
            )}
            {q.type === 'multi' && (
              <div className="quiz__grid">
                {q.options!.map((o) => {
                  const on = (value as string[]).includes(o.id);
                  return (
                    <button key={o.id} className={`quiz__tile${on ? ' quiz__tile--on' : ''}`} onClick={() => toggle(o.id)} aria-pressed={on}>
                      {o.icon && <i className={`fa-solid ${o.icon}`} />}<span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {q.type === 'skills' && (
              <div className="chips chips--compact">
                {skills.map((s) => {
                  const on = (value as string[]).includes(s.id);
                  return <button key={s.id} className={`chip${on ? ' chip--active' : ''}`} onClick={() => toggle(s.id)} aria-pressed={on}>{s.label_bg}</button>;
                })}
              </div>
            )}

            <div className="quiz__nav">
              <button className="btn btn--muted btn--sm" onClick={() => (step ? setStep(step - 1) : setPhase(saved ? 'result' : 'intro'))}>
                <i className="fa-solid fa-arrow-left" /> Назад
              </button>
              {q.type !== 'single' && (
                <button className="btn btn--primary btn--sm" disabled={!canNext} onClick={next}>
                  {step < questions.length - 1 ? 'Напред' : 'Виж прогнозата'} <i className="fa-solid fa-arrow-right" />
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="result">
            <div className="result__badge glow-cyan"><i className="fa-solid fa-atom spin-slow" /></div>
            <p className="result__text">Изчисляваме прогнозата от реалните данни…</p>
          </div>
        )}

        {phase === 'fallback' && <Fallback answers={answers} error={error} onRetry={() => finish(answers)} onRestart={start} onOpenCareer={onOpenCareer} />}
      </div>
    </section>
  );
}

/** Shown only if the server cannot build the forecast: careers by interest, without data. */
function Fallback({ answers, error, onRetry, onRestart, onOpenCareer }: {
  answers: Answers; error: string | null; onRetry: () => void; onRestart: () => void; onOpenCareer: (id: string) => void;
}) {
  const interestCats = (answers.interests as string[]).flatMap((id) => QUESTIONS[0].options!.find((o) => o.id === id)?.categories ?? []);
  const cat = (interestCats.find((c) => c !== 'core') ?? 'ai') as Category;
  const recommended = careers.filter((c) => c.category === cat);
  return (
    <div className="result">
      <h3 className="result__title gradient-text">Прогнозата не можа да бъде изчислена</h3>
      <p className="forecast__error">{error}</p>
      <p className="result__text">Без пазарните данни можем да покажем само професиите от каталога, които отговарят на интересите ви ({categoryNames[cat]}).</p>
      <div className="result__list">
        {recommended.map((c) => (
          <div key={c.id} className="result-item">
            <div className="result-item__info"><div><h5>{c.title}</h5><p>{c.shortDesc}</p></div></div>
            <button className="btn btn--primary btn--sm" onClick={() => onOpenCareer(c.id)}>Преглед</button>
          </div>
        ))}
      </div>
      <div className="forecast__actions">
        <button className="btn btn--gradient btn--sm" onClick={onRetry}><i className="fa-solid fa-rotate" /> Опитай отново</button>
        <button className="btn btn--muted btn--sm" onClick={onRestart}>Започни отначало</button>
      </div>
    </div>
  );
}
