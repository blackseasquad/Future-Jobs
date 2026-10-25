export interface QuizOption {
  id: string;
  label: string;
  icon?: string;
  categories?: string[];
  isco?: string[];
  skills?: string[];
  hours?: number;
}
export interface QuizQuestionDef {
  id: string;
  type: 'single' | 'multi' | 'skills';
  title: string;
  hint?: string;
  max?: number;
  options?: QuizOption[];
}
export const QUIZ_VERSION: string;
export const QUESTIONS: QuizQuestionDef[];
export function validateAnswers(raw: unknown, knownSkillIds: Set<string>): { answers?: Record<string, string | string[]>; error?: string };
export function option(qid: string, oid: string): QuizOption | null;
