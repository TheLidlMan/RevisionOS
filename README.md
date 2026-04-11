# Revise OS — AI-Powered Adaptive Study Platform

Revise OS transforms folders of lecture transcripts, PDFs, and slides into an intelligent, adaptive revision engine. It ingests study materials organised by module, generates flashcards and quizzes using AI, tracks per-question mastery with the FSRS spaced repetition algorithm, and only surfaces material you haven't yet mastered.

## Features

- **Smart File Processing** — Upload PDFs and text files; AI extracts key concepts automatically
- **AI Flashcard Generation** — Generates high-quality flashcards from your study materials using Groq (Llama 4 Scout)
- **FSRS Spaced Repetition** — Industry-standard scheduling algorithm ensures you review cards at optimal intervals
- **Quiz Mode** — Multiple choice questions with instant feedback and explanations
- **Module Organisation** — Organise materials by course/subject with colour coding
- **Mastery Tracking** — Track your progress per module with mastery percentages
- **Settings** — Configurable AI parameters, daily card limits, and study preferences

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | FastAPI (Python 3.11+) |
| Database | SQLite via SQLAlchemy |
| AI/LLM | Groq API (Llama 4 Scout) |
| Spaced Repetition | py-fsrs v4 |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com/) (free tier available)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/TheLidlMan/RevisionOS.git
cd RevisionOS

# Set your Groq API key
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start everything
docker compose up --build
```

The app will be available at **http://localhost:3000**.

### Option 2: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GROQ_API_KEY=gsk_your_key_here

# Start the server
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API calls to backend)
npm run dev
```

The frontend will be at **http://localhost:5173** and the API at **http://localhost:8000**.

## Usage

1. **Add your Groq API key** in Settings (`/settings`)
2. **Create a module** from the Dashboard (e.g., "Corporate Finance")
3. **Upload documents** — PDFs or text files via the Upload Center
4. **Generate flashcards** — Click "Generate Flashcards" on the module page
5. **Start reviewing** — Click "Start Review" to begin FSRS-scheduled flashcard sessions
6. **Take quizzes** — Test yourself with AI-generated multiple choice questions

## API Documentation

Once the backend is running, visit **http://localhost:8000/docs** for the interactive Swagger UI with all available endpoints.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/modules` | List all modules with stats |
| `POST /api/documents/upload` | Upload a document |
| `POST /api/modules/{id}/generate-cards` | Generate AI flashcards |
| `GET /api/flashcards?module_id=&due=true` | Get due flashcards |
| `POST /api/flashcards/{id}/review` | Submit FSRS review rating |
| `POST /api/quizzes/sessions` | Start a quiz session |
| `GET /api/analytics/overview` | Dashboard statistics |

## Project Structure

```
ReviseOS/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── config.py            # Settings & env vars
│   ├── database.py          # SQLAlchemy setup
│   ├── models/              # ORM models (7 tables)
│   ├── routers/             # API endpoints (7 routers)
│   ├── services/            # Business logic
│   │   ├── ai_service.py    # Groq API integration
│   │   ├── file_processor.py # PDF/text extraction
│   │   └── fsrs_service.py  # Spaced repetition
│   └── alembic/             # DB migrations
├── frontend/
│   ├── src/
│   │   ├── pages/           # 6 page components
│   │   ├── components/      # Reusable UI components
│   │   ├── api/             # Typed API client
│   │   ├── store/           # Zustand state
│   │   └── types/           # TypeScript interfaces
│   └── vite.config.ts
├── docker-compose.yml
└── .env.example
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | *(required)* | Your Groq API key |
| `DATABASE_URL` | `sqlite:///./revisionos.db` | Database connection |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,https://revisionos-frontend.pages.dev,https://reviseos.co.uk` | Comma-separated allowed frontend origins |
| `CORS_ORIGIN_REGEX` | `https://([A-Za-z0-9-]+\.)?revisionos-frontend\.pages\.dev` | Optional regex for Cloudflare Pages preview URLs |
| `LLM_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary LLM model |
| `UPLOAD_DIR` | `./uploads` | File upload directory |
| `DAILY_NEW_CARDS_LIMIT` | `20` | Max new cards per day |
| `CARDS_PER_DOCUMENT` | `20` | Flashcards generated per doc |
| `QUESTIONS_PER_DOCUMENT` | `10` | Quiz questions per doc |
| `DESIRED_RETENTION` | `0.9` | FSRS target retention rate |

## GitHub Auto-Deploy (Main Branch)

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-main.yml`.

On every push to `main`, it will:
1. Run Alembic migrations against your production Supabase/Postgres database.

Backend deploys are handled directly by Railway from the connected GitHub repository, so the GitHub Action no longer deploys the backend service.

Frontend deploys should also be handled directly by Cloudflare Pages via GitHub integration (build on push), so the GitHub Action no longer deploys the frontend.

For Railway direct GitHub deploys, the repository root includes a production Dockerfile that builds the backend from `backend/`, so the Railway service can continue watching `main` without needing a separate GitHub Action deploy step.

### Required GitHub Secrets

Add these in GitHub: **Settings -> Secrets and variables -> Actions -> New repository secret**.

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production Postgres URL used for Alembic migrations |

### Cloudflare Pages Direct GitHub Deploy

Connect your frontend repo to Cloudflare Pages and set:
1. Production branch: `main`
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Environment variable: `VITE_API_BASE_URL` = your Railway backend URL (for example `https://revisionos-api-production.up.railway.app/api`)

After `DATABASE_URL` is set in GitHub Actions and Cloudflare Pages is connected to this repo, pushes to `main` will run DB migrations and trigger frontend deploys automatically.

## License

MIT
