import { careers } from '../data/careers';
import Modal from './Modal';

interface FavoritesModalProps {
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onExport: () => void;
  onClose: () => void;
}

export default function FavoritesModal({ favorites, onToggleFavorite, onExport, onClose }: FavoritesModalProps) {
  const items = careers.filter((c) => favorites.includes(c.id));

  return (
    <Modal onClose={onClose} labelledBy="fav-modal-title">
      <div className="modal__header">
        <h3 id="fav-modal-title" className="modal__title modal__title--sm">
          <i className="fa-solid fa-bookmark accent" /> Запазени професии
        </h3>
        <button className="modal__close" onClick={onClose} aria-label="Затвори">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <div className="modal__body">
        {items.length === 0 ? (
          <p className="fav-empty">Нямате запазени професии.</p>
        ) : (
          <>
            <ul className="fav-list">
              {items.map((item) => (
                <li key={item.id} className="fav-item">
                  <div className="fav-item__info">
                    <div className="fav-item__icon">
                      <i className={`fa-solid ${item.icon}`} />
                    </div>
                    <div>
                      <h4>{item.title}</h4>
                      <span>
                        ${item.salary.toLocaleString()}/г. • +{item.growth}% ръст
                      </span>
                    </div>
                  </div>
                  <button
                    className="fav-item__remove"
                    onClick={() => onToggleFavorite(item.id)}
                    aria-label={`Премахни ${item.title}`}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn btn--ghost" onClick={onExport}>
              <i className="fa-solid fa-download" /> Изтегли плана
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
