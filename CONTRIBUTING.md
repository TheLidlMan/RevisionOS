# Contributing to RevisionOS

Thank you for your interest in contributing to RevisionOS!

## Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker and Docker Compose (for local development)
- Neo4j (for graph database features)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/revisionos.git
   cd revisionos
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and fill in required values
   ```

3. **Start infrastructure services**
   ```bash
   docker-compose up -d neo4j
   ```

4. **Backend setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn main:app --reload
   ```

5. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Marketing site (optional)**
   ```bash
   cd marketing
   npm install
   npm run dev
   ```

## Project Structure

```
revisionos/
├── backend/          # FastAPI backend
│   ├── main.py       # Application entry point
│   ├── routers/       # API route handlers
│   ├── models/       # SQLAlchemy models
│   ├── services/     # Business logic
│   └── config.py     # Configuration
├── frontend/         # React frontend (Vite)
│   ├── src/
│   │   ├── api/      # API client
│   │   ├── components/ # React components
│   │   ├── pages/    # Page components
│   │   ├── hooks/    # Custom React hooks
│   │   └── store/    # State management
│   └── ...
├── marketing/        # Marketing React site
├── shared/           # Shared types and utilities
└── supabase/         # Supabase configuration
```

## Code Style

### Python (Backend)
- Follow PEP 8
- Use type hints
- 100 character max line length
- Use async/await for I/O operations

### TypeScript/JavaScript (Frontend)
- Use strict TypeScript
- Follow the existing component patterns
- Use functional components with hooks
- Prefer TanStack Query for data fetching

## Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Write code following the style guidelines
   - Add tests if applicable
   - Update documentation as needed

3. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue #X"
   ```

   We use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for formatting changes
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

4. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### End-to-End Tests
```bash
# Start the full stack
docker-compose up

# Run e2e tests
npm run test:e2e
```

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node/Python versions, etc.)
- Screenshots if applicable

## Questions?

Feel free to open an issue for questions or reach out to the maintainers.
