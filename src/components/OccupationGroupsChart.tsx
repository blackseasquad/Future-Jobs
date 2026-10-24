import '../lib/charts';
import { BarElement, Chart as ChartJS, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { careers } from '../data/careers';
import type { MarketSnapshot } from '../lib/marketData';

ChartJS.register(BarElement);

const MUTED = '#94a3b8';
const GRID = 'rgba(255, 255, 255, 0.05)';

const options: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: MUTED, font: { size: 11 } } },
    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${String(c.parsed.x).replace('.', ',')}% годишно` } },
  },
  scales: {
    x: { ticks: { color: MUTED, callback: (v) => `${v}%` }, grid: { color: GRID } },
    y: { ticks: { color: MUTED, font: { size: 10 } }, grid: { color: GRID } },
  },
};

/** Real employment trend (Eurostat) and forecast (Cedefop) for the occupation groups behind the catalogue. */
export default function OccupationGroupsChart({ data }: { data: MarketSnapshot | null }) {
  const groups = data?.occupationGroups;
  const careerMap = data?.careers;
  if (!groups || !careerMap) return null;
  const codes = [...new Set(Object.values(careerMap).flatMap((c) => c.isco2))].filter((c) => groups[c]).sort();
  if (!codes.length) return null;

  const eu = codes.map((c) => groups[c].eurostat.EU27_2020?.cagr_pct ?? null);
  const bg = codes.map((c) => groups[c].eurostat.BG?.cagr_pct ?? null);
  const forecast = codes.map((c) => (groups[c].cedefop.find((f) => f.geo === 'EU27_2020') ?? groups[c].cedefop[0])?.annual_growth_pct ?? null);
  const hasForecast = forecast.some((v) => v !== null);
  const period = codes.map((c) => groups[c].eurostat.EU27_2020).find((e) => e?.from)!;
  const fPeriod = codes.flatMap((c) => groups[c].cedefop).find(Boolean);
  const fGeos = [...new Set(codes.map((c) => (groups[c].cedefop.find((f) => f.geo === 'EU27_2020') ?? groups[c].cedefop[0])?.geo).filter(Boolean))];
  const fGeo = fGeos.map((g) => (g === 'EU27_2020' ? 'ЕС-27' : g === 'BG' ? 'България' : g)).join(' / ');

  const chartData = {
    labels: codes.map((c) => groups[c].label_bg),
    datasets: [
      { label: `Заетост ЕС-27, факт${period ? ` ${period.from}–${period.to}` : ''}`, data: eu, backgroundColor: '#00f0ff', borderRadius: 4 },
      { label: 'Заетост България, факт', data: bg, backgroundColor: '#34d399', borderRadius: 4 },
      ...(hasForecast ? [{ label: `Прогноза Cedefop${fGeo ? `, ${fGeo}` : ''}${fPeriod ? ` ${fPeriod.period}` : ''}`, data: forecast, backgroundColor: '#fbbf24', borderRadius: 4 }] : []),
    ],
  };
  const usedBy = (code: string) => careers.filter((c) => careerMap[c.id]?.isco2.includes(code)).map((c) => c.title).join(', ');

  return (
    <div className="panel glass">
      <h3 className="panel__title panel__title--cyan">
        <i className="fa-solid fa-people-group" /> Професиите от каталога — реални данни за свързаните групи
      </h3>
      <div className="chart-box">
        <Bar data={chartData} options={options} />
      </div>
      <ul className="source-note group-legend">
        {codes.map((c) => <li key={c}><strong>{groups[c].label_bg}</strong> (ISCO-08 {c}): {usedBy(c)}</li>)}
      </ul>
      <p className="source-note">
        <span className="tag tag--fact">Факт</span> Среден годишен темп на изменение на заетостта, Eurostat lfsa_egai2d.
        {hasForecast ? <> <span className="tag tag--forecast">Прогноза</span> Cedefop Skills Forecast (CC BY 4.0); липсваща лента означава, че прогноза за групата не е импортирана.</>
          : <> Прогнози на Cedefop за тези групи още не са импортирани.</>}
        {' '}Данните за България по професии са с малка извадка и по-голяма несигурност.
      </p>
    </div>
  );
}
