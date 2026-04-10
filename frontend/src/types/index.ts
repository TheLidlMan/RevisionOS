export interface Module {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
  total_cards: number;
  due_cards: number;
  mastery_pct: number;
  total_documents: number;
}

export interface ModuleDetail extends Module {
  documents: Document[];
}

export interface ModuleCreate {
  name: string;
  description?: string;
  color?: string;
}

export interface ModuleUpdate {
  name?: string;
  description?: string;
  color?: string;
}

export interface ModuleStats {
  id: string;
  name: string;
  total_cards: number;
  due_cards: number;
  new_cards: number;
  learning_cards: number;
  review_cards: number;
  mastery_pct: number;
  total_documents: number;
  total_concepts: number;
  total_questions: number;
}

export interface Document {
  id: string;
  module_id: string;
  filename: string;
  file_type: string;
  file_path: string;
  processed: boolean;
  processing_status: 'pending' | 'processing' | 'done' | 'failed';
  word_count: number;
  created_at: string;
}

export interface Concept {
  id: string;
  module_id: string;
  name: string;
  definition?: string;
  explanation?: string;
  importance_score: number;
  created_at: string;
}

export type CardType = 'BASIC' | 'CLOZE';
export type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
export type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export interface Flashcard {
  id: string;
  module_id: string;
  concept_id?: string;
  front: string;
  back: string;
  card_type: CardType;
  cloze_text?: string;
  source_document_id?: string;
  source_excerpt?: string;
  tags: string[];
  due?: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review?: string;
  created_at: string;
}

export interface FlashcardCreate {
  module_id: string;
  front: string;
  back: string;
  card_type?: CardType;
  cloze_text?: string;
  concept_id?: string;
  source_document_id?: string;
  source_excerpt?: string;
  tags?: string[];
}

export interface FlashcardUpdate {
  front?: string;
  back?: string;
  card_type?: CardType;
  cloze_text?: string;
  tags?: string[];
}

export interface ReviewResponse {
  id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review?: string;
}

export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'TRUE_FALSE' | 'FILL_BLANK' | 'EXAM_STYLE';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXAM';

export interface QuizQuestion {
  id: string;
  module_id: string;
  concept_id?: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: Difficulty;
  source_document_id?: string;
  times_answered: number;
  times_correct: number;
  created_at: string;
}

export interface QuestionForQuiz {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  difficulty: Difficulty;
}

export interface GenerateQuizConfig {
  module_id: string;
  question_types?: QuestionType[];
  difficulty?: Difficulty;
  num_questions?: number;
  mode?: 'random' | 'weakness_drill' | 'unseen';
}

export interface StartSessionConfig {
  module_id?: string;
  session_type?: string;
  question_ids?: string[];
}

export interface SessionResponse {
  id: string;
  module_id?: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  total_items: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score_pct: number;
  questions: QuestionForQuiz[];
}

export interface AnswerRequest {
  question_id: string;
  user_answer: string;
}

export interface AnswerResponse {
  is_correct: boolean;
  explanation?: string;
  correct_answer: string;
  ai_feedback?: {
    score: number;
    feedback: string;
  };
}

export interface ReviewLog {
  id: string;
  item_id: string;
  item_type: 'FLASHCARD' | 'QUESTION';
  rating: string;
  was_correct: boolean;
  user_answer?: string;
  answered_at?: string;
}

export interface SessionResults {
  id: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  total_items: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score_pct: number;
  review_logs: ReviewLog[];
}

export interface StudySession {
  id: string;
  module_id?: string;
  module_name?: string;
  session_type: string;
  started_at: string;
  ended_at?: string;
  total_items: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score_pct: number;
}

export interface AnalyticsOverview {
  total_modules: number;
  total_cards: number;
  due_today: number;
  streak: number;
  overall_mastery: number;
}

export interface Settings {
  groq_api_key: string;
  llm_model: string;
  llm_fallback_model: string;
  daily_new_cards_limit: number;
  cards_per_document: number;
  questions_per_document: number;
  weakness_threshold: number;
  desired_retention: number;
  theme: string;
}

export interface SettingsUpdate {
  groq_api_key?: string;
  llm_model?: string;
  llm_fallback_model?: string;
  daily_new_cards_limit?: number;
  cards_per_document?: number;
  questions_per_document?: number;
  weakness_threshold?: number;
  desired_retention?: number;
  theme?: string;
}
