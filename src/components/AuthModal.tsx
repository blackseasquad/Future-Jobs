import { useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import Modal from './Modal';

interface AuthModalProps {
  user: User | null;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignUp: (email: string, password: string) => Promise<boolean>;
  onAnonymous: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
  onInvalid: (message: string) => void;
}

export default function AuthModal({
  user,
  onSignIn,
  onSignUp,
  onAnonymous,
  onSignOut,
  onClose,
  onInvalid,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onClose();
  };

  const withCredentials = (fn: (e: string, p: string) => Promise<boolean>) => {
    if (!email.trim() || !password) {
      onInvalid('Моля, въведете имейл и парола!');
      return;
    }
    void run(() => fn(email.trim(), password));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    withCredentials(onSignIn);
  };

  return (
    <Modal onClose={onClose} labelledBy="auth-modal-title">
      <div className="modal__header">
        <h3 id="auth-modal-title" className="modal__title modal__title--sm">
          <i className="fa-solid fa-user-shield accent" /> Автентикация
        </h3>
        <button className="modal__close" onClick={onClose} aria-label="Затвори">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {user ? (
        <div className="modal__body auth-done">
          <i className="fa-solid fa-circle-check" />
          <p>
            Успешно сте влезли като <br />
            <strong>{user.email ?? `Анонимен Гост (${user.id.substring(0, 6)})`}</strong>
          </p>
          <button className="btn btn--danger btn--block" onClick={() => void onSignOut().then(onClose)}>
            Изход от акаунта
          </button>
        </div>
      ) : (
        <form className="modal__body" onSubmit={submit}>
          <p className="auth__lead">
            Влезте с вашия имейл за сигурно синхронизиране на вашите любими професии.
          </p>

          <label className="field">
            <span>Имейл адрес</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Парола</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <div className="auth__buttons">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Вход
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => withCredentials(onSignUp)}
            >
              Регистрация
            </button>
          </div>

          <div className="auth__guest">
            <button
              type="button"
              className="btn btn--muted btn--block"
              disabled={busy}
              onClick={() => void run(onAnonymous)}
            >
              Продължи като анонимен гост
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
