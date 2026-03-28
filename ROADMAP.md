# Avatar Foundry — Feature Roadmap

> **Last updated:** 2026-03-28
> **Status:** Active Development — Showcase-Ready MVP Complete

---

## Completed (v0.1 — Foundation)

| # | Feature | Status |
|---|---------|--------|
| - | HD Avatar (Meg Casual) via WebRTC + Voice Live | Done |
| - | GPT-5 Realtime voice conversation | Done |
| - | MSAL/Entra ID auth with OBO token exchange | Done |
| - | 6 Work IQ MCP servers (Calendar, Mail, Teams, Me, Copilot, Word) | Done |
| - | Dashboard cards — live MCP result visualization | Done |
| - | Multi-step task orchestration | Done |
| - | Proactive meeting countdown (10-min polling) | Done |
| - | Interim response bridging during tool calls | Done |
| - | Smart follow-up tracking with persistence | Done |
| - | Persistent user memory across sessions | Done |
| - | Foundry Agent delegation for complex research | Done |
| - | AudioWorklet mic capture, barge-in, tool call chime | Done |
| - | VQ token artifact defense (3-layer) | Done |
| - | Custom avatar backgrounds | Done |

---

## Roadmap — 20 Killer Features

### Phase 1 — Conversation & UX Polish (Quick Wins)

#### 1. Text Input Bar
**Impact:** High | **Effort:** Low
Add a text input field below the conversation panel so users can type messages alongside voice. Essential for noisy environments, demos where mic isn't available, and entering precise data like email addresses or meeting titles. Wire into existing `sendTextMessage()` — the hook already supports it.

#### 2. Conversation History Persistence
**Impact:** High | **Effort:** Medium
Persist the full conversation transcript to server-side JSON (like user memory). On reconnect, reload the last session's transcript so users never lose context. Add a "Previous Sessions" dropdown to browse history. Enables continuity across page refreshes and reconnections.

#### 3. Session Recording & Playback
**Impact:** High | **Effort:** Medium
Record voice sessions (audio + transcript + tool actions + timestamps) for later review. Store as structured JSON with audio segments. Add a playback mode that replays the conversation with avatar video synced to timestamps. Perfect for meeting recaps and demo recordings.

#### 4. Conversation Export
**Impact:** Medium | **Effort:** Low
One-click export of the current conversation as:
- **PDF** with branded header, timestamp, and action summary
- **Email** via Mail MCP — send yourself a summary
- **Word document** via Word MCP — `CreateDocument` with formatted transcript
- **Clipboard** — plain text copy

---

### Phase 2 — Proactive Intelligence

#### 5. Morning Briefing Auto-Pilot
**Impact:** Very High | **Effort:** Medium
On session start (or at a scheduled time), Aria automatically delivers a comprehensive briefing: today's calendar, unread priority emails, pending follow-ups, weather, and relevant news. Orchestrates multiple MCP calls in sequence without user prompting. The ultimate "just works" executive assistant moment.

#### 6. Smart Notifications & Alerts
**Impact:** High | **Effort:** Medium
Server-side event monitoring that proactively notifies users:
- New high-priority emails from VIPs
- Meeting starting in 2 minutes (enhance meeting countdown)
- Follow-up items due today
- Calendar conflicts detected
Visual toast notifications + optional voice interruption ("You have a meeting in 2 minutes with Sarah").

#### 7. Context-Aware Time Intelligence
**Impact:** Medium | **Effort:** Low
Inject current date/time, timezone, and day-of-week into every system prompt update. Aria should always know "it's Friday afternoon" without being told. Enables natural time references: "schedule it for tomorrow", "what do I have this afternoon", "remind me Monday morning".

#### 8. Email Triage & Priority Scoring
**Impact:** High | **Effort:** Medium
When user asks about emails, Aria doesn't just list them — she triages:
- **Priority scoring** based on sender importance, keywords, urgency signals
- **Action suggestions**: "This one from your VP needs a reply — want me to draft one?"
- **Batch actions**: "You have 5 newsletters — want me to summarize them all?"
Leverages copilot_chat for semantic analysis + mail tools for actions.

---

### Phase 3 — Rich Visual Experience

#### 9. Live Calendar View Widget
**Impact:** Very High | **Effort:** Medium
A collapsible calendar widget in the side panel showing today's schedule as a visual timeline. Events color-coded by type (meeting, focus time, OOO). Click an event to hear Aria summarize it. Auto-updates when events are created/modified via tools. Makes the dashboard feel like a real executive cockpit.

#### 10. Email Compose & Preview Panel
**Impact:** High | **Effort:** Medium
When Aria drafts an email, show it in a rich preview card in the side panel with To/Subject/Body fields. User can review, edit inline, then confirm to send. Currently emails are composed blind through voice — this adds visual confirmation for high-stakes communications.

#### 11. Avatar Emotion & Mood Indicators
**Impact:** Medium | **Effort:** Low
Visual mood indicator near the avatar showing Aria's current "state":
- Thinking (during tool calls)
- Listening (when VAD active)
- Speaking (during response)
- Working (during multi-step tasks)
Subtle animated icon or color ring around the avatar. Makes the assistant feel alive and responsive.

#### 12. Dark/Light Theme Toggle
**Impact:** Medium | **Effort:** Low
Add a theme toggle in the status bar. Currently hardcoded dark theme — add a light mode with Tailwind `dark:` classes. Persist preference in user memory. Small touch but makes demos feel polished and accessible.

---

### Phase 4 — Enterprise Power Features

#### 13. Planner & Tasks MCP Integration
**Impact:** Very High | **Effort:** Medium
Connect `mcp_PlannerServer` to bring full Microsoft Planner/To Do integration:
- "Create a task for the Q2 report due Friday"
- "What tasks are assigned to me?"
- "Mark the budget review task as complete"
Native task management turns Aria from an assistant into a productivity hub. Scopes already available in Entra ID.

#### 14. Files & OneDrive MCP Integration
**Impact:** High | **Effort:** Medium
Connect `mcp_FilesServer` for OneDrive file access:
- "Find the Q2 budget spreadsheet"
- "Share the project plan with the team"
- "What files were shared with me this week?"
Combined with Word MCP for document creation, this creates a complete document workflow.

#### 15. SharePoint Lists MCP Integration
**Impact:** Medium | **Effort:** Medium
Connect `mcp_SharePointListsServer` for structured data:
- "Show me the project tracker list"
- "Add a new item to the risk register"
- "Update the status of the Alpha project to In Progress"
Powerful for teams that live in SharePoint for project management.

#### 16. Multi-Step Workflow Templates
**Impact:** High | **Effort:** Medium
Pre-built workflow templates that chain multiple MCP calls:
- **New Hire Onboarding**: Create calendar blocks + send welcome email + create Planner tasks + share documents
- **Meeting Prep**: Pull attendee profiles + recent emails from attendees + meeting agenda + relevant documents
- **Weekly Report**: Summarize this week's meetings + action items + email highlights → create Word doc → email to manager
User says "Run the meeting prep workflow for my 2pm" and Aria executes the full chain.

---

### Phase 5 — Technical Excellence

#### 17. WebRTC Auto-Reconnect
**Impact:** Very High | **Effort:** Medium
Automatic reconnection when WebRTC drops (5-min idle timeout, 30-min session limit):
- Detect ICE disconnection or data channel close
- Show "Reconnecting..." overlay with countdown
- Re-establish WebSocket → re-send session config → re-negotiate WebRTC SDP
- Restore conversation context from persisted transcript
Critical for production readiness — currently users must manually restart sessions.

#### 18. Streaming Response Indicators
**Impact:** Medium | **Effort:** Low
Visual typing/streaming indicator in the conversation panel while Aria's response is being generated:
- Animated dots or waveform while audio is streaming
- Show transcript text appearing word-by-word (already have interim transcripts)
- Progress indicator during multi-tool workflows showing "Step 2 of 4..."
Makes the experience feel responsive and transparent.

#### 19. Accessibility & Keyboard Navigation
**Impact:** Medium | **Effort:** Medium
Full accessibility pass:
- ARIA labels on all interactive elements
- Keyboard shortcuts: `Space` to toggle mute, `Esc` to end session, `Enter` to send text
- Screen reader support for transcript and action cards
- High contrast mode
- Reduced motion option (disable avatar, show text-only)
Essential for enterprise customers and inclusive design.

#### 20. Analytics & Session Insights Dashboard
**Impact:** High | **Effort:** High
Admin-facing analytics dashboard showing:
- Session count, duration, and engagement metrics
- Most-used tools and MCP servers
- Tool call success/failure rates
- Response latency percentiles
- User satisfaction signals (conversation length, re-prompts, barge-ins)
- Memory and follow-up utilization
Store anonymized telemetry in Application Insights. Adds "enterprise grade" credibility to the showcase.

---

## Implementation Priority Matrix

```
                    HIGH IMPACT
                        |
     [5] Briefing   [17] Reconnect   [13] Planner
     [9] Calendar   [6] Alerts       [14] Files
                        |
  LOW EFFORT ───────────┼─────────── HIGH EFFORT
                        |
     [1] Text Input [7] Time Intel   [15] SharePoint
     [4] Export     [12] Theme       [19] Accessibility
     [11] Emotion   [18] Streaming   [20] Analytics
                        |
                    LOW IMPACT
```

## Suggested Build Order

| Sprint | Features | Rationale |
|--------|----------|-----------|
| **Sprint 1** (Quick Wins) | 1, 7, 11, 12 | Low-effort, high-polish items that make demos shine |
| **Sprint 2** (Core UX) | 2, 4, 18 | Conversation persistence and export — table stakes |
| **Sprint 3** (Proactive) | 5, 6, 8 | Morning briefing + alerts = the "wow factor" |
| **Sprint 4** (Visual) | 9, 10 | Calendar widget + email preview = executive cockpit |
| **Sprint 5** (Enterprise) | 13, 14, 16 | Planner + Files + workflow templates = productivity hub |
| **Sprint 6** (Production) | 17, 3, 19 | Reconnect + recording + accessibility = production-ready |
| **Sprint 7** (Scale) | 15, 20 | SharePoint + analytics = enterprise-grade platform |

---

## Architecture Notes

All new features should follow existing patterns:
- **Server-side services** in `server/src/services/` with JSON file persistence
- **Function tools** registered in `voiceLive.ts` and handled in `index.ts`
- **Client components** in `client/src/components/` with Tailwind CSS
- **Types** in `client/src/types/index.ts`
- **MCP servers** added to `WORKIQ_MCP_SERVERS` array in `voiceLive.ts`
- **Environment vars** validated via Zod in `server/src/config/env.ts`

---

*Built with Azure AI Foundry, Voice Live API, and Work IQ MCP*
