# Avatar Foundry — Handover Document

**Date:** March 27, 2026
**Author:** Setup session with GitHub Copilot

---

## 1. Project Overview

Avatar Foundry is an AI Executive Assistant ("Aria") showcase using:
- **Voice Live API** — real-time bidirectional voice via WebSocket
- **GPT-5 (gpt-realtime-1.5)** — Dragon HD Omni voice at 0.8 temperature
- **HD Avatar** — Meg Casual via WebRTC (working)
- **MSAL Auth** — Entra ID redirect flow with OBO for delegated M365 access
- **Work IQ MCP Tools** — Calendar, Mail, Teams, People, Web Search (via OBO delegation)
- **React + Vite frontend** / **Express + TypeScript backend** monorepo

---

## 2. Azure Resources Created

| Resource | Type | Region | Resource Group |
|----------|------|--------|----------------|
| `ai-avatar-foundry-ghosking` | AI Services | eastus2 | rg-avatar-foundry |
| `speech-avatar-foundry` | Speech Services | eastus2 | rg-avatar-foundry |
| `ai-avatar-foundry-westus2` | AI Services | westus2 | rg-avatar-foundry |
| `ai-avatar-foundry-sea` | AI Services | southeastasia | rg-avatar-foundry |
| `ai-avatar-foundry-swe` | AI Services | swedencentral | rg-avatar-foundry |

**Active resource:** `ai-avatar-foundry-ghosking` (eastus2)

### Model Deployments (on eastus2 resource)
- `gpt-realtime` — GPT-4o Realtime (2025-08-28) — GlobalStandard
- `gpt-realtime-1.5` — GPT-5 Realtime (2026-02-23) — GlobalStandard
- `gpt-4o` — GPT-4o (2024-08-06) — GlobalStandard, 10K TPM (for Foundry Agent reasoning)

### Foundry Project
- **Project:** `avatar-foundry` on `ai-avatar-foundry-ghosking`
- **Endpoint:** `https://ai-avatar-foundry-ghosking.services.ai.azure.com/api/projects/avatar-foundry`
- **Managed Identity:** SystemAssigned (required for project creation)
- **Agent:** Not yet created — GPT-5 chat model deployment needed (GPT-5 not yet supported as a Foundry Agent model; `gpt-4o` deployed as fallback)

### Model Deployment (on swedencentral resource)
- `gpt-realtime` — GPT-4o Realtime (2025-08-28) — GlobalStandard

### RBAC Roles Assigned
- **Cognitive Services User** — on all AI Services resources
- **Azure AI User** — on eastus2 and swedencentral resources

### Cleanup Needed
The westus2 and southeastasia resources have no model deployments (subscription quota didn't allow realtime models there). Consider deleting:
- `ai-avatar-foundry-westus2`
- `ai-avatar-foundry-sea`
- `speech-avatar-foundry` (unused — the AI Services resource handles Speech)

---

## 3. Key Architecture Decisions

### Authentication: Keyless (Entra ID)
The subscription has a policy enforcing `disableLocalAuth=true` on all Cognitive Services. All auth uses `DefaultAzureCredential`:

- **Voice Live WebSocket**: Server gets Entra token → `Bearer` auth to custom domain endpoint
- **Avatar ICE tokens**: Server exchanges Entra token via STS (`/sts/v1.0/issueToken`) for regional TTS endpoint
- **Frontend MSAL**: Redirect flow (not popup — popup was unreliable with Vite HMR)

### Voice Live Connection Flow
```
Client → Backend WS (/ws/voice-live) → Voice Live API (wss://...cognitiveservices.azure.com/voice-live/realtime)
```
The backend acts as a WebSocket proxy. It:
1. Gets Entra token via `DefaultAzureCredential`
2. Connects to Voice Live with `Bearer` auth
3. Sends `session.update` with voice/model config
4. Waits for `session.updated`, then sends greeting
5. Forwards all messages bidirectionally

### Audio Pipeline (Current — WebSocket mode)
- **Mic → Server**: Client captures mic via `ScriptProcessorNode` (4096 buffer, 24kHz), converts to PCM16, base64-encodes, sends as `input_audio_buffer.append`
- **Server → Speaker**: Voice Live sends `response.audio.delta` with base64 PCM16, client decodes and schedules via `AudioBufferSourceNode` through a `GainNode`
- **Barge-in**: On `input_audio_buffer.speech_started`, disconnects the `GainNode` to instantly silence queued audio

### Audio Pipeline (Avatar mode — WORKING)
When avatar is enabled, audio pipelines are split:
- **Mic → Server**: Same as WebSocket mode — mic captured via `ScriptProcessorNode`, sent as `input_audio_buffer.append` over WebSocket (NOT through WebRTC)
- **Avatar video + audio output**: Received via WebRTC `pc.ontrack` events
- **Key insight**: WebRTC is output-only (avatar video + TTS audio); mic always goes through WebSocket
- `startMicCapture()` is always called after `session.updated`, regardless of avatar mode

---

## 4. What's Working

- ✅ **MSAL Auth** — Redirect flow, tenant-specific authority, `handleRedirectPromise` properly awaited
- ✅ **Voice Live connection** — WebSocket proxy through backend
- ✅ **GPT-5 (gpt-realtime-1.5)** — Dragon HD Ava voice, 0.8 temperature
- ✅ **HD Avatar (Meg Casual)** — WebRTC via Voice Live, base64-encoded SDP exchange
- ✅ **Two-way voice** — Mic capture + audio playback via WebSocket PCM (or WebRTC in avatar mode)
- ✅ **Barge-in** — Instant audio cutoff via GainNode disconnect
- ✅ **Transcript display** — Filtered for GPT-5 VQ token artifacts (`<|vq_hbr_audio_...|>`)
- ✅ **Turn detection** — `server_vad` with tuned threshold (0.7), prefix (500ms), silence (800ms)
- ✅ **Noise suppression** — `azure_deep_noise_suppression`
- ✅ **Echo cancellation** — `server_echo_cancellation` (works with WebRTC avatar audio)
- ✅ **Mute** — Sends silence (zeroed PCM16) instead of stopping audio, keeps server_vad alive
- ✅ **Session management** — Start/End Session button
- ✅ **Proactive greeting** — Aria greets on session start
- ✅ **Health API** — `/api/health`, `/api/avatar/config`
- ✅ **ICE token endpoint** — `/api/avatar/ice` (STS token exchange for regional TTS)
- ✅ **Inline instructions mode** — Works without Foundry Agent project
- ✅ **Infrastructure as Code** — Bicep templates in `infra/`
- ✅ **OBO token exchange** — `authService.ts` exchanges user MSAL token for Work IQ-scoped token
- ✅ **Work IQ MCP tools wired** — Calendar, Mail, Teams, People, Web Search in `session.update`
- ✅ **Dual system prompts** — No-tools prompt (inline) vs tools-aware prompt (MCP mode)
- ✅ **Conversation panel** — Auto-scrolling, fixed layout (no avatar resize)
- ✅ **Verbose logging** — All Voice Live events logged server-side (except audio deltas)

---

## 5. Avatar — Fixed

### Root Causes (identified from official Microsoft sample code)
The avatar WebRTC connection was failing with WebSocket close code 1006 due to **four bugs** in our implementation, all identified by comparing against the [official Voice Live avatar sample](https://github.com/azure-ai-foundry/voicelive-samples/tree/main/javascript/voice-live-avatar):

| # | Bug | Fix Applied |
|---|-----|-------------|
| 1 | **SDP sent as raw string** — Voice Live expects `base64(JSON(RTCSessionDescription))` | Changed to `btoa(JSON.stringify(pc.localDescription))` |
| 2 | **Server SDP treated as raw string** — Response is also base64-encoded JSON | Changed to `JSON.parse(atob(server_sdp))` then `setRemoteDescription()` |
| 3 | **Video transceiver set to `recvonly`** — Voice Live requires `sendrecv` for both | Changed both audio and video transceivers to `sendrecv` |
| 4 | **API version defaulted to `2025-10-01`** — Avatar features require `2026-01-01-preview` | Updated `env.ts` default to `2026-01-01-preview` |

### Additional Fixes
- Added `pc.createDataChannel('eventChannel')` (required by Voice Live avatar service)
- Added `muted` to `<video>` element (browser autoplay policy requires muted for autoplay)
- Simplified ICE gathering to a 2-second fixed wait (matching official sample pattern)

### Avatar Code Location
- **Client**: `client/src/hooks/useVoiceLive.ts` — `startAvatarViaVoiceLive()`, `session.avatar.connecting` handler
- **Server**: `server/src/services/voiceLive.ts` — avatar config in `buildSessionConfig()`
- **Server**: `server/src/index.ts` — greeting delay logic for avatar handshake

---

## 6. Known Issues & Tech Debt

### MSAL Login Race Condition (FIXED)
- `handleRedirectPromise()` was fire-and-forgotten in `main.tsx` — app rendered before MSAL processed the redirect callback
- Fix: `await handleRedirectPromise()` before `root.render()`, with proper error logging
- File: `client/src/main.tsx`

### Echo / Continuous Conversation
- `server_echo_cancellation` now re-enabled — works correctly with WebRTC avatar audio output
- `azure_semantic_vad` may not work reliably with `gpt-realtime-1.5` (using `server_vad` instead)

### VAD Sensitivity (FIXED)
- Default VAD was too sensitive, triggering on background noise
- Fix: Tuned `threshold: 0.7`, `prefix_padding_ms: 500`, `silence_duration_ms: 800`
- File: `server/src/services/voiceLive.ts`

### Mute Breaking Server VAD (FIXED)
- `if (isMutedRef.current) return;` stopped all audio to server, breaking `server_vad`
- Fix: Send zeroed PCM16 (silence) when muted to keep the audio stream alive
- File: `client/src/hooks/useVoiceLive.ts`

### System Prompt Causing Tool-Calling Hangs (FIXED)
- System prompt claimed calendar/email capabilities but no `tools` array existed in inline mode
- GPT-5 attempted to call non-existent functions and hung silently
- Fix: Dual system prompts — one explicitly says "no tools available" (inline), another lists real capabilities (MCP mode)
- Files: `server/src/services/foundryAgent.ts`, `server/src/services/voiceLive.ts`

### GPT-5 VQ Token Artifacts ("Audio HBA")
- `gpt-realtime-1.5` sends VQ audio tokens in transcript fields: `<|audio_text|><|vq_hbr_audio_...|>`
- These tokens are sometimes spoken aloud by the avatar as "Audio HBA" or similar garbled speech
- Client filters these from displayed transcripts with `!data.transcript.includes('<|')`
- **Audio output still affected** — the model generates these tokens in the audio stream itself
- This is a model-level issue — may be fixed in later GPT-5 realtime versions
- Workaround: Consider adding a post-processing filter on the server side, or switching to `gpt-realtime` (GPT-4o) which doesn't have this issue

### Tool Calling Not Yet Functional
- ~~The system prompt claims calendar, email, search capabilities but no `tools` array is defined in inline mode~~
- ~~GPT-5 attempts to call functions that don't exist, then hangs waiting for results~~
- **FIXED**: Dual system prompts + Work IQ MCP tools wired into `session.update` via OBO tokens
- MCP tools injected directly as `type: 'mcp'` entries in `session.tools` with `require_approval: 'never'`
- **Testing needed**: Verify end-to-end flow (MSAL login → OBO exchange → MCP tool calls → GPT-5 response)
- Foundry Agent mode (with `PROJECT_NAME`) still available but GPT-5 not supported as agent model

### ScriptProcessorNode Deprecation
- Browser shows deprecation warning for `ScriptProcessorNode`
- Should migrate to `AudioWorkletNode` for production
- Current implementation works but is not ideal for performance

### MSAL Popup vs Redirect
- Popup auth doesn't work reliably with Vite dev server
- Using redirect flow (`loginRedirect`) instead
- `handleRedirectPromise()` error on cold load is benign (suppressed)

### Vite HMR Disconnections
- Hot module replacement causes WebSocket disconnects
- Sessions are lost on code changes during development
- Not an issue in production

---

## 7. Environment Setup

```bash
# Prerequisites
node >= 20, Azure CLI logged in

# Install & run
npm install
cp .env.example .env  # Fill in values (see current .env for reference)
npm run dev            # Starts client (:3000) + server (:8080)

# Build
npm run build
```

### Key .env Variables
| Variable | Current Value | Notes |
|----------|---------------|-------|
| `VOICELIVE_ENDPOINT` | `https://ai-avatar-foundry-ghosking.cognitiveservices.azure.com` | Custom domain endpoint |
| `VOICELIVE_MODEL` | `gpt-realtime-1.5` | GPT-5 realtime model |
| `VOICE_NAME` | `en-US-Ava:DragonHDLatestNeural` | Dragon HD voice |
| `AVATAR_CHARACTER` | `meg` | Meg Casual avatar |
| `MSAL_CLIENT_ID` | `9b00c7ab-2ec3-463f-9a30-0dbfbb3800af` | Agent365-Claude-Bridge app reg |
| `MSAL_CLIENT_SECRET` | `(set)` | Required for OBO token exchange |
| `WORKIQ_ENVIRONMENT_ID` | `ee0acf2a-d6f4-e4ac-90f9-92f259678f17` | Power Platform environment for MCP servers |
| `PROJECT_NAME` | `(empty)` | Leave empty for inline + MCP mode |

### App Registration: Agent365-Claude-Bridge
- **Client ID**: `9b00c7ab-2ec3-463f-9a30-0dbfbb3800af`
- **Tenant ID**: `e4ccbd32-1a13-4cb6-8fda-c392e7ea359f`
- **SPA Redirect URIs**: `http://localhost:3000`, `http://localhost:3000/auth/callback`
- **Web Redirect URIs**: Bot Framework, Azure API Management (pre-existing)
- **Single tenant** (Contoso)
- **Work IQ Delegated Permissions** (28 total, all granted): Calendar.All, Mail.All, Teams.All, CopilotMCP.All, Me.All, WebSearch.All, OneDriveSharepoint.All, Planner.All, Word.All, Excel.All, PowerPoint.All, SharepointLists.All, Files.All, Knowledge.All, Developer.All, Management.All, Dataverse.All, DataverseCustom.All, D365Sales.All, D365Service.All, D365ContactCenter.All, D365ContactCenterAdmin.All, Admin365Graph.All, DASearch.All, ERPAnalytics.All, FabricIQOntology.All, M365Admin.All, W365ComputerUse.All

---

## 8. Work IQ MCP Integration

### Architecture
MCP tools are injected directly into the Voice Live `session.update` payload — no separate Foundry Agent needed. GPT-5 Realtime calls MCP tools natively.

```
User speaks → Voice Live (GPT-5 Realtime) → tool_call → MCP server → tool_result → GPT-5 response
```

### Implementation Files
| File | Purpose |
|------|---------|
| `server/src/services/authService.ts` | OBO token exchange via `@azure/msal-node` ConfidentialClientApplication |
| `server/src/services/voiceLive.ts` | `buildMcpTools()` — generates MCP tool entries for `session.update` |
| `server/src/services/voiceLive.ts` | `ARIA_SYSTEM_PROMPT_WITH_TOOLS` — tools-aware system prompt |
| `server/src/index.ts` | WebSocket proxy passes OBO token to `buildSessionConfig()` |

### MCP Tool Format (in session.update) — VERIFIED WORKING
```json
{
  "type": "mcp",
  "server_label": "calendar",
  "server_url": "https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/mcp_CalendarTools/",
  "authorization": "{raw_obo_token}",
  "require_approval": "never",
  "headers": {
    "x-ms-agentid": "{client_id}",
    "User-Agent": "AvatarFoundry/1.0.0 (VoiceLive; Node.js)"
  }
}
```

**Critical notes:**
- **URL must include tenant ID** — `/agents/tenants/{tenantId}/servers/{serverId}/` (trailing slash required). Without tenant ID returns `400 Bad Request: Tenant id is invalid`.
- **`authorization` must be the RAW token** — no `Bearer ` prefix. Voice Live adds `Bearer ` automatically when making HTTP requests to MCP servers. Including it causes `Authorization: Bearer Bearer {token}` (double prefix), which silently fails with `mcp_list_tools.failed`.
- **`headers.x-ms-agentid`** — Required for MCP tool discovery. Value is the app registration client ID.

### Tool Discovery Behavior
- `mcp_list_tools.completed` is a **bare notification** — it has NO `tools` array, NO `server_label`
- Work IQ MCP servers use dynamic tool discovery; GPT-5 infers available actions from system prompt + server labels
- Despite no tools formally listed, MCP calls work perfectly and return real M365 data

### MCP Event Structure (CRITICAL — Voice Live 2026-01-01-preview)
The Voice Live MCP events are **bare notifications with minimal fields**. The actual rich data comes through `response.output_item.added` and `response.output_item.done` events.

| Event | Fields Available | Fields NOT Available |
|-------|-----------------|---------------------|
| `mcp_list_tools.completed` | `type`, `item_id` | ~~tools~~, ~~server_label~~ |
| `response.mcp_call_arguments.done` | `type`, `item_id`, `arguments` | ~~name~~, ~~call_id~~, ~~server_label~~ |
| `response.mcp_call.completed` | `type`, `item_id`, `output_index` | ~~output~~, ~~call_id~~ |
| `response.output_item.added` (type=mcp_call) | `item.name`, `item.server_label`, `item.id` | — |
| `response.output_item.done` (type=mcp_call) | `item.name`, `item.server_label`, `item.output`, `item.error` | — |

**To get MCP tool names and output, handle `response.output_item.added/done` where `item.type === 'mcp_call'`.**

**Documentation sources for this fix:**
- [Voice Live API Reference (2026-01-01-preview)](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-api-reference-2026-01-01-preview)
- [SDK TypeScript Interface — ServerEventResponseMcpCallArgumentsDone](https://learn.microsoft.com/javascript/api/@azure/ai-voicelive/servereventresponsemcpcallargumentsdone)
- [Realtime Audio MCP Server Support How-To](https://learn.microsoft.com/azure/foundry/openai/how-to/realtime-audio#mcp-server-support)

### Tool Strategy — M365 Copilot vs Deterministic MCP Tools

**For QUERIES** (what meetings do I have, show emails, etc.) — route through `mcp_M365Copilot` (`copilot_chat` tool) which returns clean, summarized natural language responses.

**For ACTIONS** (CreateEvent, ReplyToMessage, UpdateEvent, etc.) — use the specific calendar/mail MCP tools directly.

**Reason:** `ListCalendarView` returns extremely verbose JSON (~24K+ tokens with `backingStore`, `additionalData` noise) that causes `server_error` or hallucinated summaries. M365 Copilot processes the same data server-side and returns clean summaries. This strategy is enforced via the system prompt (`ARIA_SYSTEM_PROMPT_WITH_TOOLS`).

### Verified MCP Tools (all confirmed working 2026-03-27)
| Server | Tool Name | Type | Notes |
|--------|-----------|------|-------|
| `web-search` | `copilot_chat` | Query | Semantic calendar/email/task queries — preferred for lookups |
| `calendar` | `ListCalendarView` | Query | Raw calendar data — verbose, avoid for user-facing queries |
| `calendar` | `CreateEvent` | Action | Create events with subject, attendees, timeZone |
| `calendar` | `UpdateEvent` | Action | Modify events (change time, add attendees via `attendeesToAdd`) |
| `calendar` | `GetUserDateAndTimeZoneSettings` | Query | Mailbox timezone info |
| `mail` | `SearchMessagesQueryParameters` | Query | Raw email search via Graph OData query |
| `mail` | `SearchMessages` | Query | Semantic email search via Copilot |
| `mail` | `ReplyToMessage` | Action | Send email replies by message ID |
| `me` | `GetMyDetails` | Query | User profile info |

### Connected MCP Servers
| Label | Server ID | Purpose | Status |
|-------|-----------|---------|--------|
| `calendar` | `mcp_CalendarTools` | Calendar events, free/busy, meeting creation | ✅ Verified (CRUD) |
| `mail` | `mcp_MailTools` | Read, search, draft, send emails | ✅ Verified (search + reply) |
| `teams` | `mcp_TeamsServer` | Teams chats, messages, channels | ✅ Wired |
| `me` | `mcp_MeServer` | User profile, organizational info | ✅ Verified |
| `web-search` | `mcp_M365Copilot` | Semantic queries via M365 Copilot | ✅ Verified (primary query tool) |

### OBO Flow (Verified Working)
1. Frontend acquires MSAL access token (with `api://{client_id}/access_as_user` scope)
2. Frontend sends token in WebSocket connection query parameter
3. Backend exchanges token via `ConfidentialClientApplication.acquireTokenOnBehalfOf()`
4. OBO token scoped for `ea9ffc3e-8a23-4a7d-836d-234d7c7565c1/.default` (Agent 365 Tools API)
5. Raw OBO token (no Bearer prefix) injected as `authorization` in MCP tool entries
6. Voice Live adds `Bearer ` prefix and forwards to each MCP server via Streamable HTTP

### Known Issues — MCP / Voice Live (for next session)

**1. `turn_detected` cancels responses during tool calls**
VAD detects noise or user speaking while GPT-5 is trying to respond after a tool call, which cancels the in-progress response. The user has to re-prompt to get the data. Current mitigations (threshold=0.8, silence_duration_ms=1200, interim_response with `tool` trigger) help but don't fully solve the problem. May need to increase VAD threshold further, temporarily disable VAD during tool execution, or find a different approach.

**2. Empty audio transcript after tool completion**
After an MCP tool call completes, GPT-5 sometimes produces an empty audio transcript (`Audio transcript done: `) instead of presenting the results. The user must re-prompt to get the data. This appears related to response ordering between MCP completion and GPT-5 response generation — the model generates audio before the tool output is fully processed.

**3. Interim response during tool calls inconsistent**
The `tool` trigger for `interim_response` is enabled in the session config but doesn't always fire, leading to silence during MCP execution. When it does fire, it provides a brief "Let me check that" bridge, but coverage is unreliable.

---

## 9. Next Steps

1. ~~**Test MCP E2E**~~ — ✅ Verified: calendar queries, email search, email reply, calendar CRUD all working (2026-03-27)
2. **Fix `turn_detected` response cancellation** — VAD cancels GPT-5 responses during/after tool calls, forcing re-prompts. Investigate disabling VAD temporarily during tool execution or alternative approaches.
3. **Fix empty audio transcript after tool completion** — GPT-5 not presenting MCP results; generates empty audio instead. Debug response ordering between MCP completion events and audio generation.
4. **Add audible processing notification** — Play a subtle audio cue during MCP tool execution so users know the system is working (not hung). Currently silent during tool calls.
5. **Fix VQ Artifacts** — Investigate model-level fix or audio post-processing to stop "Audio HBA" being spoken
6. **GPT-5 Agent** — Deploy GPT-5 as Foundry Agent model once supported (user explicitly wants GPT-5, not GPT-4o)
7. **AudioWorklet Migration** — Replace `ScriptProcessorNode` with `AudioWorkletNode`
8. **Production Deploy** — Use Bicep templates in `infra/` to deploy to Azure (App Service + Static Web App)
9. **Avatar Enhancements** — Scene parameters (zoom, position, rotation), background images, avatar presets
10. **Auto-reconnect** — WebRTC disconnects after 5min idle / 30min total; implement reconnection logic
11. **More MCP Servers** — Add Planner, Files/OneDrive, SharePoint Lists
