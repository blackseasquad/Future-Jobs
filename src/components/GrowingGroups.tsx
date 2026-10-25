import { useMemo, useState } from 'react';
import { fmtSigned, type MarketSnapshot, type OccupationGroup } from '../lib/marketData';

type SortKey = 'eu' | 'bg' | 'forecast';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'eu', label: 'Ръст в ЕС (последни 5 г.)' },
  { id: 'bg', label: 'Ръст в България (последни 5 г.)' },
  { id: 'forecast', label: 'Прогноза до 2035 (Cedefop)' },
];

const forecastOf = (g: OccupationGroup) => g.cedefop.find((f) => f.geo === 'EU27_2020') ?? g.cedefop[0] ?? null;
const metric = (g: OccupationGroup, k: SortKey) =>
  k === 'eu' ? g.eurostat.EU27_2020?.cagr_pct ?? null : k === 'bg' ? g.eurostat.BG?.cagr_pct ?? null : forecastOf(g)?.annual_growth_pct ?? null;
const geoName = (g: string) => (g === 'EU27_2020' ? 'ЕС-27' : g === 'BG' ? 'България' : g);

/** All ISCO-08 occupation groups ranked by real data — updated by the daily refresh. */
export default function GrowingGroups({ data }: { data: MarketSnapshot | null }) {
  const [sort, setSort] = useState<SortKey>('eu');
  const [showAll, setShowAll] = useState(false);
  const labelById = useMemo(() => new Map((data?.skills ?? []).map((s) => [s.id, s.label_bg])), [data]);
  const groups = useMemo(
    () => Object.values(data?.occupationGroups ?? {})
      .filter((g) => metric(g, sort) !== null)
      .sort((a, b) => (metric(b, sort) ?? 0) - (metric(a, sort) ?? 0)),
    [data, sort],
  );
  if (!data?.configured || !data.occupationGroups || !groups.length) return null;
  const shown = showAll ? groups : groups.slice(0, 9);
  const anyForecast = Object.values(data.occupationGroups).some((g) => g.cedefop.length);

  return (
    <div className="panel panel--lg glass">
      <h3 className="skills__title gradient-text">Растящи професии по реални данни</h3>
      <p className="skills__lead">
        Всички групи професии по класификацията ISCO-08, подредени по реалните данни на Eurostat и Cedefop.
        Списъкът се обновява автоматично с всяко ежедневно обновяване.
      </p>
      <div className="chips chips--compact">
        {SORTS.filter((s) => s.id !== 'forecast' || anyForecast).map((s) => (
          <button key={s.id} className={`chip${sort === s.id ? ' chip--active' : ''}`} onClick={() => setSort(s.id)}>{s.label}</button>
        ))}
      </div>
      <ol className="groups-grid">
        {shown.map((g, i) => {
          const eu = g.eurostat.EU27_2020;
          const bg = g.eurostat.BG;
          const f = forecastOf(g);
          const m = metric(g, sort)!;
          return (
            <li key={g.isco2} className="group-card">
              <div className="group-card__head">
                <span className="group-card__rank">{i + 1}</span>
                <div>
                  <strong>{g.label_bg}</strong>
                  <small className="muted"> ISCO-08 {g.isco2}</small>
                </div>
                <span className={`group-card__metric ${m >= 0 ? 'delta--up' : 'delta--down'}`}>{fmtSigned(m)}%</span>
              </div>
              <ul className="group-card__facts">
                {eu && (
                  <li><span className="tag tag--fact">Факт</span> ЕС-27: {eu.cagr_pct != null ? `${fmtSigned(eu.cagr_pct)}%/год. (${eu.from}–${eu.to})` : '—'}
                    {eu.employed_thousands != null && <> · {Math.round(eu.employed_thousands).toLocaleString('bg-BG')} хил. заети</>}</li>
                )}
                {bg && (
                  <li><span className="tag tag--fact">Факт</span> България: {bg.cagr_pct != null ? `${fmtSigned(bg.cagr_pct)}%/год.` : '—'}
                    {bg.employed_thousands != null && <> · {bg.employed_thousands.toLocaleString('bg-BG')} хил. заети</>}</li>
                )}
                {f && <li><span className="tag tag--forecast">Прогноза</span> {fmtSigned(f.annual_growth_pct, 1)}%/год. до {f.period.split('–')[1]} ({geoName(f.geo)}, Cedefop)</li>}
              </ul>
              {!!g.skills?.length && (
                <div className="pills">
                  {g.skills.slice(0, 5).map((id) => <span key={id} className="pill">{labelById.get(id) ?? id}</span>)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {groups.length > 9 && (
        <button className="btn btn--ghost btn--sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Покажи по-малко' : `Покажи всички ${groups.length} групи`}
        </button>
      )}
      <p className="source-note">
        <span className="tag tag--fact">Факт</span> Среден годишен темп на изменение на заетостта, Eurostat lfsa_egai2d (15–74 г.).
        Данните за България по групи професии са с малка извадка. <span className="tag tag--forecast">Прогноза</span> Cedefop Skills Forecast
        — само за импортираните групи. Уменията под всяка група са следените от FUTURE-JOBS умения, свързани с нея.
      </p>
    </div>
  );
}
