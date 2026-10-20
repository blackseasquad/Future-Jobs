import { hardSkills, softSkills, type SkillItem } from '../data/skills';

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

export default function SkillsTab() {
  return (
    <section className="stack">
      <div className="panel panel--lg glass">
        <h3 className="skills__title gradient-text">Карта на Ключовите Умения за 2030+</h3>
        <p className="skills__lead">Кои са уменията, които Изкуственият Интелект не може лесно да замени?</p>
        <div className="two-col">
          <SkillGroup title="Човешки (Soft) Умения" icon="fa-user-gear" tone="cyan" items={softSkills} />
          <SkillGroup title="Технологични (Hard) Умения" icon="fa-microchip" tone="purple" items={hardSkills} />
        </div>
      </div>
    </section>
  );
}
