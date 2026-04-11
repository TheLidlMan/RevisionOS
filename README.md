# RevisionOS — AI-Powered Adaptive Study Platform

RevisionOS transforms folders of lecture transcripts, PDFs, and slides into an intelligent, adaptive revision engine. It ingests study materials organised by module, generates flashcards and quizzes using AI, tracks per-question mastery with the FSRS spaced repetition algorithm, and only surfaces material you haven't yet mastered.

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
RevisionOS/
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
2. Deploy the backend to Railway.
3. Build and deploy the frontend to Cloudflare Pages.

### Required GitHub Secrets

Add these in GitHub: **Settings -> Secrets and variables -> Actions -> New repository secret**.

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production Postgres URL used for Alembic migrations |
| `RAILWAY_TOKEN` | Railway API token used by the CLI in GitHub Actions. Recommended and preferred. |
| `RAILWAY_ACCESS_TOKEN` | Optional fallback access token if you cannot use `RAILWAY_TOKEN` |
| `RAILWAY_REFRESH_TOKEN` | Optional fallback refresh token paired with `RAILWAY_ACCESS_TOKEN` |
| `RAILWAY_PROJECT_ID` | Railway project id |
| `RAILWAY_SERVICE_ID` | Railway backend service id (recommended, avoids name ambiguity) |
| `RAILWAY_SERVICE_NAME` | Railway backend service name (fallback if service id is not provided) |
| `VITE_API_BASE_URL` | Public backend API base URL for frontend builds (e.g. `https://revisionos-api-production.up.railway.app/api`) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages deploy permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| `CLOUDFLARE_PAGES_PROJECT` | Cloudflare Pages project name (e.g. `revisionos-frontend`) |

After these secrets are set, every push to `main` will automatically update production.

## License

MIT
