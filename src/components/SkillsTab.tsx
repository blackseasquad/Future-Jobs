import { hardSkills, softSkills, type SkillItem } from '../data/skills';
import type { MarketSnapshot } from '../lib/marketData';
import { FreshnessBadge } from './DataStatus';
import SkillMarket from './SkillMarket';
import SkillRecommendations from './SkillRecommendations';

function SkillGroup({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: string;
  tone: 'cyan' | 'purple';
  items: SkillItem[];
}) {
  return (
    <div className="skill-group">
      <h4 className={`skill-group__title skill-group__title--${tone}`}>
        <i className={`fa-solid ${icon}`} /> {title}
      </h4>
      <div className="skill-group__list">
        {items.map((s) => (
          <div key={s.label}>
            <div className="skill-bar__head">
              <span>{s.label}</span>
              <span className={`skill-bar__value skill-bar__value--${tone}`}>{s.value}% Важност</span>
            </div>
            <div className="progress">
              <div className={`skill-bar__fill skill-bar__fill--${tone}`} style={{ width: `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkillsTabProps {
  market: MarketSnapshot | null;
  favorites: string[];
  knownSkills: string[];
  onToggleKnown: (id: string) => void;
}

export default function SkillsTab({ market, favorites, knownSkills, onToggleKnown }: SkillsTabProps) {
  return (
    <section className="stack">
      <FreshnessBadge data={market} />
      <div className="panel panel--lg glass">
        <h3 className="skills__title gradient-text">Карта на Ключовите Умения за 2030+</h3>
        <p className="skills__lead">Кои са уменията, които Изкуственият Интелект не може лесно да замени?</p>
        <div className="two-col">
          <SkillGroup title="Човешки (Soft) Умения" icon="fa-user-gear" tone="cyan" items={softSkills} />
          <SkillGroup title="Технологични (Hard) Умения" icon="fa-microchip" tone="purple" items={hardSkills} />
        </div>
        <p className="source-note">
          <span className="tag tag--model">Илюстративно</span> Процентите в тази карта са редакционна оценка на FUTURE-JOBS, а не
          измерени данни. Реалните пазарни данни са в таблицата по-долу.
        </p>
      </div>
      <SkillRecommendations data={market} favorites={favorites} knownSkills={knownSkills} onToggleKnown={onToggleKnown} />
      <SkillMarket data={market} />
    </section>
  );
}
