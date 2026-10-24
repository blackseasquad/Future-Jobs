import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import type { User } from '@supabase/supabase-js';
import { careers } from '../data/careers';
import type { MarketSnapshot } from '../lib/marketData';
import type { Notify } from '../types';
import DataStatus from './DataStatus';
import OccupationGroupsChart from './OccupationGroupsChart';
import VacancyChart from './VacancyChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

const labels = careers.map((c) => (c.title.length > 15 ? c.title.substring(0, 15) + '...' : c.title));
const MUTED = '#94a3b8';
const GRID = 'rgba(255, 255, 255, 0.05)';

const scales = {
  x: { ticks: { color: MUTED, font: { size: 10 } }, grid: { color: GRID } },
  y: { ticks: { color: MUTED }, grid: { color: GRID } },
};
const plugins = { legend: { labels: { color: MUTED, font: { size: 11 } } } };

const barOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false, plugins, scales };
const lineOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins, scales };

const growthData = {
  labels,
  datasets: [
    { label: 'Ръст (%)', data: careers.map((c) => c.growth), backgroundColor: '#00f0ff', borderRadius: 6 },
    { label: 'Риск от AI (%)', data: careers.map((c) => c.risk), backgroundColor: '#ff007f', borderRadius: 6 },
  ],
};

const salaryData = {
  labels,
  datasets: [
    {
      label: 'Заплата ($ USD/година)',
      data: careers.map((c) => c.salary),
      borderColor: '#7000ff',
      backgroundColor: 'rgba(112, 0, 255, 0.15)',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointBackgroundColor: '#00f0ff',
    },
  ],
};

interface AnalyticsTabProps {
  market: MarketSnapshot | null;
  marketError: string | null;
  onReloadMarket: () => void;
  user: User | null;
  notify: Notify;
}

export default function AnalyticsTab({ market, marketError, onReloadMarket, user, notify }: AnalyticsTabProps) {
  return (
    <section className="stack">
      <VacancyChart data={market} />
      <OccupationGroupsChart data={market} />
      <div className="two-col">
        <div className="panel glass">
          <h3 className="panel__title panel__title--cyan">
            <i className="fa-solid fa-chart-line" /> Прогнозиран Ръст (%) спрямо Риск от AI
          </h3>
          <div className="chart-box">
            <Bar data={growthData} options={barOptions} />
          </div>
        </div>

        <div className="panel glass">
          <h3 className="panel__title panel__title--purple">
            <i className="fa-solid fa-sack-dollar" /> Средно Годишно Възнаграждение ($ USD)
          </h3>
          <div className="chart-box">
            <Line data={salaryData} options={lineOptions} />
          </div>
        </div>
      </div>

      <p className="source-note">
        <span className="tag tag--model">Илюстративно</span> Диаграмите за ръст, риск от AI и заплати по-горе и прогнозите по-долу
        са редакционни оценки за примерните професии в каталога, а не измерени статистики.
      </p>

      <div className="three-col">
        <div className="outlook outlook--cyan glass">
          <h4>
            <i className="fa-solid fa-brain" /> Изкуствен Интелект
          </h4>
          <p>
            До 2030 г. над 40% от рутинните кодинг и бизнес задачи ще се изпълняват от AI агенти.
            Фокусът се измества към AI Етика, Архитектура на подкани и Одит на алгоритми.
          </p>
        </div>
        <div className="outlook outlook--emerald glass">
          <h4>
            <i className="fa-solid fa-seedling" /> Зелен Преход
          </h4>
          <p>
            Инвестициите във възобновяема енергия и въглеродно неутрални технологии ще разкрият над
            24 милиона нови работни места в световен мащаб.
          </p>
        </div>
        <div className="outlook outlook--pink glass">
          <h4>
            <i className="fa-solid fa-heart-pulse" /> Дълголетие & Биотех
          </h4>
          <p>
            Застаряването на населението и генното инженерство (CRISPR) изискват нови специалисти по
            персонализирана медицина и генна терапия.
          </p>
        </div>
      </div>

      <DataStatus data={market} error={marketError} user={user} notify={notify} onReload={onReloadMarket} />
    </section>
  );
}
