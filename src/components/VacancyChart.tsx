import '../lib/charts';
import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import type { MarketSnapshot } from '../lib/marketData';

const GEO_LABEL: Record<string, string> = { EU27_2020: 'ЕС-27', BG: 'България' };
const GEO_COLOR: Record<string, string> = { EU27_2020: '#00f0ff', BG: '#34d399' };
const MUTED = '#94a3b8';
const GRID = 'rgba(255, 255, 255, 0.05)';

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: MUTED, font: { size: 11 } } },
    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${String(c.parsed.y).replace('.', ',')}%` } },
  },
  scales: {
    x: { ticks: { color: MUTED, font: { size: 10 } }, grid: { color: GRID } },
    y: { ticks: { color: MUTED, callback: (v) => `${v}%` }, grid: { color: GRID }, beginAtZero: true },
  },
};

/** Eurostat job vacancy rate — real, quarterly official statistics. */
export default function VacancyChart({ data }: { data: MarketSnapshot | null }) {
  const series = data?.vacancies?.series ?? [];
  const sectors = useMemo(() => [...new Map(series.map((s) => [s.key, s.label])).entries()], [series]);
  const [sector, setSector] = useState('JVR|B-S');

  if (!series.length) return null;
  const chosen = series.filter((s) => s.key === sector);
  const periods = [...new Set(chosen.flatMap((s) => s.points.map((p) => p.period)))].sort();
  const chartData = {
    labels: periods,
    datasets: chosen.map((s) => ({
      label: GEO_LABEL[s.geo] ?? s.geo,
      data: periods.map((p) => s.points.find((x) => x.period === p)?.value ?? null),
      borderColor: GEO_COLOR[s.geo] ?? '#a855f7',
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 2,
    })),
  };
  const last = periods[periods.length - 1];

  return (
    <div className="panel glass">
      <h3 className="panel__title panel__title--cyan">
        <i className="fa-solid fa-briefcase" /> Свободни работни места — реални данни (%)
      </h3>
      <div className="chips chips--compact">
        {sectors.map(([key, label]) => (
          <button key={key} className={`chip${key === sector ? ' chip--active' : ''}`} onClick={() => setSector(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="chart-box">
        <Line data={chartData} options={options} />
      </div>
      <p className="source-note">
        <span className="tag tag--fact">Факт</span> Дял на незаетите работни места от всички работни места, без сезонно изглаждане.
        Източник: <a href="https://ec.europa.eu/eurostat/databrowser/view/jvs_q_nace2/default/table" target="_blank" rel="noreferrer">Eurostat, jvs_q_nace2</a>
        {last && <> · период {periods[0]} – {last}</>}.
      </p>
    </div>
  );
}
