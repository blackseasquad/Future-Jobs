import { useEffect, useState } from 'react';
import { careers, categoryNames } from '../data/careers';
import { quizQuestions } from '../data/quiz';
import { QUIZ_CATEGORY_KEY } from '../lib/marketData';
import type { Category } from '../types';

const CATEGORY_ORDER: Category[] = ['ai', 'green', 'biomed', 'space', 'meta'];

interface QuizTabProps {
  onOpenCareer: (id: string) => void;
}

function topCategory(answers: Category[]): Category {
  const tally: Record<Category, number> = { ai: 0, green: 0, biomed: 0, space: 0, meta: 0 };
  answers.forEach((a) => (tally[a] += 1));
  let top: Category = 'ai';
  let max = -1;
  for (const cat of CATEGORY_ORDER) {
    if (tally[cat] > max) {
      max = tally[cat];
      top = cat;
    }
  }
  return top;
}

export default function QuizTab({ onOpenCareer }: QuizTabProps) {
  const [answers, setAnswers] = useState<Category[]>([]);
  const total = quizQuestions.length;
  const done = answers.length >= total;
  const step = Math.min(answers.length + 1, total);
  const question = quizQuestions[answers.length];

  return (
    <section className="narrow">
      <div className="quiz glass">
        <div className="quiz__head">
          <div className="quiz__meta">
            <span className="quiz__eyebrow">Интерактивен Тест</span>
            <span className="quiz__step">
              Въпрос {step} от {total}
            </span>
          </div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${(step / total) * 100}%` }} />
          </div>
        </div>

        {!done ? (
          <div>
            <h3 className="quiz__question">{question.question}</h3>
            <div className="quiz__options">
              {question.options.map((opt) => (
                <button
                  key={opt.text}
                  className="quiz__option"
                  onClick={() => setAnswers((prev) => [...prev, opt.category])}
                >
                  <span>{opt.text}</span>
                  <i className="fa-solid fa-chevron-right" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <QuizResult
            category={topCategory(answers)}
            onOpenCareer={onOpenCareer}
            onRestart={() => setAnswers([])}
          />
        )}
      </div>
    </section>
  );
}

function QuizResult({
  category,
  onOpenCareer,
  onRestart,
}: {
  category: Category;
  onOpenCareer: (id: string) => void;
  onRestart: () => void;
}) {
  const recommended = careers.filter((c) => c.category === category);

  // Remembered so the skill recommendations (Топ Умения) can take the quiz result into account.
  useEffect(() => {
    try {
      localStorage.setItem(QUIZ_CATEGORY_KEY, category);
    } catch {
      /* storage unavailable */
    }
  }, [category]);

  return (
    <div className="result">
      <div className="result__badge glow-cyan">
        <i className="fa-solid fa-award" />
      </div>
      <h3 className="result__title gradient-text">Вашият Кариерен Профил е Готов!</h3>
      <p className="result__text">
        На база на вашите отговори, най-съвместимият за вас отрасъл е{' '}
        <strong>{categoryNames[category]}</strong>.
      </p>

      <div className="result__list">
        <h4 className="section-label">Препоръчани Професии:</h4>
        {recommended.map((item) => (
          <div key={item.id} className="result-item">
            <div className="result-item__info">
              <div className="result-item__icon">
                <i className={`fa-solid ${item.icon}`} />
              </div>
              <div>
                <h5>{item.title}</h5>
                <p>{item.shortDesc}</p>
              </div>
            </div>
            <button className="btn btn--primary btn--sm" onClick={() => onOpenCareer(item.id)}>
              Преглед
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn--ghost btn--lg" onClick={onRestart}>
        <i className="fa-solid fa-rotate-right" /> Повтори теста
      </button>
    </div>
  );
}
