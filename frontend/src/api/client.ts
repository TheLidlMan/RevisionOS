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
  ForgettingCurveData,
  SessionEstimate,
  ConceptGapResponse,
  ElaborationResponse,
  FreeRecallResult,
  ExamSession,
  ExamSubmitResult,
  CalibrationData,
  WritingPrompt,
  WritingGradeResult,
  RetentionForecastData,
  ExamTimeline,
  SessionReplayData,
  MasteryHeatmapData,
} from '../types';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

const runSearch = (
  query: string,
  moduleId?: string,
  type?: string,
  limit?: number,
): Promise<SearchResponse> =>
  client
    .get<SearchResponse>('/search', {
      params: { q: query, module_id: moduleId, type, limit },
    })
    .then((r) => r.data);

// Auth interceptor
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('revisionos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
export const search = (query: string, moduleId?: string, type?: string): Promise<SearchResponse> =>
  runSearch(query, moduleId, type);

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

export const searchAll = (query: string, moduleId?: string, limit?: number): Promise<SearchResponse> =>
  runSearch(query, moduleId, undefined, limit);

export const generateCurriculum = (moduleId: string, hoursPerWeek: number, examDate?: string) =>
  client.post<CurriculumData>(`/modules/${moduleId}/curriculum`, { hours_per_week: hoursPerWeek, exam_date: examDate }).then((r) => r.data);

export const exportAnki = (moduleId: string) =>
  client.get(`/modules/${moduleId}/export-anki`, { responseType: 'blob' }).then((r) => r.data);

export const getQuizStatus = (moduleId: string) =>
  client.get<{ module_id: string; status: string; question_count: number }>(`/modules/${moduleId}/quiz-status`).then((r) => r.data);

export const exportJson = (moduleId: string) =>
  client.get(`/modules/${moduleId}/export-json`, { responseType: 'blob' }).then((r) => r.data);

export const importJson = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/modules/import-json', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// ---- Auth ----
export const authRegister = (email: string, password: string, display_name: string) =>
  client.post('/auth/register', { email, password, display_name }).then((r) => r.data);

export const authLogin = (email: string, password: string) =>
  client.post('/auth/login', { email, password }).then((r) => r.data);

export const authMe = () =>
  client.get('/auth/me').then((r) => r.data);

export const updateProfile = (data: { display_name?: string; password?: string }) =>
  client.patch('/auth/me', data).then((r) => r.data);

// ---- Social / Leaderboard ----
export const getLeaderboard = (timeframe?: string) =>
  client.get('/social/leaderboard', { params: { timeframe } }).then((r) => r.data);

export const shareModule = (moduleId: string) =>
  client.post('/social/share-module', { module_id: moduleId }).then((r) => r.data);

export const getSharedModules = () =>
  client.get('/social/shared-modules').then((r) => r.data);

// ---- Integrations ----
export const importFromNotion = (notionToken: string, pageId: string, moduleId: string) =>
  client.post('/integrations/notion/import', { notion_token: notionToken, page_id: pageId, module_id: moduleId }).then((r) => r.data);

export const importFromGoogleDrive = (accessToken: string, fileId: string, moduleId: string) =>
  client.post('/integrations/google-drive/import', { access_token: accessToken, file_id: fileId, module_id: moduleId }).then((r) => r.data);

// ---- Collaboration ----
export const createRoom = (moduleId: string, name: string, roomType?: string) =>
  client.post('/collab/rooms', { module_id: moduleId, name, room_type: roomType || 'study' }).then((r) => r.data);

export const getRooms = () =>
  client.get('/collab/rooms').then((r) => r.data);

export const deleteRoom = (roomId: string) =>
  client.delete(`/collab/rooms/${roomId}`).then((r) => r.data);

// ---- Content Map ----
export const getContentMap = (moduleId: string) =>
  client.get(`/concepts/content-map/${moduleId}`).then((r) => r.data);

export const indexDocument = (documentId: string) =>
  client.post(`/documents/${documentId}/index`).then((r) => r.data);

export const generateQuestionsForConcept = (conceptId: string, numQuestions?: number) =>
  client.post(`/concepts/${conceptId}/generate-questions`, null, { params: { num_questions: numQuestions || 5 } }).then((r) => r.data);

// ---- Feature: Forgetting Curve ----
export const getForgettingCurve = (cardId: string) =>
  client.get<ForgettingCurveData>(`/flashcards/${cardId}/forgetting-curve`).then((r) => r.data);

// ---- Feature: Session Estimator ----
export const getSessionEstimate = (moduleId?: string) =>
  client.get<SessionEstimate>('/session-estimate', { params: { module_id: moduleId } }).then((r) => r.data);

// ---- Feature: Concept Gap Detection ----
export const detectConceptGaps = (moduleId: string) =>
  client.post<ConceptGapResponse>(`/modules/${moduleId}/detect-gaps`).then((r) => r.data);

// ---- Feature: Cross-Module Synthesis Cards ----
export const generateSynthesisCards = (moduleIds: string[], numCards: number = 5) =>
  client.post<{ generated: number; cards: Flashcard[] }>('/synthesis-cards', { module_ids: moduleIds, num_cards: numCards }).then((r) => r.data);

// ---- Feature: Elaboration Prompts ----
export const getElaborationPrompts = (cardId: string) =>
  client.post<ElaborationResponse>(`/flashcards/${cardId}/elaborate`).then((r) => r.data);

// ---- Feature: Free Recall ----
export const submitFreeRecall = (moduleId: string, topic: string, userText: string) =>
  client.post<FreeRecallResult>(`/modules/${moduleId}/free-recall`, { topic, user_text: userText }).then((r) => r.data);

// ---- Feature: YouTube Ingest ----
export const ingestYouTube = (moduleId: string, youtubeUrl: string) =>
  client.post<Document>('/documents/youtube', { module_id: moduleId, youtube_url: youtubeUrl }).then((r) => r.data);

// ---- Feature: Web Clipper ----
export const clipUrl = (moduleId: string, url: string) =>
  client.post<Document>('/documents/clip-url', { module_id: moduleId, url }).then((r) => r.data);

// ---- Feature: Timed Exam ----
export const startExam = (moduleId: string, timeLimitMinutes: number, numQuestions: number = 20) =>
  client.post<ExamSession>('/exam/start', { module_id: moduleId, time_limit_minutes: timeLimitMinutes, num_questions: numQuestions }).then((r) => r.data);

export const submitExam = (sessionId: string, answers: { question_id: string; user_answer: string }[]) =>
  client.post<ExamSubmitResult>(`/exam/${sessionId}/submit`, { answers }).then((r) => r.data);

// ---- Feature: Confidence Rating ----
export const submitConfidence = (cardId: string, confidence: number) =>
  client.post(`/flashcards/${cardId}/confidence`, { confidence }).then((r) => r.data);

export const getCalibration = () =>
  client.get<CalibrationData>('/analytics/calibration').then((r) => r.data);

// ---- Feature: Image Occlusion ----
export const createImageOcclusionCards = (moduleId: string, imageUrl: string, occlusions: { x: number; y: number; width: number; height: number; label: string }[]) =>
  client.post<{ created: number; cards: Flashcard[] }>('/flashcards/image-occlusion', { module_id: moduleId, image_url: imageUrl, occlusions }).then((r) => r.data);

// ---- Feature: Writing Practice ----
export const getWritingPrompt = (moduleId: string) =>
  client.post<WritingPrompt>(`/modules/${moduleId}/writing-prompt`).then((r) => r.data);

export const gradeWriting = (question: string, markScheme: string, userResponse: string) =>
  client.post<WritingGradeResult>('/writing/grade', { question, mark_scheme: markScheme, user_response: userResponse }).then((r) => r.data);

// ---- Feature: Retention Forecast ----
export const getRetentionForecast = () =>
  client.get<RetentionForecastData>('/analytics/retention-forecast').then((r) => r.data);

// ---- Feature: Exam Revision Timeline ----
export const getExamTimeline = (moduleId: string, examDate: string) =>
  client.post<ExamTimeline>(`/modules/${moduleId}/exam-timeline`, { exam_date: examDate }).then((r) => r.data);

// ---- Feature: Session Replay ----
export const getSessionReplay = (sessionId: string) =>
  client.get<SessionReplayData>(`/sessions/${sessionId}/replay`).then((r) => r.data);

// ---- Feature: Mastery Heatmap ----
export const getMasteryHeatmap = (days: number = 90) =>
  client.get<MasteryHeatmapData>('/analytics/mastery-heatmap', { params: { days } }).then((r) => r.data);
