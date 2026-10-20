export type Category = 'ai' | 'green' | 'biomed' | 'space' | 'meta';
export type CategoryFilter = Category | 'all';
export type Tab = 'catalog' | 'quiz' | 'analytics' | 'skills' | 'simulator';

export interface TimelineStep {
  time: string;
  task: string;
}

export interface Career {
  id: string;
  title: string;
  category: Category;
  catLabel: string;
  icon: string;
  gradient: [string, string];
  growth: number;
  salary: number;
  risk: number;
  skills: string[];
  shortDesc: string;
  fullDesc: string;
  tasks: string[];
  dayTimeline: TimelineStep[];
}

export interface QuizOption {
  text: string;
  category: Category;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
}

export type Notify = (message: string) => void;
