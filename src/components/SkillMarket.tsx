import '../lib/charts';
import { Fragment, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { CONFIDENCE_LABELS, fmtDate, fmtPct, type MarketSnapshot, type SkillData } from '../lib/marketData';

const MUTED = '#94a3b8';
const geoName = (g: string | null) => (g === 'EU27_2020' ? 'ЕС-27' : g === 'BG' ? 'България' : g ?? '—');
const GRID = 'rgba(255, 255, 255, 0.05)';
const COMPONENT_LABELS: Record<string, string> = {
  demand: 'Текущо търсене', momentum: 'Промяна в търсенето', longTerm: 'Дългосрочна прогноза',
  occupationTrend: 'Тенденция на заетостта', breadth: 'Приложимост в професии', connectivity: 'Връзка с други умения',
};

const historyOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${String(c.parsed.y).replace('.', ',')}% от обявите` } } },
  scales: {
    x: { ticks: { color: MUTED, font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: GRID } },
    y: { ticks: { color: MUTED, callback: (v) => `${v}%` }, grid: { color: GRID }, beginAtZero: true },
  },
};

function change(s: SkillData, days: 30 | 90) {
  const c = days === 30 ? s.score?.inputs.change30 : s.score?.inputs.change90;
  if (!c) return <span className="muted">няма данни</span>;
  const up = c.relative >= 0;
  return (
    <span className={up ? 'delta delta--up' : 'delta delta--down'} title={`${c.from} → ${c.to}, ${c.observations} наблюдения`}>
      {up ? '▲' : '▼'} {Math.abs(c.relative * 100).toFixed(0)}%
    </span>
  );
}

function SkillDetails({ s, labelById }: { s: SkillData; labelById: Map<string, string> }) {
  const inp = s.score?.inputs;
  const chart = {
    labels: s.history.map((h) => h.date.slice(5)),
    datasets: [{ data: s.history.map((h) => +(h.share * 100).toFixed(2)), borderColor: '#00f0ff', backgroundColor: 'rgba(0,240,255,0.1)', fill: true, tension: 0.25, pointRadius: 2 }],
  };
  return (
    <div className="skill-details">
      <div className="skill-details__grid">
        <div>
          <h5>История на търсенето</h5>
          {s.history.length > 1 ? (
            <div className="chart-box chart-box--sm"><Line data={chart} options={historyOptions} /></div>
          ) : (
            <p className="muted">Историята се натрупва с всяко ежедневно обновяване (засега {s.history.length} наблюдение).</p>
          )}
        </div>
        <div>
          <h5>Компоненти на оценката <span className="tag tag--model">Модел</span></h5>
          <ul className="components">
            {Object.entries(s.score?.components ?? {}).map(([k, c]) => (
              <li key={k}>
                <span>{COMPONENT_LABELS[k] ?? k} <small>({Math.round(c.weight * 100)}%)</small></span>
                {c.percentile === null ? <span className="muted">няма данни</span> : (
                  <span className="components__bar"><span style={{ width: `${c.percentile}%` }} /><b>{Math.round(c.percentile)}</b></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ul className="facts">
        {inp?.demand && (
          <li><span className="tag tag--fact">Факт</span> {inp.demand.ads_matching} от {inp.demand.ads_total} обяви ({fmtPct(inp.demand.share)}) към {fmtDate(inp.demand.date)} — Remotive, Arbeitnow.</li>
        )}
        {inp?.occupation_source === 'editorial' && (
          <li><span className="tag tag--model">Връзка</span> Групите професии за това умение са редакционно зададени, защото речникът ESCO още не е наличен.</li>
        )}
        {inp && inp.occupations.essential + inp.occupations.optional > 0 && (
          <li><span className="tag tag--fact">Факт</span> ESCO: свързано с {inp.occupations.essential + inp.occupations.optional} професии (основно умение в {inp.occupations.essential}).</li>
        )}
        {inp?.occupation_trend && (
          <li><span className="tag tag--fact">Факт</span> Заетост в свързаните професии в ЕС: {inp.occupation_trend.cagr_pct > 0 ? '+' : ''}{inp.occupation_trend.cagr_pct.toFixed(1).replace('.', ',')}% средно годишно ({inp.occupation_trend.period}, Eurostat).</li>
        )}
        {inp?.long_term ? (
          <li><span className="tag tag--forecast">Прогноза</span> Cedefop {inp.long_term.edition}: {inp.long_term.annual_growth_pct > 0 ? '+' : ''}{inp.long_term.annual_growth_pct.toFixed(2).replace('.', ',')}% годишен ръст на заетостта в свързаните професии ({geoName(inp.long_term.geo)}, {inp.long_term.period}).</li>
        ) : (
          <li><span className="tag tag--forecast">Прогноза</span> Няма импортирана дългосрочна прогноза (Cedefop) за свързаните професии.</li>
        )}
        {s.wef && <li><span className="tag tag--forecast">Експертна оценка</span> {s.wef} (WEF Future of Jobs 2025).</li>}
        {!!inp?.related.length && (
          <li><span className="tag tag--fact">Факт</span> Най-често заедно в обявите с: {inp.related.map((r) => labelById.get(r.id) ?? r.id).join(', ')}.</li>
        )}
        {s.esco && (
          <li>
            <span className="tag tag--fact">ESCO</span>{' '}
            <a href={s.esco.uri} target="_blank" rel="noreferrer">{s.esco.label_bg ?? s.esco.label_en}</a>
            {s.esco.synonyms.length > 0 && <> · синоними: {s.esco.synonyms.join(', ')}</>}
          </li>
        )}
      </ul>
    </div>
  );
}

/** Live table of tracked skills with the Future Skills Score and its evidence. */
export default function SkillMarket({ data }: { data: MarketSnapshot | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const skills = useMemo(
    () => [...(data?.skills ?? [])].sort((a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1)),
    [data],
  );
  const labelById = useMemo(() => new Map(skills.map((s) => [s.id, s.label_bg])), [skills]);
  if (!data?.configured || !skills.length) return null;
  const computed = skills.find((s) => s.score)?.score?.computed_date;

  return (
    <div className="panel panel--lg glass">
      <h3 className="skills__title gradient-text">Умения на пазара на труда — реални данни</h3>
      <p className="skills__lead">
        Обновява се всеки ден в 06:00. Изчислено на {fmtDate(computed)}. Натиснете умение за доказателствата зад оценката.
      </p>
      <div className="table-wrap">
        <table className="data-table data-table--skills">
          <thead>
            <tr>
              <th>Умение</th>
              <th title="Собствен модел на приложението, 0–100">Future Skills Score <span className="tag tag--model">Модел</span></th>
              <th>Търсене днес <span className="tag tag--fact">Факт</span></th>
              <th>30 дни</th>
              <th>90 дни</th>
              <th>Дългосрочно</th>
              <th>Увереност</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <Fragment key={s.id}>
                <tr className="data-table__row" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  <td><i className={`fa-solid fa-chevron-${open === s.id ? 'down' : 'right'} muted`} /> {s.label_bg}</td>
                  <td>{s.score?.value ?? <span className="muted">недостатъчно данни</span>}</td>
                  <td>{s.score?.inputs.demand ? fmtPct(s.score.inputs.demand.share) : <span className="muted">—</span>}</td>
                  <td>{change(s, 30)}</td>
                  <td>{change(s, 90)}</td>
                  <td>{s.score?.inputs.long_term ? `${s.score.inputs.long_term.annual_growth_pct.toFixed(1).replace('.', ',')}%/год. (${geoName(s.score.inputs.long_term.geo)})` : <span className="muted">няма прогноза</span>}</td>
                  <td>{CONFIDENCE_LABELS[s.score?.confidence ?? 'insufficient']}</td>
                </tr>
                {open === s.id && (
                  <tr className="data-table__details">
                    <td colSpan={7}><SkillDetails s={s} labelById={labelById} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="source-note">
        <span className="tag tag--model">Модел</span> Future Skills Score е собствен модел на FUTURE-JOBS (версия {data.methodology?.version}), а не
        научно доказана прогноза. Всеки компонент е перцентил спрямо останалите следени умения; липсващите компоненти не се
        отчитат и оценка се показва само при поне 50% покритие. <a href={data.methodology?.doc} target="_blank" rel="noreferrer">Методология</a>.
        Обявите (Remotive — дистанционни позиции, Arbeitnow — основно Германия) не са представителни за целия пазар.
      </p>
    </div>
  );
}
