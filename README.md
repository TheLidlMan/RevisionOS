# Revise OS

**AI-powered adaptive study. Turn your lecture notes into exam performance.**

[![Deploy with Railway](https://railway.app/button.svg)](https://railway.app)
[![Deploy with Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-frontend-orange)](https://dash.cloudflare.com)

Revise OS transforms folders of lecture transcripts, PDFs, and slides into an intelligent, adaptive revision engine. Upload your materials, get AI-generated flashcards and quizzes, and let the FSRS spaced repetition algorithm handle the rest — surfacing only what you haven't yet mastered, exactly when you need to see it.

**[Visit reviseos.co.uk](https://reviseos.co.uk)** — use the live app free, no setup required.

---

## What it looks like

Screenshots and full feature demos are available at **[reviseos.co.uk](https://reviseos.co.uk)**:

| | |
|---|
| ![Study Dashboard](https://reviseos.co.uk/screenshots/dashboard.png) | ![Flashcard Review](https://reviseos.co.uk/screenshots/flashcards.png) |
| *Dashboard — track mastery across every module* | *Flashcard review with FSRS scheduling* |
| ![Quiz Mode](https://reviseos.co.uk/screenshots/quiz.png) | ![Knowledge Graph](https://reviseos.co.uk/screenshots/graph.png) |
| *AI-generated quizzes with explanations* | *Visualise how concepts connect* |
| ![Study Planner](https://reviseos.co.uk/screenshots/planner.png) | |
| *Science-backed weekly planner* | |

---

## Features

### Adaptive Flashcards
Upload any PDF or text file. Revise OS extracts key concepts and generates high-quality flashcards using AI. No manual card creation required.

### FSRS Spaced Repetition
Industry-standard FSRS algorithm schedules reviews at the optimal moment — just before you'd forget. More efficient than traditional flashcard apps, backed by research.

### AI Quiz Mode
Multiple choice questions generated from your materials. Instant feedback with explanations so you understand why you got something wrong — not just whether you did.

### Knowledge Graph
Watch concepts from your notes form a living map. See how topics connect, surface isolated gaps, and understand the structure of your knowledge spatially.

### Smart Study Planner
A personalised weekly schedule that balances new learning with review sessions, tuned to your performance. Rest days included — science says so.

### Module Organisation
Organise by subject, course, or topic. Colour-coded modules keep everything tidy. One click to upload, one click to generate.

### Bring Your Own API Key
Uses the Groq API — bring your own key, use the free tier, never get locked in. Full control, no hidden costs.

---

## Live App

The easiest way to use Revise OS is the hosted version — no setup, no configuration, ready in seconds.

**👉 [app.reviseos.co.uk](https://app.reviseos.co.uk)**

Free to start. Groq API key required (free tier available at [console.groq.com](https://console.groq.com)).

---

## Self-Host Quick Start

Want to run it on your own machine or server? You'll need:

- **Python 3.11+**
- **Node.js 18+**
- A **Groq API key** — sign up free at [console.groq.com](https://console.groq.com)

### Option 1 — Docker (recommended)

```bash
git clone https://github.com/TheLidlMan/RevisionOS.git
cd RevisionOS

# Add your Groq API key
cp .env.example .env
# Edit .env and set GROQ_API_KEY=your_key_here

# Start everything (frontend + backend)
docker compose up --build
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option 2 — Manual

**Backend:**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export GROQ_API_KEY=your_key_here
uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**, proxying API calls to the backend at **http://localhost:8000**.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | FastAPI (Python 3.11+) |
| Database | SQLite via SQLAlchemy |
| AI/LLM | Groq API (`openai/gpt-oss-120b` primary) |
| Spaced Repetition | [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs) v4 |

---

## Project Structure

```
RevisionOS/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── models/              # ORM models
│   ├── routers/             # API endpoints
│   └── services/
│       ├── ai_service.py   # Groq API integration
│       ├── file_processor.py # PDF/text extraction
│       └── fsrs_service.py  # Spaced repetition engine
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable UI
│   │   ├── api/             # Typed API client
│   │   └── store/           # Zustand state management
│   └── vite.config.ts
├── marketing/               # Landing page (reviseos.co.uk)
├── docker-compose.yml
└── .env.example
```

---

## API Docs

With the backend running, visit **[http://localhost:8000/docs](http://localhost:8000/docs)** for the interactive Swagger UI.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/modules` | List all modules with stats |
| `POST` | `/api/documents/upload` | Upload a PDF or text file |
| `POST` | `/api/modules/{id}/generate-cards` | Generate AI flashcards |
| `GET` | `/api/flashcards?module_id=&due=true` | Get cards due for review |
| `POST` | `/api/flashcards/{id}/review` | Submit a review rating |
| `POST` | `/api/quizzes/sessions` | Start a quiz session |
| `GET` | `/api/analytics/overview` | Dashboard statistics |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | *(required)* | Your Groq API key |
| `DATABASE_URL` | `sqlite:///./revisionos.db` | Database connection |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Primary LLM model |
| `LLM_MODEL_QUALITY` | `openai/gpt-oss-20b` | Mid-tier model |
| `LLM_MODEL_FAST` | `llama-3.1-8b-instant` | Fast/cheap model |
| `DAILY_NEW_CARDS_LIMIT` | `20` | New cards introduced per day |
| `CARDS_PER_DOCUMENT` | `200` | Max flashcards generated per document |
| `QUESTIONS_PER_DOCUMENT` | `10` | Quiz questions generated per document |
| `DESIRED_RETENTION` | `0.9` | FSRS target retention rate |

---

## Production Deploy

### Frontend (Cloudflare Pages)

1. Connect the repo to Cloudflare Pages
2. Set root directory to `frontend`
3. Build command: `npm run build` → output: `dist`
4. Add environment variable: `VITE_API_BASE_URL` = your backend URL

### Backend (Railway)

Connect the repo to Railway and point it at the `backend/` directory. Add your `GROQ_API_KEY` and optionally `DATABASE_URL` (for a hosted Postgres instead of SQLite).

### Database Migrations

A GitHub Action runs Alembic migrations on every push to `main`. Requires `DATABASE_URL` set as a repository secret.

---

## License

MIT
