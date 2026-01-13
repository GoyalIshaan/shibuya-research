# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages plus API route handlers (e.g., `app/api/chat/route.ts`).
- `lib/`: core logic for ingestion, data sources, knowledge base, and DB access.
- `drizzle/`: database migrations; `drizzle.config.ts` holds schema config.
- `public/`: static assets served by Next.js.
- `types/`: shared TypeScript types; `scripts/` for helper tooling.

## Build, Test, and Development Commands
- `npm run dev`: start the Next.js dev server at `http://localhost:3000`.
- `npm run build`: production build.
- `npm start`: run the production build.
- `npm run lint`: run ESLint with Next.js core-web-vitals rules.
- `npx drizzle-kit generate`: create migrations from `lib/db/schema.ts`.
- `npx drizzle-kit migrate`: apply migrations to the configured database.
- `npx drizzle-kit push`: push schema changes directly (dev-only).
- `npx drizzle-kit studio`: open the Drizzle Studio GUI.

## Coding Style & Naming Conventions
- TypeScript + Next.js App Router; prefer the `@/` path alias for imports.
- Indentation is 2 spaces; use single quotes in TS/JS and double quotes in JSX.
- React components use `PascalCase`; hooks use `useX`; API routes live under
  `app/api/<route>/route.ts`.

## Testing Guidelines
- No automated test runner is configured and no `test` script exists.
- If adding tests, document the runner and use `*.test.ts(x)` or `__tests__/`.
- Use `npm run lint` as the current baseline quality gate.

## Commit & Pull Request Guidelines
- Git history uses short, sentence-case messages (e.g., “Initial project import”).
  Keep commits concise and scoped to a single change.
- PRs should include: a brief summary, testing notes, and screenshots for UI changes.
  Link related issues when applicable.

## Security & Configuration
- Environment variables live in `.env.local` (see `env.example`).
- Required keys: `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`.
- Never commit secrets or generated credentials.
