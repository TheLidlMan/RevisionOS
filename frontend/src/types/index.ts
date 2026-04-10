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

// ---- Phase 2: Weakness Map & Analytics ----

export interface ConceptConfidence {
  id: string;
  module_id: string;
  name: string;
  definition?: string;
  importance_score: number;
  accuracy_rate: number;
  review_count: number;
  last_reviewed?: string;
  trend: 'improving' | 'declining' | 'stable';
  confidence_score: number;
  flashcard_count: number;
  question_count: number;
}

export interface WeaknessMapData {
  concepts: ConceptConfidence[];
  total_concepts: number;
  weak_count: number;
  mastered_count: number;
}

export interface OptimalSession {
  weak_concepts: ConceptConfidence[];
  recommended_question_ids: string[];
  recommended_flashcard_ids: string[];
  total_items: number;
}

export interface ConceptDetail {
  id: string;
  module_id: string;
  name: string;
  definition?: string;
  explanation?: string;
  importance_score: number;
  created_at: string;
  flashcards: { id: string; front: string; back: string; card_type: string; state: string; reps: number }[];
  questions: { id: string; question_text: string; question_type: string; difficulty: string; times_answered: number; times_correct: number }[];
  accuracy_rate: number;
  review_count: number;
  last_reviewed?: string;
}

export interface DrillSession {
  session_id: string;
  concept_name: string;
  question_ids: string[];
  flashcard_ids: string[];
  total_items: number;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  daily_activity: { date: string; sessions: number; active: boolean }[];
}

export interface PerformancePoint {
  date: string;
  avg_score: number | null;
  session_count: number;
  total_items_reviewed: number;
}

// ---- Phase 4: Knowledge Graph, Search, Curriculum, Export ----

export interface GraphNode {
  id: string;
  name: string;
  importance: number;
  mastery: number;
  group: string;
  parent_id?: string | null;
  order_index?: number;
  item_count?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  module_name: string;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet: string;
  module_id?: string;
  module_name?: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export interface CurriculumSession {
  day: string;
  activity: string;
  duration_minutes: number;
  concepts: string[];
}

export interface CurriculumWeek {
  week: number;
  focus_areas: string[];
  sessions: CurriculumSession[];
}

export interface CurriculumData {
  module_name: string;
  total_concepts: number;
  total_weeks: number;
  hours_per_week: number;
  exam_date?: string;
  weeks: CurriculumWeek[];
}

// ---- Auth ----
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

// ---- Social / Leaderboard ----
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  streak: number;
  mastery_pct: number;
  total_reviews: number;
  total_sessions: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  your_rank: number | null;
}

// ---- Collaboration ----
export interface StudyRoom {
  id: string;
  name: string;
  module_id: string;
  room_type: string;
  host_id: string;
  host_name: string;
  participants: { user_id: string; display_name: string }[];
  created_at: string;
}

// ---- Content Map ----
export interface ContentMapTopic {
  id: string;
  name: string;
  definition: string;
  importance_score: number;
  flashcard_count: number;
  question_count: number;
  has_content: boolean;
}

export interface ContentMapData {
  module_id: string;
  topics: ContentMapTopic[];
  total_topics: number;
  covered_topics: number;
  uncovered_topics: number;
}
