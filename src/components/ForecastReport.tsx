import { useState, type FormEvent } from 'react';
import { fmtDate, fmtSigned, type MarketSnapshot } from '../lib/marketData';
import { emailForecast, reportUrl, type ForecastReport as Report } from '../lib/forecast';
import type { Notify } from '../types';
import { RecommendationItemView } from './SkillRecommendations';

const HORIZON_ICONS = { short: 'fa-bolt', medium: 'fa-route', long: 'fa-mountain-sun' } as const;
const geoName = (g: string) => (g === 'EU27_2020' ? 'ЕС-27' : g === 'BG' ? 'България' : g);

interface Props {
  token: string;
  report: Report;
  market: MarketSnapshot | null;
  notify: Notify;
  onRetake: () => void;
  onOpenCareer: (id: string) => void;
}

function EmailForm({ token, notify }: { token: string; notify: Notify }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) return setError('Потвърдете, че искате да получите прогнозата.');
    setState('sending');
    setError(null);
    try {
      await emailForecast(token, email);
      setState('sent');
      notify('Прогнозата е изпратена на ' + email);
    } catch (err) {
      setState('idle');
      setError((err as Error).message);
    }
  };

  if (state === 'sent') {
    return <p className="forecast__ok"><i className="fa-solid fa-envelope-circle-check" /> Изпратено. Проверете пощата си (и папка „Спам“).</p>;
  }
  return (
    <form className="forecast__email" onSubmit={submit}>
      <label className="field">
        <span>Имейл адрес</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@primer.bg" autoComplete="email" />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Искам да получа тази прогноза по имейл. Адресът се използва само за това изпращане и не се съхранява.</span>
      </label>
      {error && <p className="forecast__error">{error}</p>}
      <button className="btn btn--gradient btn--sm" disabled={state === 'sending'}>
        <i className="fa-solid fa-paper-plane" /> {state === 'sending' ? 'Изпращане…' : 'Изпрати ми прогнозата'}
      </button>
    </form>
  );
}

export default function ForecastReport({ token, report, market, notify, onRetake, onOpenCareer }: Props) {
  const labelById = new Map((market?.skills ?? []).map((s) => [s.id, s.label_bg]));
  const link = reportUrl(token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify('Линкът е копиран.');
    } catch {
      window.prompt('Копирайте линка:', link);
    }
  };

  return (
    <div className="forecast">
      <div className="result">
        <div className="result__badge glow-cyan"><i className="fa-solid fa-chart-line" /></div>
        <h3 className="result__title gradient-text">Вашата кариерна прогноза</h3>
        <p className="result__text">
          Изготвена на {fmtDate(report.created_at)} от вашите отговори и реалните данни към {fmtDate(report.data_date)}.
          {report.top_category_label && <> Най-силно ви привлича: <strong>{report.top_category_label}</strong>.</>}
        </p>
      </div>

      <section className="forecast__block">
        <h4 className="section-label">Групи професии, които ви подхождат</h4>
        {report.groups.length ? (
          <ol className="groups-grid groups-grid--report">
            {report.groups.map((g, i) => {
              const eu = g.eurostat.EU27_2020;
              const bg = g.eurostat.BG;
              const f = g.cedefop.find((x) => x.geo === (report.region === 'BG' ? 'BG' : 'EU27_2020')) ?? g.cedefop[0];
              return (
                <li key={g.isco2} className="group-card">
                  <div className="group-card__head">
                    <span className="group-card__rank">{i + 1}</span>
                    <div><strong>{g.label_bg}</strong><small className="muted"> ISCO-08 {g.isco2}</small></div>
                  </div>
                  <ul className="group-card__facts">
                    {eu?.cagr_pct != null && <li><span className="tag tag--fact">Факт</span> ЕС-27: {fmtSigned(eu.cagr_pct)}%/год. ({eu.from}–{eu.to})</li>}
                    {bg?.cagr_pct != null && <li><span className="tag tag--fact">Факт</span> България: {fmtSigned(bg.cagr_pct)}%/год.</li>}
                    {f && <li><span className="tag tag--forecast">Прогноза</span> {fmtSigned(f.annual_growth_pct)}%/год. до {f.period.split('–')[1]} ({geoName(f.geo)}, Cedefop)</li>}
                    <li><span className="tag tag--model">Модел</span> съвпадение с отговорите {g.fit}/100 · пазарни данни {g.data_percentile}/100</li>
                  </ul>
                  {!!g.skills_matched.length && (
                    <div className="pills">{g.skills_matched.slice(0, 5).map((s) => <span key={s} className="pill">{labelById.get(s) ?? s}</span>)}</div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : <p className="data-note">Няма достатъчно данни за групите професии.</p>}
      </section>

      {report.careers.length > 0 && (
        <section className="forecast__block">
          <h4 className="section-label">Бъдещи професии за вдъхновение</h4>
          <div className="result__list">
            {report.careers.map((c) => (
              <div key={c.id} className="result-item">
                <div className="result-item__info"><div><h5>{c.title}</h5><p>{c.category_label}</p></div></div>
                <button className="btn btn--primary btn--sm" onClick={() => onOpenCareer(c.id)}>Преглед</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="forecast__block">
        <h4 className="section-label">Умения, които да започнете да развивате</h4>
        <div className="horizons">
          {(['short', 'medium', 'long'] as const).map((key) => {
            const h = report.horizons[key];
            return (
              <section key={key} className="horizon">
                <h4><i className={`fa-solid ${HORIZON_ICONS[key]}`} /> {h.label}</h4>
                {h.available
                  ? <ol className="rec-list">{h.items.map((it) => <RecommendationItemView key={it.skill_id} item={it} compact />)}</ol>
                  : <p className="data-note">{h.reason}</p>}
              </section>
            );
          })}
        </div>
      </section>

      <section className="forecast__block forecast__plan">
        <h4 className="section-label">Вашият ритъм на учене</h4>
        <p>{report.plan.text} {report.plan.tip}</p>
        <small className="muted"><span className="tag tag--model">Препоръка</span> {report.plan.note}</small>
      </section>

      <section className="forecast__block forecast__save">
        <h4 className="section-label">Запазете прогнозата</h4>
        <p className="muted">Прогнозата е запазена на това устройство (и в профила ви, ако сте влезли) — ще я виждате тук, без да правите теста отново. Може да я отворите и с линка или да я получите по имейл.</p>
        <div className="forecast__actions">
          <button className="btn btn--ghost btn--sm" onClick={copy}><i className="fa-solid fa-link" /> Копирай линк</button>
          <button className="btn btn--ghost btn--sm" onClick={() => window.print()}><i className="fa-solid fa-print" /> Печат / PDF</button>
          <button className="btn btn--muted btn--sm" onClick={onRetake}><i className="fa-solid fa-rotate-right" /> Попълни теста отново</button>
        </div>
        <EmailForm token={token} notify={notify} />
      </section>

      <p className="source-note">
        <span className="tag tag--fact">Факт</span> Eurostat, обяви (Remotive, Arbeitnow) · <span className="tag tag--forecast">Прогноза</span> Cedefop,
        WEF · <span className="tag tag--model">Модел</span> собствени оценки на FUTURE-JOBS. {report.limitations.join(' ')}
      </p>
    </div>
  );
}
