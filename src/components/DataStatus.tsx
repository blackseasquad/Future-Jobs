import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { fetchIsAdmin, fmtDate, fmtDateTime, runAdminRefresh, type MarketSnapshot } from '../lib/marketData';
import type { Notify } from '../types';

const STATUS_LABEL: Record<string, string> = {
  ok: 'работи', error: 'грешка', manual: 'ръчен импорт', not_configured: 'не е настроен',
  success: 'успешно', partial: 'частично', failed: 'неуспешно', running: 'в процес', skipped: 'пропуснато',
};
const TRIGGER_LABEL: Record<string, string> = { cron: 'автоматично', manual: 'ръчно', test: 'тест' };

function Dot({ status }: { status: string | null }) {
  const tone = status === 'ok' || status === 'success' ? 'ok' : status === 'partial' || status === 'manual' ? 'warn' : status ? 'bad' : 'idle';
  return <span className={`status-dot status-dot--${tone}`} aria-hidden />;
}

/** "Last update / source status / refresh history" panel, compact variant for other tabs. */
export function FreshnessBadge({ data }: { data: MarketSnapshot | null }) {
  if (!data?.configured || !data.freshness) return null;
  const f = data.freshness;
  return (
    <p className={`freshness${f.stale ? ' freshness--stale' : ''}`}>
      <i className={`fa-solid ${f.stale ? 'fa-triangle-exclamation' : 'fa-rotate'}`} /> Последна успешна актуализация:{' '}
      <strong>{fmtDateTime(f.lastSuccessfulRunAt)}</strong>
      {f.stale && ' — данните може да са остарели'}
    </p>
  );
}

export default function DataStatus({ data, error, user, notify, onReload }: {
  data: MarketSnapshot | null;
  error: string | null;
  user: User | null;
  notify: Notify;
  onReload: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return setIsAdmin(false);
    void fetchIsAdmin().then(setIsAdmin);
  }, [user]);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await runAdminRefresh();
      notify(`Обновяването приключи: ${STATUS_LABEL[r.status] ?? r.status}`);
      onReload();
    } catch {
      notify('Ръчното обновяване не успя.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="panel glass data-note">{error}</div>;
  if (!data) return <div className="panel glass data-note">Зареждане на пазарните данни…</div>;
  if (!data.configured) {
    return (
      <div className="panel glass data-note">
        <i className="fa-solid fa-database" /> Системата за реални пазарни данни все още не е свързана с база данни.
      </div>
    );
  }

  const f = data.freshness!;
  return (
    <div className="panel glass">
      <h3 className="panel__title panel__title--cyan">
        <i className="fa-solid fa-satellite-dish" /> Източници на данни и актуалност
      </h3>
      <div className={`freshness-box${f.stale ? ' freshness-box--stale' : ''}`}>
        <div>
          <span className="stats__label">Последна успешна актуализация</span>
          <strong>{fmtDateTime(f.lastSuccessfulRunAt)}</strong>
        </div>
        <div>
          <span className="stats__label">Последно изпълнение</span>
          <strong><Dot status={f.lastRunStatus} /> {STATUS_LABEL[f.lastRunStatus ?? ''] ?? '—'}</strong>
        </div>
        <div>
          <span className="stats__label">График</span>
          <strong>всеки ден в 06:00 (София)</strong>
        </div>
        {f.stale && (
          <p className="freshness-box__warn">
            <i className="fa-solid fa-triangle-exclamation" /> Няма успешна актуализация в последните {f.staleAfterHours} часа — показваме
            последните валидни данни.
          </p>
        )}
        {isAdmin && (
          <button className="btn btn--ghost btn--sm" onClick={refresh} disabled={busy}>
            <i className={`fa-solid fa-rotate${busy ? ' spin-slow' : ''}`} /> {busy ? 'Обновяване…' : 'Обнови сега'}
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Източник</th><th>Статус</th><th>Период на данните</th><th>Последен успех</th><th>Честота</th></tr>
          </thead>
          <tbody>
            {data.sources!.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                  {s.license && <span className="data-table__sub">{s.license}</span>}
                </td>
                <td title={s.last_error ?? undefined}>
                  <Dot status={s.last_status} /> {STATUS_LABEL[s.last_status ?? ''] ?? '—'}
                  {s.last_status === 'error' && s.last_error && <span className="data-table__sub">{s.last_error}</span>}
                </td>
                <td>{s.data_period ?? '—'}{s.source_updated_at && <span className="data-table__sub">публикувано {fmtDate(s.source_updated_at)}</span>}</td>
                <td>{fmtDateTime(s.last_success_at)}</td>
                <td>{s.update_frequency ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="runs">
        <summary>История на обновяванията ({data.runs!.length})</summary>
        <ul className="runs__list">
          {data.runs!.map((r) => (
            <li key={r.id}>
              <Dot status={r.status} /> {fmtDateTime(r.started_at)} · {TRIGGER_LABEL[r.trigger] ?? r.trigger} · {STATUS_LABEL[r.status] ?? r.status}
              <span className="data-table__sub">
                {Object.entries(r.sources).filter(([k]) => k !== 'scores' && k !== 'jobs_combined')
                  .map(([k, v]) => `${k}: ${STATUS_LABEL[v ?? ''] ?? v}`).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
