import { careers } from '../data/careers';

interface SimulatorTabProps {
  roleId: string;
  onChange: (id: string) => void;
}

export default function SimulatorTab({ roleId, onChange }: SimulatorTabProps) {
  const role = careers.find((c) => c.id === roleId) ?? careers[0];

  return (
    <section className="narrow narrow--wide">
      <div className="panel panel--lg glass">
        <div className="sim__head">
          <div>
            <h3 className="sim__title">Симулатор: „Един ден през 2035 г.“</h3>
            <p className="sim__lead">Изберете професия, за да видите как протича един работен ден</p>
          </div>
          <select
            className="select"
            value={role.id}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Професия за симулация"
          >
            {careers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <ol className="timeline">
          {role.dayTimeline.map((step) => (
            <li key={step.time} className="timeline__item">
              <span className="timeline__dot" />
              <span className="timeline__time">{step.time}</span>
              <p className="timeline__task">{step.task}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
