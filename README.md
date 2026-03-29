# Avatar Foundry

An autonomous AI Executive Assistant with HD avatar and real-time voice, powered by Microsoft Foundry.

**Aria** is a full-body, photorealistic AI assistant that can see, hear, and speak — built on Azure's Voice Live API, GPT-5 Realtime, and the Meg Casual avatar via WebRTC.

> **Not just retrieval — fully actionable.** Aria goes beyond read-only access to your Microsoft 365 data. Powered by Work IQ MCP servers, she can take real actions on your behalf: sending emails, creating meetings, and updating your calendar — capabilities that go beyond today's Microsoft Copilot experiences.

## Demo

![Aria — AI Executive Assistant](Aria-Screenshot.png?v=2)

> "Hey Aria, what's on my calendar today?"

Aria responds with natural speech and lip-synced HD avatar video in real-time. She can manage your calendar, search the web, send emails, and handle Teams meetings — all through voice.

## Why a Visual Avatar?

The HD avatar isn't just eye candy — it unlocks real-world scenarios where a visual presence provides genuine value over voice-only or text interfaces:

**Accessibility & Inclusion** — Deaf and hard-of-hearing users can rely on the avatar's accurate lip sync as a visual speech channel. Users with cognitive disabilities process information better with a visual anchor and facial cues. Elderly users in healthcare and banking find a face more approachable than a disembodied voice.

**Customer-Facing Kiosks & Reception** — Hotel check-in, airport information desks, retail, government services. A face on a screen replaces a staffed desk 24/7 at a fraction of the cost. The Government of Malta already uses avatar agents for public services.

**Contact Centers at Scale** — Video-enabled support for high-value customers in banking, insurance, and telecoms. At scale, avatar cost per-customer-minute is still significantly cheaper than a fully loaded human agent, while research consistently shows people trust and retain information better from a face vs. voice-only.

**Healthcare** — Patient-facing clinical assistants, mental health check-ins where a face reduces isolation, and medication reminders for elderly patients who respond better to a "person" than a notification.

## Actionable via WorkIQ

Aria is not limited to retrieving information — she is **fully actionable** via Work IQ MCP servers. Using delegated Entra ID (OBO) tokens, she can act on your behalf across Microsoft 365:

| Capability | Example |
|------------|---------|
| 📧 **Send emails** | *"Aria, send a follow-up email to the team with a summary of today's meeting."* |
| 📅 **Create meetings** | *"Schedule a 30-minute sync with John for Thursday at 2pm."* |
| ✏️ **Update meetings** | *"Move my 3pm call tomorrow to 4pm and add Sarah to the invite."* |
| 📬 **Read & search mail** | *"Do I have anything urgent from my manager this week?"* |
| 👥 **Look up people** | *"Find the contact details for the engineering lead."* |
| 🔍 **Web search** | *"What are the latest Azure AI pricing changes?"* |

> **Beyond today's Copilot:** As of March 2026, Microsoft Copilot remains largely read-only for many M365 actions. Aria, powered by Work IQ, can create and send emails, create and reschedule meetings, and take write actions across M365 — all through natural voice conversation with a photorealistic HD avatar. This is a capability gap that sets this solution apart.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + TypeScript + Vite)                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  MSAL    │  │ Conversation │  │  Avatar (WebRTC)          │  │
│  │  Auth    │  │ Panel        │  │  - HD video (H.264)       │  │
│  └──────────┘  └──────────────┘  │  - TTS audio output       │  │
│                                   └───────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Mic Capture (AudioWorkletNode → PCM16 → WebSocket)     │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────▼──────────────────────────────────────┐
│  Backend (Express + TypeScript)                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  WebSocket Proxy (/ws/voice-live)                        │    │
│  │  - Entra ID auth (DefaultAzureCredential)                │    │
│  │  - OBO token exchange for Work IQ MCP                    │    │
│  │  - session.update → Voice Live API (with MCP tools)      │    │
│  │  - Bidirectional message forwarding                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│  REST: /api/health, /api/avatar/config, /api/avatar/ice, /api/ticker, /api/weather │
└───────────────────────────┬──────────────────────────────────────┘
                            │ WSS (Bearer token)
┌───────────────────────────▼──────────────────────────────────────┐
│  Azure Voice Live API (2026-01-01-preview)                       │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ GPT-5      │  │ Dragon HD    │  │ Meg Casual Avatar       │  │
│  │ Realtime   │  │ Ava Voice    │  │ (WebRTC SDP exchange)   │  │
│  │ (reasoning)│  │ (TTS)        │  │ 29 gestures, full-body  │  │
│  └────────────┘  └──────────────┘  └─────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Work IQ MCP Tools (via OBO delegation)                  │    │
│  │  Calendar · Mail · Teams · People · Copilot · Word       │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| Backend | Express 5, TypeScript, WebSocket (ws) |
| Auth | MSAL.js v5 (Entra ID redirect + OBO flow) |
| Voice | Voice Live API, Dragon HD Ava3 Neural voice |
| Avatar | Meg Casual, WebRTC (H.264), base64-encoded SDP |
| LLM | GPT-5 Realtime (`gpt-realtime-1.5`) |
| Tools | Work IQ MCP servers (Calendar, Mail, Teams, People, Copilot, Word) |
| Weather | Open-Meteo free API (no key required) |
| Infrastructure | Bicep (Azure AI Services, App Service, Static Web Apps) |

## Prerequisites

- **Node.js** >= 20
- **Azure CLI** logged in (`az login`)
- **Azure AI Services** resource in a [supported region](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars) (eastus2, westus2, northeurope, swedencentral, southeastasia, southcentralus, westeurope)
- **App Registration** with SPA redirect URI (`http://localhost:3000`)
- RBAC: **Cognitive Services User** + **Azure AI User** on the AI Services resource

## Quick Start

```bash
# Clone and install
git clone https://github.com/ITSpecialist111/Aria-Avatar-Foundry-WorkIQ.git
cd Avatar-Foundry
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Azure resource values (see Environment section below)

# Run development servers
npm run dev
# Client: http://localhost:3000
# Server: http://localhost:8080
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_TENANT_ID` | Yes | Entra ID tenant |
| `VOICELIVE_ENDPOINT` | Yes | AI Services custom domain (`https://<name>.cognitiveservices.azure.com`) |
| `SPEECH_REGION` | Yes | Azure region (`eastus2`) |
| `MSAL_CLIENT_ID` | Yes | App registration client ID |
| `MSAL_CLIENT_SECRET` | Yes* | App registration secret (required for OBO/MCP tools) |
| `MSAL_TENANT_ID` | Yes | Same as `AZURE_TENANT_ID` |
| `VITE_MSAL_CLIENT_ID` | Yes | Same as `MSAL_CLIENT_ID` (for Vite) |
| `VITE_MSAL_TENANT_ID` | Yes | Same as `AZURE_TENANT_ID` (for Vite) |
| `WORKIQ_ENVIRONMENT_ID` | No* | Power Platform environment ID (required for MCP tools) |
| `VOICELIVE_MODEL` | No | Realtime model deployment name (default: `gpt-4o-realtime-preview`) |
| `VOICE_NAME` | No | TTS voice (default: `en-US-Ava3:DragonHDLatestNeural`) |
| `AVATAR_CHARACTER` | No | Avatar character (default: `meg`) |
| `AVATAR_STYLE` | No | Avatar style (default: `casual`) |
| `AVATAR_BACKGROUND_URL` | No | Public URL for avatar background image (rendered server-side into video stream) |
| `PROJECT_NAME` | No | Foundry project name (enables agent mode with tools) |
| `USER_MEMORY_PATH` | No | Path for persistent memory file (default: `./data/user-memory.json`) |
| `FOLLOW_UP_PATH` | No | Path for follow-up tracking file (default: `./data/follow-ups.json`) |

## Scripts

```bash
npm run dev      # Start client + server in development mode
npm run build    # Production build (both packages)
npm run lint     # Lint both packages
npm run clean    # Remove dist/ from both packages
```

## Project Structure

```
Avatar-Foundry/
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.tsx            # Main app (login + standard/accessible mode routing)
│   │   ├── auth/              # MSAL config
│   │   ├── components/
│   │   │   ├── AccessibleView.tsx    # Full-screen accessible mode (no avatar)
│   │   │   ├── AvatarView.tsx        # WebRTC HD avatar display
│   │   │   ├── ConversationPanel.tsx  # Chat transcript with ARIA live regions
│   │   │   ├── DashboardCard.tsx      # Reusable card (calendar/email/weather/task/action)
│   │   │   ├── DashboardPanel.tsx     # Side panel with Quick Access + Activity feed
│   │   │   ├── DemoControls.tsx       # 10 demo scenario triggers
│   │   │   ├── StatusBar.tsx          # Header with status, accessibility toggle, settings
│   │   │   └── TickerBar.tsx          # Live ticker: weather, meetings, emails, Kanban link
│   │   ├── hooks/
│   │   │   ├── useVoiceLive.ts        # WebRTC + WebSocket + mic + MCP card parsing
│   │   │   └── useAccessibility.ts    # Font size, contrast, earcons, mode, preferences
│   │   ├── styles/globals.css         # Tailwind + high contrast + reduced motion + focus
│   │   └── types/                     # Shared TypeScript types + demo scenarios
│   └── vite.config.ts
├── server/                    # Express backend
│   ├── src/
│   │   ├── index.ts           # Express + WebSocket proxy + function call dispatch
│   │   ├── config/env.ts      # Zod environment validation
│   │   ├── routes/
│   │   │   ├── avatar.ts      # Avatar config + ICE token endpoints
│   │   │   ├── health.ts      # Health check
│   │   │   ├── session.ts     # Session management
│   │   │   └── ticker.ts      # /api/ticker (weather) + /api/weather endpoints
│   │   └── services/
│   │       ├── voiceLive.ts       # Voice Live session config + MCP tools + system prompt
│   │       ├── foundryAgent.ts    # Aria system prompt + agent metadata
│   │       ├── weather.ts         # Open-Meteo weather API (free, no key)
│   │       ├── userMemory.ts      # Persistent user memory (JSON file)
│   │       ├── followUpTracker.ts # Follow-up tracking (JSON file)
│   │       ├── meetingCountdown.ts # Proactive meeting reminders
│   │       ├── foundryDelegate.ts # Foundry Agent delegation for research
│   │       └── authService.ts     # MSAL OBO token exchange
│   └── tsconfig.json
├── infra/                     # Bicep IaC templates
│   ├── main.bicep
│   └── parameters.json
├── .env.example               # Environment template
├── CLAUDE.md                  # AI assistant instructions
├── HANDOVER.md                # Detailed technical handover document
└── ROADMAP.md                 # 20-feature roadmap across 5 phases
```

## Key Features

- **HD Avatar** — Photorealistic Meg Casual avatar with natural idle animations and lip sync
- **Real-time Voice** — Sub-200ms latency bidirectional voice via Voice Live API
- **Dragon HD Voice** — `en-US-Ava3:DragonHDLatestNeural` with 100+ speaking styles
- **Fully Actionable via Work IQ** — Send emails, create/update/move meetings, create Word docs, and more via delegated M365 MCP tools
- **Dashboard Cards** — Live side-panel cards showing calendar events, emails, weather, actions, and quick-access widgets from MCP tool results
- **Ticker Bar** — Top-of-screen ticker with weather, meeting counts, email summaries, and Kanban board link
- **Weather Integration** — Real-time weather via Open-Meteo free API (no key required), available as voice tool and dashboard widget
- **10 Demo Scenarios** — Pre-built triggers: Morning Briefing, Email Triage, Meeting Prep, Schedule Meeting, Draft Email, Deep Research, Create Document, Follow-Up Check, Teams Summary, End of Day Wrap-Up
- **Persistent Memory** — Aria remembers user preferences and facts across sessions (JSON file persistence)
- **Follow-Up Tracking** — Track action items from conversations with proactive reminders
- **Meeting Countdown** — Proactive notifications when meetings are approaching, with context
- **Multi-Step Tasks** — Complex workflow orchestration with step-by-step progress tracking
- **Foundry Agent Delegation** — Delegate complex research to background GPT-4o agent
- **Accessibility Mode** — Full-screen chat layout (no avatar) with WCAG 2.1 AA high contrast, variable font sizes, audio earcons, ARIA live regions, keyboard focus indicators, reduced motion, and localStorage-persisted preferences
- **Barge-in** — Interrupt the assistant mid-sentence; audio cuts instantly
- **Tool Call Audio Cue** — Two-tone chime when MCP tool execution begins
- **Auto-Retry** — Automatic response recovery when VAD cancels tool call responses
- **Noise Suppression** — Azure Deep Noise Suppression on mic input
- **Echo Cancellation** — Server-side echo cancellation (works with WebRTC avatar audio)
- **VAD Tuning** — Configurable threshold (0.8), silence duration (1200ms), and prefix padding (500ms)
- **Mute** — Send silence when muted (keeps server_vad alive)
- **MSAL Auth** — Enterprise SSO via Entra ID redirect flow + OBO for M365 delegation
- **Proactive Greeting** — Aria introduces herself on session start with memory context
- **Conversation Panel** — Auto-scrolling transcript with VQ token filtering and ARIA labels

## Modes

### Inline Mode (default)
No Foundry project or MCP tools needed. The system prompt is sent directly in `session.update` with explicit "no tools available" instructions. Voice works conversationally but cannot access M365 data.

### MCP Tools Mode (with `WORKIQ_ENVIRONMENT_ID`)
Work IQ MCP servers (Calendar, Mail, etc.) are injected directly into the Voice Live `session.update` as tool definitions. Uses OBO token exchange for delegated M365 access. No separate Foundry Agent needed — GPT-5 Realtime calls MCP tools directly.

### Agent Mode (with `PROJECT_NAME`)
Connects to a Foundry Agent for reasoning and tool calling. Voice Live handles the realtime voice; the agent handles LLM reasoning. Note: GPT-5 not yet supported as Foundry Agent model.

## Known Issues

- **VQ Token Artifacts** — GPT-5 Realtime occasionally leaks `<|vq_...|>` tokens or "audio text" into speech. Mitigated with 3-layer defense (system prompt + server filter + client filter) but still model-level.
- **GPT-5 Agent Support** — GPT-5 not yet available as a Foundry Agent chat model (`DeploymentModelNotSupported`). Use inline + MCP tools mode instead.
- **WebRTC Timeout** — Avatar WebRTC disconnects after 5min idle / 30min total. Auto-reconnect not yet implemented.
- **Avatar Gestures** — 29 gestures available for Meg Casual but batch synthesis only. Not supported in real-time/Voice Live mode (natural idle animations only).

## Azure Resources

| Resource | Type | Region |
|----------|------|--------|
| `ai-avatar-foundry-ghosking` | AI Services | eastus2 |
| Foundry Project: `avatar-foundry` | AI Foundry | eastus2 |

### Model Deployments
| Name | Model | SKU |
|------|-------|-----|
| `gpt-realtime` | GPT-4o Realtime (2025-08-28) | GlobalStandard |
| `gpt-realtime-1.5` | GPT-5 Realtime (2026-02-23) | GlobalStandard |
| `gpt-4o` | GPT-4o (2024-08-06) | GlobalStandard |

## Documentation

- [HANDOVER.md](./HANDOVER.md) — Detailed technical handover with architecture decisions, fixes, and known issues
- [ROADMAP.md](./ROADMAP.md) — 20-feature roadmap across 5 phases and 7 sprints
- [Voice Live API Reference](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-api-reference-2026-01-01-preview)
- [Voice Live Agents Quickstart](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-agents-quickstart)
- [Standard Avatars](https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars)
- [Work IQ MCP Servers](https://learn.microsoft.com/microsoft-agent-365/tooling-servers-overview)

## License

Private — Internal use only.
