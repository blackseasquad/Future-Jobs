import { useEffect, useRef, useState, type FormEvent } from 'react';
import './Assistant.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface AssistantProps {
  /** Optional: name of the tab the visitor is on (helps the assistant give relevant answers). */
  currentTab?: string;
}

const ENDPOINT = (import.meta.env.VITE_CHAT_ENDPOINT as string | undefined) || '/api/chat';

const GREETING = 'Здравей! Аз съм асистентът на FUTURE-JOBS. Питай ме всичко за сайта и как да го използваш.';
const SUGGESTIONS = [
  'Как работи тестът за съвместимост?',
  'Как да запазя професии в любими?',
  'Какво представлява симулаторът?',
];

export default function Assistant({ currentTab }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [showChips, setShowChips] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: GREETING }]);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setShowChips(false);
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setBusy(true);
    try {
      // Skip the greeting (index 0) and failed messages: the API expects the chat to start with the user.
      const payload = next
        .slice(1)
        .filter((m) => !m.error)
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload, page: currentTab ?? '' }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error || 'Request failed');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply as string }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', error: true, content: 'Съжалявам, в момента не успях да отговоря. Опитайте отново след малко.' },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="ai">
      {open && (
        <div className="ai__panel glass" role="dialog" aria-label="Асистент FUTURE-JOBS">
          <div className="ai__head">
            <span>
              <i className="fa-solid fa-wand-magic-sparkles" /> Асистент
            </span>
            <button className="ai__x" onClick={close} aria-label="Затвори асистента">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="ai__log" role="log" aria-live="polite" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai__msg ai__msg--${m.role === 'user' ? 'me' : m.error ? 'err' : 'bot'}`}>
                {m.content}
              </div>
            ))}
            {showChips && (
              <div className="ai__chips">
                {SUGGESTIONS.map((q) => (
                  <button key={q} type="button" className="ai__chip" onClick={() => void ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="ai__msg ai__msg--bot ai__dots" aria-label="Асистентът пише">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="ai__form" onSubmit={submit}>
            <input
              ref={inputRef}
              className="ai__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Напишете въпрос..."
              aria-label="Вашият въпрос"
              autoComplete="off"
            />
            <button className="ai__send" type="submit" disabled={busy || !input.trim()} aria-label="Изпрати">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </form>
        </div>
      )}

      <button
        ref={btnRef}
        className="ai__fab glow-cyan"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Затвори асистента' : 'Отвори асистента'}
        aria-expanded={open}
      >
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-comment-dots'}`} />
      </button>
    </div>
  );
}
