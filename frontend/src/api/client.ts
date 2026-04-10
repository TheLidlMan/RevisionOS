import axios from 'axios';
import type {
  Module,
  ModuleDetail,
  ModuleCreate,
  ModuleUpdate,
  ModuleStats,
  Document,
  Flashcard,
  FlashcardCreate,
  FlashcardUpdate,
  ReviewResponse,
  Rating,
  QuizQuestion,
  GenerateQuizConfig,
  StartSessionConfig,
  SessionResponse,
  AnswerRequest,
  AnswerResponse,
  SessionResults,
  StudySession,
  AnalyticsOverview,
  Concept,
  Settings,
  SettingsUpdate,
  WeaknessMapData,
  OptimalSession,
  ConceptDetail,
  DrillSession,
  StreakData,
  PerformancePoint,
  KnowledgeGraphData,
  SearchResponse,
  CurriculumData,
} from '../types';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Modules
export const getModules = () =>
  client.get<Module[]>('/modules').then((r) => r.data);

export const createModule = (data: ModuleCreate) =>
  client.post<Module>('/modules', data).then((r) => r.data);

export const getModule = (id: string) =>
  client.get<ModuleDetail>(`/modules/${id}`).then((r) => r.data);

export const updateModule = (id: string, data: ModuleUpdate) =>
  client.patch<Module>(`/modules/${id}`, data).then((r) => r.data);

export const deleteModule = (id: string) =>
  client.delete(`/modules/${id}`).then((r) => r.data);

export const getModuleStats = (id: string) =>
  client.get<ModuleStats>(`/modules/${id}/stats`).then((r) => r.data);

// Documents
export const uploadDocument = (moduleId: string, file: File) => {
  const form = new FormData();
  form.append('module_id', moduleId);
  form.append('file', file);
  return client
    .post<Document>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const getDocument = (id: string) =>
  client.get<Document>(`/documents/${id}`).then((r) => r.data);

export const deleteDocument = (id: string) =>
  client.delete(`/documents/${id}`).then((r) => r.data);

// Flashcards
export const getFlashcards = (params?: {
  module_id?: string;
  due?: boolean;
}) => client.get<Flashcard[]>('/flashcards', { params }).then((r) => r.data);

export const createFlashcard = (data: FlashcardCreate) =>
  client.post<Flashcard>('/flashcards', data).then((r) => r.data);

export const updateFlashcard = (id: string, data: FlashcardUpdate) =>
  client.patch<Flashcard>(`/flashcards/${id}`, data).then((r) => r.data);

export const deleteFlashcard = (id: string) =>
  client.delete(`/flashcards/${id}`).then((r) => r.data);

export const reviewFlashcard = (id: string, rating: Rating) =>
  client
    .post<ReviewResponse>(`/flashcards/${id}/review`, { rating })
    .then((r) => r.data);

export const generateCards = (
  moduleId: string,
  numCards?: number
) =>
  client
    .post<{ generated: number; cards: Flashcard[] }>(
      `/modules/${moduleId}/generate-cards`,
      numCards ? { num_cards: numCards } : {}
    )
    .then((r) => r.data);

// Quizzes
export const getQuestions = (params?: {
  module_id?: string;
  difficulty?: string;
  type?: string;
}) => client.get<QuizQuestion[]>('/questions', { params }).then((r) => r.data);

export const generateQuiz = (config: GenerateQuizConfig) =>
  client
    .post<{ generated: number; questions: QuizQuestion[] }>(
      '/quizzes/generate',
      config
    )
    .then((r) => r.data);

export const startQuizSession = (config: StartSessionConfig) =>
  client.post<SessionResponse>('/quizzes/sessions', config).then((r) => r.data);

export const submitAnswer = (sessionId: string, data: AnswerRequest) =>
  client
    .post<AnswerResponse>(`/quizzes/sessions/${sessionId}/answer`, data)
    .then((r) => r.data);

export const completeSession = (sessionId: string) =>
  client
    .post<SessionResults>(`/quizzes/sessions/${sessionId}/complete`)
    .then((r) => r.data);

export const getSessionResults = (sessionId: string) =>
  client
    .get<SessionResults>(`/quizzes/sessions/${sessionId}/results`)
    .then((r) => r.data);

// Sessions & Analytics
export const getSessions = (params?: {
  module_id?: string;
  limit?: number;
}) =>
  client.get<StudySession[]>('/sessions', { params }).then((r) => r.data);

export const getAnalyticsOverview = () =>
  client.get<AnalyticsOverview>('/analytics/overview').then((r) => r.data);

// Concepts
export const getConcepts = (moduleId: string) =>
  client
    .get<Concept[]>('/concepts', { params: { module_id: moduleId } })
    .then((r) => r.data);

// Settings
export const getSettings = () =>
  client.get<Settings>('/settings').then((r) => r.data);

export const updateSettings = (data: SettingsUpdate) =>
  client.patch<Settings>('/settings', data).then((r) => r.data);

export const validateApiKey = (key: string) =>
  client
    .post<{ valid: boolean; message: string }>('/settings/validate-api-key', {
      api_key: key,
    })
    .then((r) => r.data);

// Search
export const search = (query: string, moduleId?: string) =>
  client
    .get('/search', { params: { q: query, module_id: moduleId } })
    .then((r) => r.data);

// ---- Phase 2: Weakness Map & Analytics ----

export const getWeaknessMap = (moduleId?: string) =>
  client.get<WeaknessMapData>('/weakness-map', { params: { module_id: moduleId } }).then((r) => r.data);

export const getOptimalSession = (moduleId?: string, maxItems?: number) =>
  client.get<OptimalSession>('/weakness-map/optimal-session', { params: { module_id: moduleId, max_items: maxItems } }).then((r) => r.data);

export const getConceptDetail = (id: string) =>
  client.get<ConceptDetail>(`/concepts/${id}`).then((r) => r.data);

export const drillConcept = (id: string) =>
  client.post<DrillSession>(`/concepts/${id}/drill`).then((r) => r.data);

export const getStreaks = () =>
  client.get<StreakData>('/analytics/streaks').then((r) => r.data);

export const getPerformanceOverTime = (moduleId?: string, days?: number) =>
  client.get<PerformancePoint[]>('/analytics/performance-over-time', { params: { module_id: moduleId, days } }).then((r) => r.data);

// ---- Phase 3: Folder Import ----

export const importFolder = (moduleId: string, folderPath: string) =>
  client.post(`/documents/import-folder/${moduleId}`, { folder_path: folderPath }).then((r) => r.data);

// ---- Phase 4: Knowledge & Export ----

export const getKnowledgeGraph = (moduleId: string) =>
  client.get<KnowledgeGraphData>(`/modules/${moduleId}/knowledge-graph`).then((r) => r.data);

export const searchAll = (query: string, moduleId?: string, limit?: number) =>
  client.get<SearchResponse>('/search', { params: { q: query, module_id: moduleId, limit } }).then((r) => r.data);

export const generateCurriculum = (moduleId: string, hoursPerWeek: number, examDate?: string) =>
  client.post<CurriculumData>(`/modules/${moduleId}/curriculum`, { hours_per_week: hoursPerWeek, exam_date: examDate }).then((r) => r.data);

export const exportAnki = (moduleId: string) =>
  client.get(`/modules/${moduleId}/export-anki`, { responseType: 'blob' }).then((r) => r.data);

export const exportJson = (moduleId: string) =>
  client.get(`/modules/${moduleId}/export-json`, { responseType: 'blob' }).then((r) => r.data);

export const importJson = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/modules/import-json', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
