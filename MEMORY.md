# Avatar Foundry Project

## Project Overview
- **Repo:** `c:\Users\graham\Documents\GitHub\Avatar-Foundry`
- **Public GitHub:** https://github.com/ITSpecialist111/Aria-Avatar-Foundry-WorkIQ.git
- **Purpose:** Bleeding-edge showcase of autonomous AI Executive Assistant with HD avatar + voice
- **Stack:** React+TS frontend, Node.js+TS backend, Azure Static Web Apps + App Service

## Key Azure Resources
- **Agent365-Claude-Bridge App Reg:** Client ID `9b00c7ab-2ec3-463f-9a30-0dbfbb3800af`, Tenant `e4ccbd32-1a13-4cb6-8fda-c392e7ea359f`
- **Voice Live API version:** `2026-01-01-preview`
- **Avatar:** Meg Casual (29 gestures, full-body, 4K, real-time+Voice Live support)
- **Voice:** `en-US-Ava:DragonHDLatestNeural`
- **Agent:** "Aria" — inline mode + MCP tools (no Foundry Agent — GPT-5 not supported as agent model)
- **LLM:** GPT-5 Realtime (`gpt-realtime-1.5`) for voice; `gpt-4o` deployed as Foundry Agent fallback
- **Foundry Project Endpoint:** `https://ai-avatar-foundry-ghosking.services.ai.azure.com/api/projects/avatar-foundry`
- **Azure Subscription:** `260948a4-1d5e-42c8-b095-33a6641ad189`
- **Work IQ Environment ID:** `ee0acf2a-d6f4-e4ac-90f9-92f259678f17`

## Work IQ MCP Servers — VERIFIED WORKING (2026-03-27)
- Calendar (`mcp_CalendarTools`), Mail (`mcp_MailTools`), Teams (`mcp_TeamsServer`), Me (`mcp_MeServer`), Web Search (`mcp_M365Copilot`)
- MCP URL pattern: `https://agent365.svc.cloud.microsoft/agents/tenants/{tenant_id}/servers/{server_id}/` (trailing slash required)
- Auth: OBO token exchange via `@azure/msal-node` ConfidentialClientApplication
- OBO scope: `ea9ffc3e-8a23-4a7d-836d-234d7c7565c1/.default` (Agent 365 Tools API app ID)
- **IMPORTANT**: `authorization` field in Voice Live MCP config must be RAW token (no `Bearer ` prefix) — Voice Live adds it automatically
- Voice Live MCP tool config supports `headers` field for custom headers (`x-ms-agentid`, `User-Agent`)
- Verified tools: `copilot_chat` (semantic queries), `CreateEvent`, `UpdateEvent`, `ReplyToMessage`, `SearchMessagesQueryParameters`, `GetMyDetails`, `GetUserDateAndTimeZoneSettings`, `ListCalendarView` (verbose — avoid for queries), `SearchMessages`
- **Tool routing strategy**: Use copilot_chat (web-search MCP) for all QUERIES (calendar, email lookups). Use deterministic tools (calendar, mail) for ACTIONS (create/update/reply). ListCalendarView JSON is ~24K tokens with noise, causes server_error and hallucinations.
- Planned: Planner, Files/OneDrive, SharePoint Lists

## Voice Live MCP Event Structure — CRITICAL
The Voice Live API `2026-01-01-preview` MCP events are BARE NOTIFICATIONS with minimal fields.
The actual rich data (tool name, server_label, output) comes through `response.output_item.added/done` events.

**Wrong (what we assumed):**
- `mcp_list_tools.completed` → has `tools` array — WRONG, only has `type` + `item_id`
- `response.mcp_call_arguments.done` → has `name`, `call_id` — WRONG, only has `item_id` + `arguments`
- `response.mcp_call.completed` → has `output` — WRONG, only has `item_id` + `output_index`

**Correct (per API reference):**
- `response.output_item.added` with `item.type === 'mcp_call'` → has `item.name`, `item.server_label`, `item.id`
- `response.output_item.done` with `item.type === 'mcp_call'` → has `item.name`, `item.server_label`, `item.output`, `item.error`
- `response.output_item.added` with `item.type === 'mcp_list_tools'` → has `item.server_label`
- API ref: https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-api-reference-2026-01-01-preview
- SDK TypeScript interface: https://learn.microsoft.com/javascript/api/@azure/ai-voicelive/servereventresponsemcpcallargumentsdone
- MCP how-to: https://learn.microsoft.com/azure/foundry/openai/how-to/realtime-audio#mcp-server-support
- Older API ref (2025-10-01): https://learn.microsoft.com/azure/ai-services/speech-service/voice-live-api-reference-2025-10-01

## Key Technical Notes
- Voice Live requires Entra ID auth (no API keys for agent mode)
- Gestures are batch-only; real-time has natural idle animations
- Agent metadata has 512-char limit per key; Voice Live config uses chunking
- WebRTC for avatar video+audio output, WebSocket for mic audio input
- Interim responses (TOOL + LATENCY triggers) bridge wait times during tool calls
- Auto-reconnect needed: WebRTC disconnects after 5min idle / 30min total

## Fixes Applied This Session
- **MSAL login race condition**: `handleRedirectPromise()` must be awaited before `root.render()` in `main.tsx`
- **Login scopes**: Use `openid, profile, offline_access` for login; `api://{clientId}/access_as_user` only for OBO
- **Mute breaking VAD**: Send zeroed PCM16 (silence) when muted, not nothing
- **VAD too sensitive**: threshold=0.8, prefix_padding_ms=500, silence_duration_ms=1200
- **System prompt causing hangs**: Dual prompts — no-tools (inline) vs tools-aware (MCP mode)
- **Echo cancellation**: Re-enabled `server_echo_cancellation` — works with WebRTC avatar audio
- **MCP URL requires tenant ID**: Must be `/agents/tenants/{tenantId}/servers/{serverId}/` (with trailing slash). Without tenant ID returns 400.
- **MCP session crash**: Removed fallback session.update that caused duplicate session.updated → double WebRTC/mic init
- **VQ token artifacts**: 3-layer defense — system prompt ("NEVER output audio text"), server-side filter (stateless regex + audioArtifactRegex), client-side transcript filter. Fixed stateful `g` flag bug with `.test()`.
- **OBO scope simplified**: Use `ea9ffc3e-.../.default` directly (no per-server scope fallback chain)
- **MCP event handling was wrong**: `mcp_call.completed` has NO `output` field. `mcp_call_arguments.done` has NO `name` field. Real data comes on `response.output_item.added/done` where `item.type === 'mcp_call'`. This was the 3-hour breakthrough fix.
- **M365 Copilot for queries, deterministic tools for actions**: ListCalendarView JSON is too verbose (24K+ tokens, causes server_error). Route all lookup questions through `mcp_M365Copilot` (copilot_chat) which returns clean summaries. Reserve calendar/mail MCP tools for write operations (CreateEvent, ReplyToMessage).
- **interim_response with tool trigger**: Enables brief "Let me check that" during MCP calls. Without it, users re-prompt during the wait, triggering `turn_detected` which cancels the pending response.
- **turn_detected cancelling responses**: Auto-retry logic — when `response.done` cancelled by `turn_detected` while `mcpCallPendingRef` is true, auto-send `response.create` (max 3 retries). Only clear flag on `message` type completion, not `mcp_call`.
- **interim_response latency was too low**: Was 100ms causing hallucinated "connection issue" responses. Changed to tool trigger with 5000ms threshold.
- **ScriptProcessorNode → AudioWorkletNode**: Migrated mic capture to AudioWorklet (`mic-processor.js`) running on dedicated audio thread. Mute via MessagePort. Eliminates deprecation warning.
- **Audio cue on tool call**: Two-tone chime (880Hz→1100Hz, 200ms) plays when MCP call starts via `playToolCallTone()`.
- **Avatar background image**: `AVATAR_BACKGROUND_URL` env var renders background INTO the video stream (Azure server-side). Removed CSS background to prevent double-frame effect. Video set to `object-cover`.
- **MCP call no auto-response**: GPT-5 Realtime doesn't auto-generate a follow-up after MCP output. Fix: send `response.create` 300ms after `response.output_item.done` for `mcp_call` type.

## Known Issues (TODO)
- WebRTC timeout: auto-reconnect after 5min idle / 30min total
- VQ token audio artifacts: mitigated but still model-level (GPT-5 occasionally leaks tokens before system prompt takes effect)
- Avatar gestures: batch synthesis only, not available in real-time/Voice Live mode

## Voice Live Avatar WebRTC - Critical Implementation Details
- SDP must be base64-encoded JSON: `btoa(JSON.stringify(pc.localDescription))`
- Server SDP response is also base64 JSON: `JSON.parse(atob(server_sdp))`
- Both video and audio transceivers must be `sendrecv` (not recvonly)
- Must create a data channel: `pc.createDataChannel('eventChannel')`
- Official sample: https://github.com/azure-ai-foundry/voicelive-samples/tree/main/javascript/voice-live-avatar

## SDK Packages
- Frontend: `@azure/msal-react` v5, `@azure/msal-browser`, WebRTC APIs
- Backend: `@azure/msal-node`, `@azure/identity`, Express, ws
- Voice Live connects via raw WebSocket (not SDK — uses direct WSS connection)

## Related Docs
- See HANDOVER.md for comprehensive technical documentation (sections 1-9)
- See README.md for setup, architecture diagram, env vars, modes
