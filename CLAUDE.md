# Avatar Foundry

## Project Structure
- **Monorepo** with npm workspaces: `client/` (React) and `server/` (Node.js)
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Express + TypeScript + WebSocket proxy

## Development
```bash
npm install          # Install all dependencies
npm run dev          # Start both client (:3000) and server (:8080)
```

## Key Commands
- `npm run build` — Production build (both client and server)
- `npm run lint` — Lint both projects

## Architecture
- Voice Live API (`2026-01-01-preview`) via WebSocket for real-time voice
- GPT-5 Realtime (inline mode) for LLM reasoning + MCP tool calling
- TTS Avatar (Meg Casual) via WebRTC for visual avatar
- Work IQ MCP servers for M365 actions (Calendar, Mail, Teams, etc.)
- Entra ID auth via MSAL with OBO flow for delegated access

## Conventions
- TypeScript strict mode everywhere
- Shared types in `client/src/types/index.ts`
- Environment validation via Zod in `server/src/config/env.ts`
- All M365 actions require user authentication (Entra ID)
- Keep spoken responses concise (2-3 sentences) — output is spoken aloud

## Auth
- App Registration: `Agent365-Claude-Bridge` (9b00c7ab-2ec3-463f-9a30-0dbfbb3800af)
- Frontend: MSAL popup login → access token
- Backend: OBO exchange for Work IQ MCP scopes
