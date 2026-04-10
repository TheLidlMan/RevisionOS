# Product Requirements Document
# RevisionOS — AI-Powered Adaptive Study Platform
**Version:** 1.1  
**Author:** Sam (via Perplexity)  
**Date:** April 2026  
**Target Builder:** Claude Code  

---

## 1. Executive Summary

RevisionOS is a locally-runnable, full-stack web application that transforms folders of lecture transcripts, PDFs, and slides into an intelligent, adaptive revision engine. It ingests study materials organised by module, generates flashcards and quizzes using AI, tracks per-question mastery with the FSRS spaced repetition algorithm, and only surfaces material the user has not yet mastered. All AI features run through the Groq API (Llama 4 Scout by default — 10M token context window), enabling entire modules to be processed in a single prompt without chunking loss.

---

## 2. Problem Statement

Students accumulate large volumes of lecture materials (transcripts, PDFs, slides) but lack an intelligent tool that:
- Ingests their exact materials — not generic content
- Tracks per-concept mastery across multiple sessions
- Wastes zero revision time on already-known material
- Provides exam-style questions, not just basic flashcards
- Learns which topics the student is weak on and drills them harder

---

## 3. Target User

- **Sam**: Finance/equity analyst at Goldman Sachs, Royal Holloway University alumni, sitting exams with large volumes of lecture transcripts and PDFs already downloaded and organised into module folders
- Advanced tech user, comfortable with API keys and running local Node/Python apps
- Wants to optimise revision efficiency, not spend time on tooling

---

## 4. Technical Architecture

### 4.1 Stack
| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast HMR, component reuse, strong typing |
| Styling | Tailwind CSS v4 | Utility-first, rapid iteration |
| Backend | FastAPI (Python 3.11+) | Async, easy file handling, great AI library support |
| Database | SQLite via SQLAlchemy + Alembic | Zero-config, file-based, portable |
| Vector Search | FAISS + sentence-transformers (all-MiniLM-L6-v2) | Semantic search across knowledge base |
| AI / LLM | Groq API — `meta-llama/llama-4-scout-17b-16e-instruct` + Groq vision models | Long-context extraction, grading, OCR, and follow-up tutoring |
| Transcription | Groq Whisper API (`whisper-large-v3`) | Audio/video lecture transcription |
| FSRS | `py-fsrs` Python package (v4+) | Gold-standard spaced repetition scheduling |
| PDF Processing | PyMuPDF (`fitz`) + pdfplumber | Text + table extraction, image extraction |
| PPTX Processing | `python-pptx` | Slide text and speaker notes extraction |
| DOCX Processing | `python-docx` | Word document extraction |
| Web / media ingestion | `trafilatura` + `yt-dlp` + `ffmpeg` | Readable web extraction and YouTube lecture ingestion |
| Formula rendering | KaTeX | Markdown/LaTeX flashcard rendering for maths/finance content |
| Anki Export | `genanki` Python package | Native .apkg export |
| File uploads | FastAPI + python-multipart | Multipart form handling |
| Auth | None (local app, no multi-user needed) | Simplicity — single user |

### 4.2 Folder Structure
```
revision-os/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings (GROQ_API_KEY, etc.)
│   ├── database.py              # SQLAlchemy setup
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── module.py
│   │   ├── document.py
│   │   ├── concept.py
│   │   ├── flashcard.py
│   │   ├── quiz_question.py
│   │   ├── quiz_session.py
│   │   └── review_log.py
│   ├── routers/
│   │   ├── modules.py
│   │   ├── documents.py
│   │   ├── flashcards.py
│   │   ├── quizzes.py
│   │   ├── study_sessions.py
│   │   ├── concepts.py
│   │   └── exports.py
│   ├── services/
│   │   ├── file_processor.py    # PDF/PPTX/DOCX/audio ingestion
│   │   ├── ai_service.py        # All Groq API calls
│   │   ├── fsrs_service.py      # Spaced repetition scheduling
│   │   ├── vector_service.py    # FAISS embedding + search
│   │   └── export_service.py    # Anki .apkg generation
│   ├── requirements.txt
│   └── alembic/                 # DB migrations
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ModuleView.tsx
│   │   │   ├── FlashcardReview.tsx
│   │   │   ├── QuizMode.tsx
│   │   │   ├── WeaknessMap.tsx
│   │   │   ├── KnowledgeGraph.tsx
│   │   │   ├── UploadCenter.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/               # Zustand state management
│   │   └── api/                 # Typed API client (auto-gen from OpenAPI)
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml           # One-command startup
└── README.md
```

### 4.3 Environment Variables
```env
GROQ_API_KEY=gsk_...
DATABASE_URL=sqlite:///./revisionos.db
EMBEDDINGS_MODEL=all-MiniLM-L6-v2
LLM_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
LLM_FALLBACK_MODEL=llama-3.1-8b-instant
MAX_CONTEXT_TOKENS=800000
UPLOAD_DIR=./uploads
```

---

## 5. Data Models

### 5.1 Module
```python
class Module:
    id: UUID
    name: str                    # e.g. "Corporate Finance", "Derivatives"
    description: str | None
    color: str                   # Hex for UI colour coding
    created_at: datetime
    updated_at: datetime
    # Computed fields (not stored):
    # total_cards, due_cards, mastery_pct, total_documents
```

### 5.2 Document
```python
class Document:
    id: UUID
    module_id: UUID              # FK → Module
    filename: str
    file_type: Enum              # PDF, PPTX, DOCX, MP3, MP4, TXT, MD, IMAGE
    file_path: str               # Path in UPLOAD_DIR
    raw_text: str                # Extracted full text
    processed: bool              # Has AI processed this doc?
    processing_status: str       # pending | processing | done | failed
    word_count: int
    created_at: datetime
    transcript: str | None       # For audio/video — Whisper output
    slide_count: int | None      # For PPTX
```

### 5.3 Concept
```python
class Concept:
    id: UUID
    module_id: UUID
    name: str                    # e.g. "CAPM", "Black-Scholes"
    definition: str
    explanation: str             # Longer AI-generated explanation
    source_document_ids: list[UUID]  # Which docs mention this
    related_concept_ids: list[UUID]  # Knowledge graph edges
    importance_score: float      # 0.0–1.0, AI-assigned
    embedding: bytes             # FAISS vector (stored as blob)
    created_at: datetime
```

### 5.4 Flashcard
```python
class Flashcard:
    id: UUID
    module_id: UUID
    concept_id: UUID | None      # Optional link to concept
    front: str                   # Question / term
    back: str                    # Answer / definition
    card_type: Enum              # BASIC | CLOZE | IMAGE_OCCLUSION
    cloze_text: str | None       # For cloze deletions: "The {{c1::mitochondria}} is..."
    source_document_id: UUID | None
    source_excerpt: str | None   # Original text the card was generated from
    tags: list[str]
    rendering_format: Enum        # PLAIN | MARKDOWN
    occlusion_image_path: str | None
    occlusion_regions: list[dict] | None
    # FSRS fields (py-fsrs Rating/Card fields):
    due: datetime
    stability: float
    desired_retention: float
    difficulty: float
    elapsed_days: int
    scheduled_days: int
    reps: int
    lapses: int
    state: Enum                  # NEW | LEARNING | REVIEW | RELEARNING
    last_review: datetime | None
    created_at: datetime
```

### 5.5 QuizQuestion
```python
class QuizQuestion:
    id: UUID
    module_id: UUID
    concept_id: UUID | None
    question_text: str
    question_type: Enum          # MCQ | SHORT_ANSWER | TRUE_FALSE | FILL_BLANK | EXAM_STYLE
    options: list[str] | None    # For MCQ: ["A...", "B...", "C...", "D..."]
    correct_answer: str
    explanation: str             # Why this is the answer
    difficulty: Enum             # EASY | MEDIUM | HARD | EXAM
    source_document_id: UUID | None
    times_answered: int
    times_correct: int
    accuracy_rate: float         # Computed: times_correct / times_answered
    last_answered: datetime | None
    created_at: datetime
```

### 5.6 StudySession
```python
class StudySession:
    id: UUID
    module_id: UUID | None       # None = cross-module session
    session_type: Enum           # FLASHCARDS | QUIZ | MIXED | WEAKNESS_DRILL | TIMED_EXAM | FREE_RECALL | WRITING_PRACTICE
    started_at: datetime
    ended_at: datetime | None
    total_items: int
    correct: int
    incorrect: int
    skipped: int
    score_pct: float
    estimated_duration_seconds: int | None
    time_limit_seconds: int | None
    replay_summary: str | None
    mastery_gain: float
```

### 5.7 ReviewLog
```python
class ReviewLog:
    id: UUID
    session_id: UUID
    item_id: UUID                # Flashcard or QuizQuestion ID
    item_type: Enum              # FLASHCARD | QUESTION
    rating: Enum                 # AGAIN | HARD | GOOD | EASY (FSRS) or 0–100
    confidence_before: int | None  # 1–5 self-rating before answer reveal
    time_taken_seconds: float
    answered_at: datetime
    was_correct: bool
    user_answer: str | None      # For open questions
    follow_up_prompts: list[str] | None
```

---

## 6. Core Features

### 6.1 Module Management
- Create modules with name, description, and colour tag
- Each module corresponds to a course/subject folder
- **Bulk folder import**: User can point the app at a local folder path and it auto-creates a module and ingests all supported files within it — one click to import an entire semester
- Module dashboard shows: document count, flashcard count, due cards, mastery %, last studied
- Archive/delete modules
- Module-level progress bar showing FSRS mastery across all cards

### 6.2 File Upload & Processing

#### Supported Input Formats
| Format | Processing Method |
|---|---|
| PDF | PyMuPDF — text, tables (converted to markdown), images flagged |
| PPTX / KEY | python-pptx — slide text + speaker notes, slide count |
| DOCX | python-docx — paragraphs, headings, tables |
| TXT / MD | Direct read |
| MP3 / WAV / M4A / OGG | Groq Whisper API → transcript stored as Document |
| MP4 / MOV / YouTube URL | Audio extracted (ffmpeg) → Whisper → transcript |
| PNG / JPG | Groq vision model → OCR text extraction |
| Folder path | Recursive ingest of all supported files |

#### Processing Pipeline (per document)
1. **File ingestion** — extract raw text, detect language
2. **Chunking** — split into ~2000-token semantic chunks preserving headings
3. **Embedding** — embed each chunk with sentence-transformers, store in FAISS index
4. **AI analysis** — send full document text to Llama 4 Scout with extraction prompt:
   - Key concepts + definitions
   - Important facts and figures
   - Procedures / step-by-step processes
   - Exam-likely questions (implicit and explicit)
   - Relationships between concepts
5. **Concept creation** — upsert concepts into DB, link to existing module concepts
6. **Flashcard generation** — generate 10–30 FSRS flashcards per document (configurable)
7. **Question generation** — generate 5–15 quiz questions per document (mix of MCQ, short answer, exam-style)
8. **Concept gap detection** — identify concepts referenced but not fully defined, mark as unresolved
9. **Cross-module synthesis** — generate bridge cards linking overlapping concepts across modules when enough material exists
10. **Status update** — mark document as processed

#### Processing UX
- Upload queue with real-time progress per file
- Processing status: pending → transcribing → extracting → generating → done
- Error states with retry
- Background processing (don't block UI)
- Estimated time remaining
- URL ingestion form for YouTube lectures and clipped web pages
- Handwritten note OCR preview with preserved paragraph/heading layout before save

### 6.3 Flashcard System (FSRS)

#### Review Interface
- Clean card flip animation (front → back)
- Pre-answer confidence rating (1–5) optional before reveal to measure calibration
- After revealing answer, user rates: **Again / Hard / Good / Easy**
- FSRS algorithm (py-fsrs v4) calculates next due date per card
- Card shows: stability score, next review date, review count
- Optional forgetting-curve visualiser shows predicted retention % over time for the current card
- Session ends when no more due cards (or user exits)
- Keyboard shortcuts: Space = flip, 1/2/3/4 = Again/Hard/Good/Easy
- "Go Deeper" button after grading generates 2–3 elaboration prompts for applied recall

#### Smart Scheduling
- Only shows cards due today or overdue
- "Due" count visible on module cards in dashboard
- New cards introduced at configurable rate (default 20/day)
- Leech detection: card answered "Again" 4+ times → flagged, shown in Weakness Map
- Session start screen shows smart session estimator: due count, estimated duration, and average seconds/card

#### Card Types
- **Basic** — Q on front, A on back
- **Cloze** — fill-in-the-blank with highlighted gap
- **Reversed** — auto-generate reverse card (term → def AND def → term)
- **Image Occlusion** — user-uploaded diagrams with hidden regions that must be recalled
- **Cross-Module Synthesis** — cards explicitly linking concepts across different modules

#### Card Management
- Edit front/back text inline
- Delete individual cards
- Tag cards manually
- Suspend cards (skip from review without deleting)
- View source excerpt (what text generated this card)
- Manually create cards
- Render Markdown and LaTeX on both card front and back

### 6.4 Quiz Mode

#### Question Types
- **Multiple Choice** (4 options, 1 correct) — for factual recall
- **Short Answer** (free text) — AI grades the response 0–100 using semantic similarity
- **True / False** — quick knowledge checks
- **Fill in the Blank** — key term removed from sentence
- **Exam-Style** (long form) — marks scheme provided, AI gives feedback and a score out of marks

#### Quiz Configuration (pre-quiz screen)
- Select module(s) — single or multi-module
- Question types to include (checkboxes)
- Difficulty level: Easy / Mixed / Hard / Exam
- Number of questions: 5 / 10 / 20 / Custom
- **Mode selection**:
  - *Random* — sample from full question pool
  - *Weakness Drill* — only questions with accuracy < threshold (configurable, default 70%)
  - *Unseen* — only questions never attempted before
  - *Timed Exam* — full timed mock with countdown timer
- Topic filter: select specific concepts to drill
- Writing practice toggle: generate essay prompts with timed long-form response editor

#### Quiz Session Flow
1. Question displayed (timer shown if timed mode)
2. User submits answer
3. Immediate feedback: correct ✓ / incorrect ✗ + explanation displayed
4. For AI-graded short answers: show score + AI feedback + ideal answer
5. "Next" → proceed
6. End screen: score, time taken, breakdown by concept, weakest topics
7. Timed Exam mode auto-submits unanswered questions when countdown reaches zero, then shows full mark-scheme review

#### AI Grading (short/exam answers)
- Send question + correct answer + user answer to Groq
- Return: score (0–100), feedback (2–3 sentences), what was correct, what was missing
- Semantic matching so near-correct answers score well
- Essay / writing practice grading includes paragraph-level feedback against a generated mark scheme

### 6.5 Weakness Map (Core Differentiator)

This is the key feature — the adaptive brain of the app.

#### Data Tracked Per Concept
- **Accuracy rate** across all quiz questions and flashcard reviews touching this concept
- **Trend** — improving / declining / stable (based on last 10 reviews)
- **Review count** — how many times tested
- **Last reviewed** — recency
- **Confidence score** — composite: accuracy × recency × stability

#### Weakness Map UI
- Heatmap grid view: all concepts, colour-coded by confidence score (red = weak, green = mastered)
- Filter by module
- Click any concept → see all related flashcards, questions, source documents
- **"Drill This" button** on any concept → instant quiz session on only that concept
- Mastered concepts (confidence > 85%) auto-hidden from default view (toggle to show)
- **Radar chart** per module: axes = topic areas, shows coverage and mastery at a glance
- Calibration overlay highlights concepts where confidence ratings exceed actual performance

#### Smart Session Generation
- "Start Optimal Session" button on dashboard:
  1. Identifies bottom 20% of concepts by confidence score
  2. Generates a 20-question quiz mixing flashcards and quiz questions on those concepts only
  3. After session, recalculates weakness map and shows what improved
- "Free Recall" mode opens a blank canvas for a topic, scores the response against source material, and highlights missing concepts

### 6.6 Curriculum Generator

#### How It Works
1. User selects a module (or all modules)
2. AI analyses all extracted concepts, infers prerequisites (e.g. "bond pricing" requires "time value of money")
3. Generates a **learning order** — ordered list of topics from foundational → advanced
4. Creates a **weekly study plan** based on:
   - Total number of concepts
   - User-specified hours per week available
   - Exam date (optional input)
5. Each session in the plan has:
    - Topics to cover
    - Estimated duration
    - Which documents to read
    - Suggested flashcard + quiz targets
6. If an exam date is supplied, generate an optimal exam revision timeline ensuring every due concept is reviewed at least twice, weighted by weakness and FSRS stability

#### Curriculum UI
- Timeline/Gantt-style view of the study plan
- Module-by-module progress (% complete)
- Today's session highlighted with clear action items
- Mark session complete → moves to next
- "I already know this" skip button per topic
- Adjust pace: compress or expand timeline

### 6.7 Knowledge Graph

- Visual graph of all concepts in a module (or cross-module)
- Nodes = concepts, edges = relationships (prerequisite, related, contrasts with)
- Node size = importance score, node colour = mastery level
- Click node → concept detail panel (definition, source docs, linked flashcards, quiz performance)
- Force-directed layout using D3.js or Sigma.js
- Filter by: mastered only, weak only, specific document
- Zoom/pan with mouse
- "Gap Detection" highlight: concepts mentioned but never fully defined in materials, shown as orange nodes
- Cross-module mode surfaces synthesis opportunities and bridge cards between related modules

### 6.8 Document Viewer + Transcript Sync

For lecture recordings uploaded alongside slides:
- Side-by-side view: slide panel (left) + transcript/audio player (right)
- Auto-alignment: AI matches transcript segments to slides
- Click any slide → jump to that moment in audio playback
- Click any transcript sentence → jump to that slide
- Transcript search: type a term → highlights all occurrences + timestamp list
- Playback speed: 1x / 1.25x / 1.5x / 2x
- Generate notes for current slide segment
- Create flashcard from highlighted transcript text

### 6.9 Semantic Search

- Global search bar (Cmd/Ctrl + K)
- Searches across: concept names, flashcard fronts/backs, document text
- Uses FAISS vector similarity — returns semantically relevant results even with different wording
- Filter results by: module, document, concept, card type
- Click result → jump to source document at relevant location

### 6.10 Session Dashboard (Homepage)

On load, the dashboard shows:
- **Today's Agenda**: due flashcards count + recommended quiz session
- **Streak counter**: consecutive days studied
- **Module health cards**: mastery % + due cards per module
- **Weakness spotlight**: top 3 weakest concepts with "Drill now" CTA
- **Recent activity**: last 5 sessions with scores
- **Study time tracker**: today / this week / all time (hours)
- **Exam countdown**: optional — input exam date, shows days remaining with urgency colouring
- **Retention forecast**: predicted retention % for each module over the next 1, 3, 7, and 14 days
- **Concept mastery heatmap calendar**: GitHub-style daily view of mastery gain by day
- **Session replay**: open any past session to review every answer, correction, and AI feedback

### 6.11 Anki Export

- Export any module's flashcards as native `.apkg` file (via `genanki`)
- Preserves: card text, tags, note type (Basic/Cloze)
- FSRS scheduling data NOT exported (Anki uses its own scheduler)
- One click: "Export module to Anki" → downloads .apkg

### 6.12 Settings

- **Groq API Key** — input and validate on save (test call to Groq)
- **LLM Model** — dropdown: Llama 4 Scout / Llama 3.1 70B / Llama 3.1 8B (with token limit info)
- **Daily new cards limit** — slider 5–50
- **FSRS parameters** — advanced: desired retention rate (default 90%), max interval (days)
- **Quiz preferences** — default question count, default difficulty
- **Weakness threshold** — accuracy % below which a concept is "weak" (default 70%)
- **AI generation settings**:
  - Cards per document (default 20)
  - Questions per document (default 10)
  - Question difficulty mix
- **Theme** — Light / Dark / System
- **Keyboard shortcuts** reference panel
- **Data management**: export all data as JSON, import data, clear all data, reset progress only
- **Markdown / LaTeX rendering** toggle and KaTeX preview defaults

---

## 7. API Endpoints

### Modules
```
GET    /api/modules                          # List all modules with stats
POST   /api/modules                          # Create module
GET    /api/modules/{id}                     # Module detail + documents
PATCH  /api/modules/{id}                     # Update name/description/colour
DELETE /api/modules/{id}                     # Delete + all contents
GET    /api/modules/{id}/stats               # Detailed stats (mastery, trends)
POST   /api/modules/{id}/import-folder       # Bulk import from local path
```

### Documents
```
POST   /api/documents/upload                 # Upload file(s), returns job IDs
POST   /api/documents/clip-url               # Fetch readable content from URL and ingest it
POST   /api/documents/youtube                # Queue YouTube lecture download + transcription
GET    /api/documents/{id}                   # Document detail + status
GET    /api/documents/{id}/text              # Raw extracted text
DELETE /api/documents/{id}
GET    /api/processing-jobs/{job_id}         # Polling endpoint for processing status
```

### Flashcards
```
GET    /api/flashcards?module_id=&due=true   # Get due cards for review
POST   /api/flashcards                       # Manually create card
PATCH  /api/flashcards/{id}                 # Edit card
DELETE /api/flashcards/{id}
POST   /api/flashcards/{id}/review           # Submit review rating → FSRS update
GET    /api/flashcards/{id}/retention-curve  # Predicted retention % over time for a card
POST   /api/flashcards/{id}/elaborate        # Generate follow-up "Go Deeper" prompts
POST   /api/modules/{id}/generate-cards      # Trigger AI card generation for module
GET    /api/modules/{id}/export-anki         # Download .apkg
```

### Quiz
```
GET    /api/questions?module_id=&difficulty=&type=&weak_only=true
POST   /api/questions                        # Manually create question
PATCH  /api/questions/{id}
DELETE /api/questions/{id}
POST   /api/quizzes/generate                 # Generate quiz session config
POST   /api/quizzes/sessions                 # Start quiz session
POST   /api/quizzes/sessions/{id}/answer     # Submit answer, get feedback + grading
POST   /api/quizzes/sessions/{id}/confidence # Record pre-answer confidence
POST   /api/quizzes/sessions/{id}/complete   # End session, save stats
GET    /api/quizzes/sessions/{id}/results    # Session results + breakdown
```

### Concepts / Knowledge Graph
```
GET    /api/concepts?module_id=              # All concepts for module
GET    /api/concepts/{id}                    # Concept detail + linked cards/questions
GET    /api/modules/{id}/knowledge-graph     # Graph nodes + edges JSON
GET    /api/modules/{id}/concept-gaps        # Concepts mentioned but not fully defined
POST   /api/concepts/{id}/drill              # Create targeted quiz on this concept
```

### Weakness Map
```
GET    /api/weakness-map?module_id=          # Concept list with confidence scores
GET    /api/weakness-map/optimal-session     # Generate recommended session
```

### Search
```
GET    /api/search?q=&module_id=&limit=20    # Semantic search across all content
```

### Sessions / Analytics
```
GET    /api/sessions?module_id=&limit=       # Study session history
GET    /api/sessions/{id}/replay             # Full session replay with answers + feedback
GET    /api/study-sessions/estimate          # Due cards + predicted duration for planned session
POST   /api/free-recall/sessions             # Score free recall response against source material
POST   /api/writing-practice/sessions        # Timed essay session + grading
GET    /api/analytics/overview               # Dashboard stats
GET    /api/analytics/streaks                # Study streak data
GET    /api/analytics/performance-over-time  # Score trends
GET    /api/analytics/retention-forecast     # Module retention forecast at 1/3/7/14 days
GET    /api/analytics/mastery-calendar       # Daily mastery-gain heatmap data
POST   /api/revision-plans                   # Generate revision timeline from exam date
```

---

## 8. UI/UX Specifications

### Design System
- **Theme**: Dark mode default (exam revision = late nights), light mode toggle
- **Palette**: Deep navy background (#0d1117), teal primary (#00b4d8), white text
- **Font**: Inter for UI, JetBrains Mono for any code/formula content
- **Sidebar navigation**: collapsible, modules listed with coloured dots + due card badges
- **Icons**: Lucide React
- **Animations**: Framer Motion for card flips, page transitions, progress fills
- **Keyboard system**: global shortcut registry with discoverable `?` cheatsheet overlay

### Key Screens

#### Dashboard
- Top row: 3 KPI cards (Due Cards Today / Active Streak / Overall Mastery %)
- Module grid (2-col): coloured cards showing name, doc count, mastery bar, due badge
- Sidebar: today's recommended session with estimated time
- Weakness spotlight: 3 concept chips coloured red → "Drill" button
- Retention forecast widget: 1 / 3 / 7 / 14 day cards per module
- Mastery heatmap calendar below recent activity

#### Flashcard Review
- Large card centre-screen, flip on click or Space
- Progress bar top: X/Y cards reviewed this session
- FSRS info bottom: "Due in 3 days if you press Good"
- Keyboard hints shown first time, hideable
- Session complete screen: cards reviewed, new cards introduced, time taken
- Confidence picker shown before reveal when enabled
- Markdown + KaTeX rendered inline on front/back and in answer preview
- Expandable retention curve chart and "Go Deeper" follow-up panel

#### Quiz Mode
- Clean question card, full-width
- MCQ: 4 option buttons, highlight on hover, green/red on submit
- Short answer: textarea + submit button
- AI grading feedback appears below in an animated panel
- Score ring at top-right, updates live
- Timed Exam mode locks to one question at a time with persistent countdown
- Writing practice mode uses a distraction-free timed editor with autosave

#### Weakness Map
- Heatmap grid: each cell = a concept, colour = confidence
- Hover tooltip: concept name, accuracy %, last reviewed date
- Click → slide-in panel with drill button and linked content
- Toggle: "Show Mastered" (greyed out by default)
- Orange unresolved concepts indicate detected concept gaps from the source material

#### Free Recall
- Blank topic canvas with source-backed grading summary
- Missing concepts highlighted in a side panel with direct links to source excerpts

---

## 9. AI Prompts Specification

### 9.1 Concept Extraction Prompt
```
System: You are an expert academic tutor. Extract structured learning content from the following study material.

User: Given this text from a {subject} lecture/document, extract:
1. KEY CONCEPTS: List every important concept, term, theory, or framework with a clear definition
2. FACTS & FIGURES: Important numbers, dates, statistics mentioned
3. PROCESSES: Any step-by-step procedures or algorithms
4. RELATIONSHIPS: How concepts relate to each other (A causes B, A is a type of B, A contrasts with B)
5. EXAM LIKELY: Mark concepts that seem likely to be examined

Format as JSON with schema: {concepts: [{name, definition, importance: 1-10, relationships: [{target, type}]}]}

Text: {document_text}
```

### 9.2 Flashcard Generation Prompt
```
System: You are creating high-quality study flashcards following best practices: atomic (one fact per card), clear, testable.

User: Create {n} flashcards from this content. Mix of:
- Basic Q&A (most cards)
- Cloze deletions for key terms (format: "The {{c1::term}} is defined as...")
- Definition cards

Focus on: concepts likely to be examined, non-obvious relationships, specific figures/thresholds.
Do NOT create trivial or obvious cards.

Return JSON: [{front, back, type: "basic"|"cloze", cloze_text?: string, tags: []}]

Content: {extracted_concepts + source_text}
```

### 9.3 Quiz Question Generation Prompt
```
System: You are an experienced {subject} examiner writing exam questions.

User: Generate {n} exam questions from this content. Include:
- {mcq_count} multiple choice questions (4 options, only 1 correct)
- {short_count} short answer questions (2-4 sentence answers)
- {exam_count} exam-style questions (worth 8-12 marks, require detailed answers)

For each question include: question_text, type, options (if MCQ), correct_answer, explanation, difficulty (easy/medium/hard/exam), which concept it tests.

Make questions that test UNDERSTANDING not just recall. Use application and analysis where possible.

Return JSON array.

Content: {document_text}
```

### 9.4 Short Answer Grading Prompt
```
System: You are grading a student's answer. Be fair but rigorous.

Question: {question}
Model Answer: {correct_answer}
Student Answer: {user_answer}

Score this 0-100 based on:
- Accuracy of facts stated
- Key concepts mentioned
- Conceptual understanding demonstrated

Return JSON: {score: int, feedback: str (2-3 sentences), what_was_correct: str, what_was_missing: str, improved_answer: str}
```

### 9.5 Free Recall / Gap Analysis Prompt
```
System: You are evaluating a student's free-recall response against the supplied source material.

User: Compare the student's response with the source material and return:
- coverage_score (0-100)
- correctly recalled concepts
- missing concepts
- misconceptions
- 3 next-best follow-up prompts

Return JSON: {coverage_score: int, recalled: [], missing: [], misconceptions: [], follow_up_prompts: []}
```

### 9.6 Elaboration Prompt Generator
```
System: You are helping a student deepen understanding after answering a flashcard.

User: Generate 2-3 short follow-up questions that force application, comparison, or transfer of the concept rather than pure recall.

Return JSON: {prompts: []}
```

---

## 10. Implementation Phases

### Phase 1 — MVP (Core Loop)
**Goal**: Working revision tool in one sitting
- [ ] FastAPI backend + SQLite DB setup
- [ ] Module CRUD
- [ ] PDF and TXT file upload + text extraction
- [ ] Groq AI integration for flashcard generation
- [ ] Basic flashcard review UI with FSRS scheduling
- [ ] Simple quiz mode (MCQ only)
- [ ] React frontend with dashboard + module view
- [ ] Settings page (API key input)

### Phase 2 — Adaptive Engine
- [ ] Weakness Map page (concept heatmap)
- [ ] Quiz accuracy tracking per concept
- [ ] Weakness Drill mode (filter questions to weak concepts)
- [ ] Optimal session generator
- [ ] Short answer AI grading
- [ ] Cloze deletion flashcards
- [ ] Analytics / streak tracking
- [ ] Confidence calibration tracking
- [ ] Smart session estimator + forgetting curve visualiser

### Phase 3 — Rich Ingestion
- [ ] PPTX/DOCX support
- [ ] Audio/video upload + Whisper transcription
- [ ] YouTube URL ingest with `yt-dlp`
- [ ] Web clipper endpoint with `trafilatura`
- [ ] Transcript + slide sync viewer
- [ ] Image/OCR support
- [ ] Handwritten notes OCR with layout preservation
- [ ] Bulk folder import (local path)

### Phase 4 — Knowledge & Export
- [ ] Concept knowledge graph (D3 visualisation)
- [ ] Concept gap detection and orange-node highlighting
- [ ] Semantic search (FAISS)
- [ ] Curriculum generator + study plan
- [ ] Cross-module synthesis cards
- [ ] Anki .apkg export
- [ ] JSON data export/import
- [ ] Exam-style questions + grading

### Phase 5 — Polish
- [ ] Docker compose for one-command startup
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcut system
- [ ] Markdown / LaTeX card rendering
- [ ] Free Recall mode
- [ ] Timed exam mode + writing practice
- [ ] Retention forecast + mastery heatmap calendar
- [ ] Session replay
- [ ] Mobile-responsive layout
- [ ] Performance optimisation (lazy loading, pagination)
- [ ] Notifications for due cards

---

## 11. Non-Functional Requirements

- **Performance**: Page load < 1s, API responses < 200ms (excluding AI calls), AI calls < 30s
- **Reliability**: All data persisted immediately; no loss on browser close
- **Privacy**: All data local — no telemetry, no cloud sync, no data leaves the machine except Groq API calls
- **Offline**: All non-AI features work offline (review due cards, browse materials, view stats)
- **File size limits**: PDF up to 100MB, audio/video up to 500MB
- **Graceful degradation**: If Groq API is down, user can still review existing cards and questions

---

## 12. Out of Scope (v1)

- Multi-user / auth / accounts
- Cloud sync / mobile app
- Social features (shared decks, leaderboards)
- Browser extension
- Notion / Google Drive integration
- Real-time collaboration
- Payment / subscription

---

## 13. Acceptance Criteria

The build is complete when Sam can:
1. Point the app at a folder of PDFs and transcripts → have flashcards generated within 5 minutes
2. Start a review session and only be shown cards due today
3. Rate cards (Again/Hard/Good/Easy) and see next review dates update in real time
4. Take a quiz and get instant feedback with explanations
5. Open the Weakness Map and identify his 3 weakest topics
6. Click "Drill weakest topics" and be quizzed exclusively on those
7. See his mastery % increase over multiple sessions
8. Export a module's flashcards as an Anki deck
9. Search his entire knowledge base semantically
10. Paste a YouTube URL or web URL and have it processed like any other study source
11. View a card's predicted retention curve and estimated next-forget date
12. Run a timed exam, free-recall session, or writing practice session and review the full replay afterwards
13. See unresolved concept gaps as orange nodes in the knowledge graph
14. Review retention forecasts and a day-by-day exam revision timeline
15. Study formula-heavy cards with Markdown and LaTeX rendering plus keyboard-only navigation

---

## 14. Follow-Up Spec for Claude Code — Full Scholium Parity

Claude Code should treat the following as the next major product increment after the current PRD baseline:

### Workstream A — Study Intelligence
- Add forgetting-curve visualisation for every flashcard using FSRS stability data.
- Add smart session estimation before session start using due-count and rolling average pace.
- Add concept gap detection across all uploaded materials and surface unresolved concepts as orange graph nodes.
- Generate cross-module synthesis cards when multiple modules share related concepts.
- Add post-answer elaboration prompts ("Go Deeper") that generate 2–3 applied follow-up questions.
- Add Free Recall mode with source-grounded scoring and missing-concept highlighting.

### Workstream B — Content Processing
- Support YouTube URL ingestion via `yt-dlp`, `ffmpeg`, and Whisper transcription.
- Add `POST /api/documents/clip-url` to fetch readable content with `trafilatura`.
- Improve image ingestion to support handwritten-notes OCR with preserved layout structure.
- Expand bulk folder import so subfolders can automatically become sub-modules or grouped imports.

### Workstream C — Review & Testing
- Add full Timed Exam mode with one-question flow, countdown, auto-submit, and mark-scheme review.
- Record pre-answer confidence ratings and expose calibration analytics in the dashboard and weakness map.
- Add image occlusion card authoring and review support.
- Add spaced writing practice with timed essays, AI grading, and paragraph-level feedback.

### Workstream D — Analytics & Progress
- Add retention forecasts at 1, 3, 7, and 14 day horizons for every module.
- Add optimal exam revision timeline generation from a supplied exam date.
- Add session replay so every past session can be audited question-by-question.
- Add a concept mastery heatmap calendar showing daily mastery gains.

### Workstream E — UX & Integrations
- Expand keyboard shortcuts into a complete, discoverable shortcut system with `?` cheatsheet.
- Render Markdown and LaTeX in flashcards and related study surfaces using KaTeX.

### Delivery Notes
- Keep these features additive to the existing local-first architecture.
- Reuse the current Groq-first AI stack wherever possible.
- Prioritise data-model and API changes that unlock multiple UI surfaces at once.
- Preserve offline behaviour for all non-AI interactions.

---

*End of PRD — RevisionOS v1.1*
