import { fmtDate, fmtPct, fmtSigned, type CareerLive, type MarketSnapshot, type OccupationGroup } from '../lib/marketData';

const GEO: Record<string, string> = { EU27_2020: 'ЕС', BG: 'БГ' };

/** Best available real indicator for a career: Cedefop forecast first, then the Eurostat trend. */
export function headline(live: CareerLive | undefined) {
  if (!live) return null;
  for (const g of live.groups) {
    const f = g.cedefop.find((x) => x.geo === 'EU27_2020') ?? g.cedefop[0];
    if (f) return { kind: 'forecast' as const, value: f.annual_growth_pct, text: `Прогноза ${GEO[f.geo] ?? f.geo} до ${f.period.split('–')[1]}`, source: `Cedefop ${f.edition}`, group: g };
  }
  for (const g of live.groups) {
    const e = g.eurostat.EU27_2020;
    if (e?.cagr_pct != null) return { kind: 'fact' as const, value: e.cagr_pct, text: `Заетост ЕС ${e.from}–${e.to}`, source: 'Eurostat', group: g };
  }
  return null;
}

/** Compact line for the career card. */
export function CareerLiveLine({ live }: { live: CareerLive | undefined }) {
  const h = headline(live);
  if (!h) return null;
  return (
    <div className="live-line" title={`${h.group.label_bg} (ISCO ${h.group.isco2}) — ${h.source}`}>
      <span className={`tag ${h.kind === 'forecast' ? 'tag--forecast' : 'tag--fact'}`}>{h.kind === 'forecast' ? 'Прогноза' : 'Факт'}</span>
      <span>
        {h.text}: <strong className={h.value >= 0 ? 'delta--up' : 'delta--down'}>{fmtSigned(h.value)}%/год.</strong>
      </span>
    </div>
  );
}

function GroupFacts({ g }: { g: OccupationGroup }) {
  const eu = g.eurostat.EU27_2020;
  const bg = g.eurostat.BG;
  return (
    <li className="group-facts">
      <strong>{g.label_bg}</strong> <small className="muted">(ISCO-08 {g.isco2})</small>
      <ul className="facts">
        {g.cedefop.map((f) => (
          <li key={`${f.geo}-${f.period}`}>
            <span className="tag tag--forecast">Прогноза</span> {fmtSigned(f.annual_growth_pct, 2)}% среден годишен ръст на заетостта{' '}
            ({f.geo === 'EU27_2020' ? 'ЕС-27' : f.geo === 'BG' ? 'България' : f.geo}, {f.period}) <small className="muted">— Cedefop Skills Forecast {f.edition}</small>
          </li>
        ))}
        {!g.cedefop.length && (
          <li><span className="tag tag--forecast">Прогноза</span> <span className="muted">Няма импортирана прогноза на Cedefop за тази група.</span></li>
        )}
        {eu && (
          <li>
            <span className="tag tag--fact">Факт</span> ЕС-27: {eu.employed_thousands != null && <>{Math.round(eu.employed_thousands).toLocaleString('bg-BG')} хил. заети ({eu.period})</>}
            {eu.cagr_pct != null && <>; {fmtSigned(eu.cagr_pct)}% средно годишно ({eu.from}–{eu.to})</>} <small className="muted">— Eurostat lfsa_egai2d</small>
          </li>
        )}
        {bg && (
          <li>
            <span className="tag tag--fact">Факт</span> България: {bg.employed_thousands != null && <>{bg.employed_thousands.toLocaleString('bg-BG')} хил. заети ({bg.period})</>}
            {bg.cagr_pct != null && <>; {fmtSigned(bg.cagr_pct)}% средно годишно ({bg.from}–{bg.to})</>} <small className="muted">— Eurostat lfsa_egai2d</small>
          </li>
        )}
      </ul>
    </li>
  );
}

/** Full real-data section for the career details modal. */
export function CareerLiveSection({ live, market }: { live: CareerLive | undefined; market: MarketSnapshot | null }) {
  if (!market?.configured) return null;
  if (!live) return null;
  const labelById = new Map((market.skills ?? []).map((s) => [s.id, s.label_bg]));
  const withDemand = live.skills.filter((s) => s.share != null);
  return (
    <div className="live-section">
      <h4 className="section-label">Реални пазарни данни</h4>
      <p className="live-section__lead">
        Професията е нововъзникваща и няма собствена официална статистика. Данните по-долу са за най-близките групи
        професии по класификацията ISCO-08 и за търсенето на ключовите ѝ умения в обявите.
      </p>
      <ul className="group-list">{live.groups.map((g) => <GroupFacts key={g.isco2} g={g} />)}</ul>
      {withDemand.length > 0 && (
        <div>
          <strong className="live-section__sub">Търсене на ключовите умения в обявите</strong>
          <ul className="facts">
            {withDemand.map((s) => (
              <li key={s.id}>
                <span className="tag tag--fact">Факт</span> {labelById.get(s.id) ?? s.id}: {s.ads_matching} от {s.ads_total} обяви ({fmtPct(s.share!)})
                {s.score != null && <> · <span className="tag tag--model">Модел</span> Future Skills Score {s.score}</>}
              </li>
            ))}
          </ul>
          <small className="muted">Remotive и Arbeitnow, към {fmtDate(withDemand[0].date)}. Обявите не са представителни за целия пазар.</small>
        </div>
      )}
    </div>
  );
}
