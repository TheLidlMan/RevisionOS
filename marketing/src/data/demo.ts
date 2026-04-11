/*
 * Hard-coded demo data for marketing landing page demos.
 * Deterministic, no backend dependency.
 */

export interface DemoModule {
  id: string
  name: string
  color: string
  documentCount: number
  flashcardCount: number
  quizCount: number
  masteryPct: number
  lastStudied: string
}

export interface DemoFlashcard {
  id: string
  front: string
  back: string
  due: string
  stability: number
  difficulty: number
  reps: number
  state: 'new' | 'learning' | 'review' | 'relearning'
}

export interface DemoQuizResult {
  question: string
  options: string[]
  correctIndex: number
  userIndex: number
  explanation: string
}

export interface DemoGraphNode {
  id: string
  label: string
  group: string
  importance: number
}

export interface DemoGraphEdge {
  source: string
  target: string
  weight: number
}

export interface DemoForgettingPoint {
  day: number
  retention: number
  label: string
}

export interface DemoStudyPlanItem {
  day: string
  modules: string[]
  duration: number
  type: 'review' | 'new' | 'mixed'
}

// ──────── Modules ────────

export const demoModules: DemoModule[] = [
  {
    id: 'm1', name: 'Cell Biology', color: '#c4956a',
    documentCount: 8, flashcardCount: 142, quizCount: 35,
    masteryPct: 78, lastStudied: '2 hours ago',
  },
  {
    id: 'm2', name: 'Organic Chemistry', color: '#7ba5c4',
    documentCount: 12, flashcardCount: 218, quizCount: 52,
    masteryPct: 62, lastStudied: 'Yesterday',
  },
  {
    id: 'm3', name: 'British History 1485–1603', color: '#a5c47b',
    documentCount: 6, flashcardCount: 94, quizCount: 28,
    masteryPct: 85, lastStudied: '3 days ago',
  },
  {
    id: 'm4', name: 'Statistics & Probability', color: '#c47bb3',
    documentCount: 5, flashcardCount: 76, quizCount: 20,
    masteryPct: 45, lastStudied: '1 week ago',
  },
]

// ──────── Flashcards ────────

export const demoFlashcards: DemoFlashcard[] = [
  {
    id: 'f1', front: 'What is the function of mitochondria?',
    back: 'Mitochondria are the powerhouse of the cell — they generate ATP through oxidative phosphorylation.',
    due: 'Now', stability: 4.2, difficulty: 0.3, reps: 5, state: 'review',
  },
  {
    id: 'f2', front: 'Define activation energy (Ea)',
    back: 'The minimum energy required for reactants to form products in a chemical reaction.',
    due: 'Tomorrow', stability: 2.1, difficulty: 0.5, reps: 3, state: 'learning',
  },
  {
    id: 'f3', front: 'What was the Act of Supremacy (1534)?',
    back: 'Declared Henry VIII the Supreme Head of the Church of England, breaking from papal authority.',
    due: 'In 3 days', stability: 8.7, difficulty: 0.2, reps: 8, state: 'review',
  },
  {
    id: 'f4', front: 'State Bayes\' Theorem',
    back: 'P(A|B) = P(B|A) · P(A) / P(B)',
    due: 'Now', stability: 1.0, difficulty: 0.7, reps: 1, state: 'new',
  },
]

// ──────── Quiz Results ────────

export const demoQuizResults: DemoQuizResult[] = [
  {
    question: 'Which organelle is responsible for protein synthesis?',
    options: ['Mitochondria', 'Ribosome', 'Golgi apparatus', 'Lysosome'],
    correctIndex: 1, userIndex: 1,
    explanation: 'Ribosomes translate mRNA into polypeptide chains.',
  },
  {
    question: 'What type of bond joins amino acids?',
    options: ['Ionic bond', 'Hydrogen bond', 'Peptide bond', 'Glycosidic bond'],
    correctIndex: 2, userIndex: 2,
    explanation: 'Peptide bonds form through condensation reactions between amino acids.',
  },
  {
    question: 'Who was Elizabeth I\'s mother?',
    options: ['Catherine of Aragon', 'Jane Seymour', 'Anne Boleyn', 'Anne of Cleves'],
    correctIndex: 2, userIndex: 0,
    explanation: 'Anne Boleyn was the second wife of Henry VIII and mother of Elizabeth I.',
  },
]

// ──────── Knowledge Graph ────────

export const demoGraphNodes: DemoGraphNode[] = [
  { id: 'n1', label: 'Cell Biology', group: 'core', importance: 1.0 },
  { id: 'n2', label: 'Mitochondria', group: 'organelle', importance: 0.9 },
  { id: 'n3', label: 'ATP Synthesis', group: 'process', importance: 0.85 },
  { id: 'n4', label: 'Krebs Cycle', group: 'process', importance: 0.8 },
  { id: 'n5', label: 'Electron Transport', group: 'process', importance: 0.75 },
  { id: 'n6', label: 'DNA Replication', group: 'process', importance: 0.7 },
  { id: 'n7', label: 'Protein Synthesis', group: 'process', importance: 0.65 },
  { id: 'n8', label: 'Ribosomes', group: 'organelle', importance: 0.6 },
  { id: 'n9', label: 'Enzymes', group: 'concept', importance: 0.55 },
  { id: 'n10', label: 'Active Transport', group: 'concept', importance: 0.5 },
]

export const demoGraphEdges: DemoGraphEdge[] = [
  { source: 'n1', target: 'n2', weight: 0.9 },
  { source: 'n2', target: 'n3', weight: 0.95 },
  { source: 'n3', target: 'n4', weight: 0.85 },
  { source: 'n3', target: 'n5', weight: 0.8 },
  { source: 'n1', target: 'n6', weight: 0.7 },
  { source: 'n1', target: 'n7', weight: 0.65 },
  { source: 'n7', target: 'n8', weight: 0.8 },
  { source: 'n4', target: 'n9', weight: 0.6 },
  { source: 'n1', target: 'n10', weight: 0.5 },
]

// ──────── Forgetting Curve ────────

export const demoForgettingCurve: DemoForgettingPoint[] = [
  { day: 0, retention: 100, label: 'Just learned' },
  { day: 1, retention: 58, label: 'Day 1' },
  { day: 2, retention: 44, label: 'Day 2' },
  { day: 3, retention: 36, label: 'Day 3' },
  { day: 7, retention: 25, label: '1 week' },
  { day: 14, retention: 21, label: '2 weeks' },
  { day: 30, retention: 18, label: '1 month' },
]

export const demoForgettingWithReview: DemoForgettingPoint[] = [
  { day: 0, retention: 100, label: 'Just learned' },
  { day: 1, retention: 80, label: 'Review 1' },
  { day: 3, retention: 72, label: 'Day 3' },
  { day: 3, retention: 92, label: 'Review 2' },
  { day: 7, retention: 82, label: '1 week' },
  { day: 7, retention: 95, label: 'Review 3' },
  { day: 14, retention: 88, label: '2 weeks' },
  { day: 30, retention: 82, label: '1 month' },
]

// ──────── Study Plan ────────

export const demoStudyPlan: DemoStudyPlanItem[] = [
  { day: 'Monday', modules: ['Cell Biology', 'Statistics'], duration: 90, type: 'mixed' },
  { day: 'Tuesday', modules: ['Organic Chemistry'], duration: 60, type: 'new' },
  { day: 'Wednesday', modules: ['British History', 'Cell Biology'], duration: 75, type: 'review' },
  { day: 'Thursday', modules: ['Statistics', 'Organic Chemistry'], duration: 90, type: 'mixed' },
  { day: 'Friday', modules: ['Cell Biology'], duration: 45, type: 'review' },
  { day: 'Saturday', modules: ['British History', 'Organic Chemistry'], duration: 60, type: 'new' },
  { day: 'Sunday', modules: ['All modules'], duration: 30, type: 'review' },
]
