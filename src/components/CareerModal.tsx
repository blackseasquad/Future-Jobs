import type { Career } from '../types';
import Modal from './Modal';

interface CareerModalProps {
  career: Career;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
}

export default function CareerModal({ career: c, isFavorite, onToggleFavorite, onClose }: CareerModalProps) {
  return (
    <Modal onClose={onClose} labelledBy="career-modal-title" size="lg">
      <div className="modal__header">
        <div className="modal__heading">
          <div
            className="modal__icon"
            style={{ background: `linear-gradient(to top right, ${c.gradient[0]}, ${c.gradient[1]})` }}
          >
            <i className={`fa-solid ${c.icon}`} />
          </div>
          <div>
            <span className="badge">{c.catLabel}</span>
            <h3 id="career-modal-title" className="modal__title">
              {c.title}
            </h3>
          </div>
        </div>
        <button className="modal__close" onClick={onClose} aria-label="Затвори">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <div className="modal__body">
        <div>
          <h4 className="section-label">Описание на ролята</h4>
          <p className="modal__text">{c.fullDesc}</p>
        </div>

        <div className="stats stats--modal">
          <div>
            <span className="stats__label">Прогнозиран Ръст</span>
            <span className="stats__value stats__value--growth">+{c.growth}%</span>
          </div>
          <div>
            <span className="stats__label">Средна Заплата</span>
            <span className="stats__value stats__value--salary">${c.salary.toLocaleString()} / г.</span>
          </div>
          <div>
            <span className="stats__label">Риск от AI</span>
            <span className="stats__value stats__value--risk">{c.risk}%</span>
          </div>
        </div>

        <div>
          <h4 className="section-label">Ключови Необходими Умения</h4>
          <div className="pills">
            {c.skills.map((s) => (
              <span key={s} className="pill pill--accent">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="section-label">Основни Отговорности</h4>
          <ul className="bullets">
            {c.tasks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="modal__footer">
        <button className="btn btn--ghost" onClick={() => onToggleFavorite(c.id)}>
          <i className={`${isFavorite ? 'fa-solid fav-on' : 'fa-regular'} fa-bookmark`} />{' '}
          {isFavorite ? 'Премахни от любими' : 'Запази в любими'}
        </button>
        <button className="btn btn--primary" onClick={onClose}>
          Затвори
        </button>
      </div>
    </Modal>
  );
}
