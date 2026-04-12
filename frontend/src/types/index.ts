export interface Module {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
  exam_date?: string;
  total_cards: number;
  due_cards: number;
  mastery_pct: number;
  total_documents: number;
  auto_cards: number;
  manual_cards: number;
  pipeline_status: string;
  pipeline_stage: string;
  pipeline_completed: number;
  pipeline_total: number;
  pipeline_error?: string;
  pipeline_updated_at?: string;
  has_study_plan: boolean;
}

export interface ModuleDetail extends Module {
  documents: Document[];
}

export interface ModuleCreate {
  name: string;
  description?: string;
  color?: string;
  exam_date?: string;
}

export interface ModuleUpdate {
  name?: string;
  description?: string;
  color?: string;
  exam_date?: string;
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
  auto_cards: number;
  manual_cards: number;
}

export interface Document {
  id: string;
  module_id: string;
  filename: string;
  file_type: string;
  file_path: string;
  processed: boolean;
  processing_status: 'pending' | 'processing' | 'done' | 'failed' | 'cancelling' | 'cancelled';
  processing_stage: string;
  processing_error?: string;
  processing_completed: number;
  processing_total: number;
  word_count: number;
  file_size_bytes: number;
  file_sha256?: string;
  summary?: string;
  summary_data?: Record<string, unknown> | unknown[];
  last_pipeline_updated_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Concept {
  id: string;
  module_id: string;
  name: string;
  definition?: string;
  explanation?: string;
  importance_score: number;
  study_weight: number;
  created_at: string;
}

export type CardType = 'BASIC' | 'CLOZE';
export type CardState = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
export type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
export type GenerationSource = 'AUTO' | 'MANUAL';

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
  generation_source: GenerationSource;
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
  updated_at: string;
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
  xp_earned?: number;
  xp_total?: number;
  level?: number;
  level_up?: boolean;
  new_achievements?: { key: string; name: string; icon: string }[];
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
  llm_model_fast: string;
  llm_model: string;
  llm_model_quality: string;
  llm_fallback_model: string;
  llm_temperature: number;
  llm_top_p: number;
  llm_max_completion_tokens: number;
  llm_json_mode_enabled: boolean;
  llm_streaming_enabled: boolean;
  daily_new_cards_limit: number;
  cards_per_document: number;
  questions_per_document: number;
  weakness_threshold: number;
  desired_retention: number;
  theme: string;
}

export interface SettingsUpdate {
  groq_api_key?: string;
  llm_model_fast?: string;
  llm_model?: string;
  llm_model_quality?: string;
  llm_fallback_model?: string;
  llm_temperature?: number;
  llm_top_p?: number;
  llm_max_completion_tokens?: number;
  llm_json_mode_enabled?: boolean;
  llm_streaming_enabled?: boolean;
  daily_new_cards_limit?: number;
  cards_per_document?: number;
  questions_per_document?: number;
  weakness_threshold?: number;
  desired_retention?: number;
  theme?: string;
}

export interface AIStreamEvent<T = unknown> {
  event: 'status' | 'delta' | 'partial' | 'final' | 'error';
  kind?: string;
  message?: string;
  stage?: string;
  delta?: string;
  data?: unknown;
  result?: T;
  completed?: number;
  total?: number;
  document?: Partial<Document>;
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
  generated_at?: string;
  weeks: CurriculumWeek[];
}

// ---- Auth ----
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  auth_provider?: string;
  created_at: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
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
  study_weight: number;
  parent_id?: string | null;
  order_index: number;
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

// ---- Feature: Forgetting Curve ----
export interface ForgettingCurvePoint {
  day: number;
  retention_pct: number;
}

export interface ForgettingCurveData {
  card_id: string;
  stability: number;
  data_points: ForgettingCurvePoint[];
}

// ---- Feature: Session Estimator ----
export interface SessionEstimate {
  due_cards: number;
  avg_seconds_per_card: number;
  estimated_minutes: number;
  new_cards: number;
  review_cards: number;
}

// ---- Feature: Concept Gap Detection ----
export interface ConceptGap {
  name: string;
  context_snippet: string;
  mentioned_in_documents: number;
  has_definition: boolean;
}

export interface ConceptGapResponse {
  gaps: ConceptGap[];
}

// ---- Feature: Elaboration Prompts ----
export interface ElaborationPrompt {
  question: string;
  hint: string;
}

export interface ElaborationResponse {
  card_id: string;
  follow_up_questions: ElaborationPrompt[];
}

// ---- Feature: Free Recall ----
export interface FreeRecallResult {
  score_pct: number;
  total_concepts: number;
  recalled_concepts: number;
  missed_concepts: { name: string; definition: string }[];
  feedback: string;
}

// ---- Feature: Timed Exam ----
export interface ExamSession {
  session_id: string;
  module_id: string;
  time_limit_minutes: number;
  questions: QuestionForQuiz[];
  total_questions: number;
  started_at: string;
}

export interface ExamAnswer {
  question_id: string;
  user_answer: string;
}

export interface ExamSubmitResult {
  session_id: string;
  score_pct: number;
  correct: number;
  incorrect: number;
  total: number;
  time_taken_seconds: number;
  review: {
    question_id: string;
    question_text: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation: string;
  }[];
}

// ---- Feature: Confidence Rating ----
export interface CalibrationPoint {
  confidence_level: number;
  predicted_pct: number;
  actual_pct: number;
  count: number;
}

export interface CalibrationData {
  calibration: CalibrationPoint[];
  overall_accuracy: number;
  overconfidence_score: number;
}

// ---- Feature: Writing Practice ----
export interface WritingPrompt {
  question: string;
  mark_scheme: string;
  time_limit_minutes: number;
  max_marks: number;
}

export interface ParagraphFeedback {
  paragraph_idx: number;
  feedback: string;
  marks: number;
}

export interface WritingGradeResult {
  score: number;
  max_marks: number;
  overall_feedback: string;
  paragraph_feedback: ParagraphFeedback[];
}

// ---- Feature: Retention Forecast ----
export interface ModuleRetentionForecast {
  module_id: string;
  module_name: string;
  total_cards: number;
  forecasts: { days: number; retention_pct: number }[];
}

export interface RetentionForecastData {
  modules: ModuleRetentionForecast[];
}

// ---- Feature: Exam Revision Timeline ----
export interface DailyPlan {
  date: string;
  cards_to_review: number;
  new_cards: number;
  estimated_minutes: number;
  focus_concepts: string[];
}

export interface ExamTimeline {
  exam_date: string;
  days_until: number;
  daily_plan: DailyPlan[];
}

// ---- Feature: Session Replay ----
export interface ReplayItem {
  item_id: string;
  item_type: string;
  question_text: string;
  correct_answer: string;
  user_answer: string;
  was_correct: boolean;
  rating: string;
  time_taken: number;
}

export interface SessionReplayData {
  session: StudySession;
  items: ReplayItem[];
}

// ---- Feature: Mastery Heatmap Calendar ----
export interface HeatmapDay {
  date: string;
  mastery_gain: number;
  sessions_count: number;
  items_reviewed: number;
}

export interface MasteryHeatmapData {
  days: HeatmapDay[];
}

// ---- Feature: Synthesis Cards ----
export interface SynthesisCardsRequest {
  module_ids: string[];
  num_cards: number;
}

// ---- Feature: Image Occlusion ----
export interface OcclusionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

// ---- Feature: Gamification ----
export interface UserStats {
  streak_current: number;
  streak_longest: number;
  last_study_date?: string;
  xp_total: number;
  level: number;
  xp_for_current_level: number;
  xp_for_next_level: number;
  hearts_remaining: number;
  hearts_enabled: boolean;
  daily_goal_target: number;
  daily_goal_completed: number;
  daily_goal_date?: string;
  total_cards_reviewed: number;
  total_quizzes_completed: number;
  total_perfect_quizzes: number;
  total_study_time_sec: number;
}

export interface AchievementDef {
  achievement_key: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
}

export interface AchievementResponse {
  achievement_key: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
}

export interface XPAwardResponse {
  xp_earned: number;
  xp_total: number;
  level: number;
  level_up: boolean;
  new_achievements: AchievementResponse[];
}

export interface HeartUseResponse {
  hearts_remaining: number;
  hearts_enabled: boolean;
  replenish_at?: string;
}

// ---- Feature: AI Tutor ----
export interface TutorExplainResponse {
  explanation: string;
  key_takeaways: string[];
  memory_hook: string;
}

export interface TopicGenerateResponse {
  generated: number;
  topic: string;
}
