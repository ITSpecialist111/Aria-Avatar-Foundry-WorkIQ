import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import expressWs from 'express-ws';
import { WebSocket } from 'ws';
import { DefaultAzureCredential } from '@azure/identity';
import { env } from './config/env';
import { buildSessionConfig, buildGreetingEvent, buildResponseCreate } from './services/voiceLive';
import { exchangeTokenOBO } from './services/authService';
import { loadMemories, saveMemory, deleteMemory } from './services/userMemory';
import { createFollowUp, completeFollowUp, getPendingFollowUps } from './services/followUpTracker';
import { startMeetingCountdown, stopMeetingCountdown } from './services/meetingCountdown';
import { delegateToAgent } from './services/foundryDelegate';
import { getWeather } from './services/weather';
import { getCalendarEvents } from './services/calendarService';
import { getRecentEmails } from './services/emailService';
import healthRouter from './routes/health';
import avatarRouter from './routes/avatar';
import sessionRouter from './routes/session';
import tickerRouter from './routes/ticker';
import smokeTestRouter from './routes/smokeTest';

const { app } = expressWs(express());
const credential = new DefaultAzureCredential();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(','), credentials: true }));
app.use(express.json());

// REST routes
app.use('/api', healthRouter);
app.use('/api/avatar', avatarRouter);
app.use('/api/session', sessionRouter);
app.use('/api', tickerRouter);
app.use('/api/smoke-test', smokeTestRouter);

// WebSocket proxy: Client <-> Backend <-> Voice Live API
app.ws('/ws/voice-live', async (clientWs, req) => {
  const token = req.query['token'] as string;
  if (!token) {
    clientWs.close(4001, 'Missing authentication token');
    return;
  }

  console.log('[WS] Client connected, establishing Voice Live connection...');

  // Get Entra ID token for Cognitive Services
  let entraToken: string;
  try {
    const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
    entraToken = tokenResponse.token;
    console.log('[WS] Got Entra ID token');
  } catch (error) {
    console.error('[WS] Failed to get Entra token:', error);
    clientWs.close(4002, 'Failed to authenticate');
    return;
  }

  // Connect to Voice Live API via custom domain
  // Endpoint: wss://<resource>.cognitiveservices.azure.com/voice-live/realtime
  const vlEndpoint = env.VOICELIVE_ENDPOINT.replace(/^https?:\/\//, '');
  const vlUrl = `wss://${vlEndpoint}/voice-live/realtime?api-version=${env.VOICELIVE_API_VERSION}&model=${env.VOICELIVE_MODEL}`;

  console.log(`[WS] Connecting to: wss://${vlEndpoint}/voice-live/realtime (model: ${env.VOICELIVE_MODEL})`);

  const voiceLiveWs = new WebSocket(vlUrl, {
    headers: {
      'Authorization': `Bearer ${entraToken}`,
    },
  });

  let sessionReady = false;
  let greetingSent = false;
  let sessionConfigured = false;
  let oboToken: string | undefined;
  let graphToken: string | undefined;
  let mcpFailCount = 0;
  let mcpToolsSent = 0;

  // Track pending function call arguments (for memory tools)
  const pendingFunctionCalls = new Map<string, { name: string; callId: string }>();
  // Track MCP call start times for latency measurement
  const mcpCallTimers = new Map<string, { name: string; server: string; startTime: number }>();

  // Try OBO exchange if client secret is configured
  if (env.MSAL_CLIENT_SECRET && env.WORKIQ_ENVIRONMENT_ID) {
    try {
      // Exchange user token for Agent 365 MCP-scoped OBO token
      // Scope: Agent 365 Tools API app ID (same as Agent365-Bridge)
      const mcpScope = 'ea9ffc3e-8a23-4a7d-836d-234d7c7565c1/.default';
      console.log('[WS] Trying OBO with scope:', mcpScope);
      const oboStart = performance.now();
      oboToken = await exchangeTokenOBO(token, [mcpScope]);
      const oboMs = Math.round(performance.now() - oboStart);
      console.log(`[WS] OBO token acquired for Agent 365 MCP (${oboMs}ms)`);
    } catch (error) {
      console.warn('[WS] OBO exchange failed — running without MCP tools:', (error as Error).message);
    }

    // Second OBO exchange: Graph API token for direct calendar/mail access
    try {
      const graphStart = performance.now();
      graphToken = await exchangeTokenOBO(token, ['https://graph.microsoft.com/Calendars.Read', 'https://graph.microsoft.com/Mail.Read']);
      const graphMs = Math.round(performance.now() - graphStart);
      console.log(`[WS] Graph API token acquired (${graphMs}ms)`);
    } catch (error) {
      console.warn('[WS] Graph OBO exchange failed — calendar function tool unavailable:', (error as Error).message);
    }
  } else {
    console.log('[WS] No MSAL_CLIENT_SECRET or WORKIQ_ENVIRONMENT_ID — skipping OBO/MCP');
  }

  // Also catch plain-text audio artifacts that GPT-5 leaks in longer sessions
  const audioArtifactRegex = /^(audio text|audio hba|audio)\s*$/i;

  // Forward: Voice Live -> Client
  voiceLiveWs.on('message', async (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      let message = data.toString();

      // Filter VQ tokens and audio artifacts from transcript/text delta events
      try {
        const parsed = JSON.parse(message);
        if (parsed.delta && typeof parsed.delta === 'string') {
          // Strip VQ tokens
          parsed.delta = parsed.delta.replace(/<\|[a-z0-9_]+\|>/gi, '').trim();
          // Drop if empty or audio artifact
          if (!parsed.delta || audioArtifactRegex.test(parsed.delta)) return;
          message = JSON.stringify(parsed);
        }
      } catch { /* binary data — pass through */ }

      // Log all Voice Live events (except high-frequency audio deltas)
      try {
        const event = JSON.parse(message);
        const t = event.type || 'unknown';
        if (!t.includes('audio.delta') && !t.includes('audio_buffer')) {
          const summary = t === 'response.text.delta' ? ` "${event.delta?.substring(0, 60) || ''}"` :
                          t === 'response.audio_transcript.delta' ? ` "${event.delta?.substring(0, 60) || ''}"` :
                          t === 'error' ? ` ${JSON.stringify(event.error)}` :
                          t === 'response.function_call_arguments.delta' ? ` ${event.delta}` :
                          t === 'response.output_item.added' && event.item?.type === 'function_call' ? ` fn=${event.item.name}` :
                          t === 'response.output_item.added' && event.item?.type === 'mcp_call' ? ` MCP: ${event.item.name} (server: ${event.item.server_label})` :
                          t === 'response.output_item.added' && event.item?.type === 'mcp_list_tools' ? ` MCP discovery: ${event.item.server_label}` :
                          t === 'response.output_item.done' && event.item?.type === 'mcp_call' ? ` MCP result: ${event.item.name} status=${event.item.status} output=${(typeof event.item.output === 'string' ? event.item.output : JSON.stringify(event.item.output))?.substring(0, 500)}${event.item.error ? ' ERROR=' + JSON.stringify(event.item.error) : ''}` :
                          t === 'response.output_item.done' && event.item?.type !== 'message' && event.item?.type !== 'mcp_list_tools' ? ` item_type=${event.item?.type} status=${event.item?.status} ${JSON.stringify(event.item || event).substring(0, 500)}` :
                          t === 'mcp_list_tools.completed' ? ` item=${event.item_id}` :
                          t === 'mcp_list_tools.failed' ? ` ${JSON.stringify(event)}` :
                          t === 'response.mcp_call_arguments.done' ? ` item=${event.item_id} args=${event.arguments?.substring(0, 300)}` :
                          t === 'response.mcp_call.completed' ? ` item=${event.item_id}` :
                          t === 'response.mcp_call.failed' ? ` item=${event.item_id} ${JSON.stringify(event)}` :
                          '';
          console.log(`[VL→Client] ${t}${summary}`);
          // Debug: full payload for failed MCP calls and their output_item.done
          if (t === 'response.output_item.done' && event.item?.type === 'mcp_call') {
            console.log('[VL→Client] MCP output_item.done FULL:', JSON.stringify(event).substring(0, 2000));
          }
          if (t === 'response.mcp_call.failed') {
            console.log('[VL→Client] MCP FAILED FULL:', JSON.stringify(event).substring(0, 2000));
          }
        }
      } catch { /* binary */ }

      clientWs.send(message);

      // On session ready, send config and greeting
      try {
        const event = JSON.parse(message);
        if (event.type === 'session.created' && !sessionReady) {
          sessionReady = true;
          const config = buildSessionConfig(oboToken);
          const toolCount = (config.session as Record<string, unknown>).tools
            ? ((config.session as Record<string, unknown>).tools as unknown[]).length
            : 0;
          console.log(`[WS] Session created, sending config... (${toolCount} MCP tools, OBO: ${!!oboToken})`);
          mcpToolsSent = toolCount;
          voiceLiveWs.send(JSON.stringify(config));
        }
        if (event.type === 'session.updated' && !sessionConfigured) {
          sessionConfigured = true;
          console.log('[WS] Session configured');
          if (event.session?.avatar) {
            console.log('[WS] Avatar enabled — waiting for WebRTC handshake before greeting...');
          } else {
            // No avatar — send greeting immediately
            sendGreeting();
          }
        }
        if (event.type === 'session.avatar.connecting') {
          console.log('[WS] Avatar WebRTC: got server SDP — now sending greeting');
          sendGreeting();
        }
        if (event.type === 'error') {
          console.error('[WS] Voice Live error event:', JSON.stringify(event.error));
        }
        // Track MCP tool discovery failures
        if (event.type === 'mcp_list_tools.failed') {
          mcpFailCount++;
          console.warn(`[WS] MCP tool discovery failed (${mcpFailCount}/${mcpToolsSent}):`, JSON.stringify(event));
          // Log but do NOT send a fallback session.update — it causes a duplicate
          // session.updated event which crashes the client (double avatar/mic setup).
          // The tools-aware prompt already handles missing tools gracefully.
          if (mcpFailCount >= mcpToolsSent && mcpToolsSent > 0) {
            console.warn('[WS] All MCP tools failed to discover — Aria will respond conversationally');
          }
        }
        if (event.type === 'mcp_list_tools.completed') {
          // Bare notification — no tools or server_label on this event per API spec
          // Tool details come through conversation.item.created/done with item.type === 'mcp_list_tools'
          console.log('[WS] MCP tool discovery completed for item:', event.item_id);
        }
        // Log MCP call results from output_item.done (this is where the actual output lives)
        if (event.type === 'response.output_item.added' && event.item?.type === 'mcp_call') {
          mcpCallTimers.set(event.item.id, {
            name: event.item.name,
            server: event.item.server_label,
            startTime: performance.now(),
          });
        }
        if (event.type === 'response.output_item.done' && event.item?.type === 'mcp_call') {
          const timer = mcpCallTimers.get(event.item.id);
          const latencyMs = timer ? Math.round(performance.now() - timer.startTime) : -1;
          mcpCallTimers.delete(event.item.id);
          const output = typeof event.item.output === 'string'
            ? event.item.output.substring(0, 1000)
            : JSON.stringify(event.item.output)?.substring(0, 1000);
          console.log(`[WS] MCP RESULT: ${event.item.name} (${event.item.server_label}) → ${latencyMs}ms → ${output?.length || 0} chars`);
          if (latencyMs > 8000) {
            console.warn(`[WS] ⚠ SLOW MCP CALL: ${event.item.name} took ${latencyMs}ms`);
          }
          if (event.item.error) {
            console.error('[WS] MCP ERROR:', JSON.stringify(event.item.error));
          }
        }

        // --- Function call handling (memory tools) ---
        // Track function call start
        if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
          pendingFunctionCalls.set(event.item.id, { name: event.item.name, callId: event.item.call_id });
          console.log(`[WS] Function call started: ${event.item.name} (${event.item.call_id})`);
        }

        // Handle function call arguments done — execute the memory function
        if (event.type === 'response.function_call_arguments.done') {
          const fnCall = pendingFunctionCalls.get(event.item_id);
          if (fnCall) {
            pendingFunctionCalls.delete(event.item_id);
            const args = JSON.parse(event.arguments || '{}');
            let result: string;

            try {
              if (fnCall.name === 'remember_user_preference') {
                const memory = saveMemory(args.category, args.content);
                result = JSON.stringify({ success: true, memory_id: memory.id, message: `Saved: ${args.content}` });
              } else if (fnCall.name === 'recall_user_memories') {
                const memories = loadMemories();
                result = JSON.stringify({ memories });
              } else if (fnCall.name === 'forget_user_memory') {
                const deleted = deleteMemory(args.memory_id);
                result = JSON.stringify({ success: deleted, message: deleted ? 'Memory deleted' : 'Memory not found' });
              } else if (fnCall.name === 'create_follow_up') {
                const followUp = createFollowUp(args.description, args.due_date);
                result = JSON.stringify({ success: true, follow_up_id: followUp.id, message: `Follow-up created: ${args.description}` });
              } else if (fnCall.name === 'list_follow_ups') {
                const followUps = getPendingFollowUps();
                result = JSON.stringify({ follow_ups: followUps });
              } else if (fnCall.name === 'complete_follow_up') {
                const completed = completeFollowUp(args.follow_up_id);
                result = JSON.stringify({ success: completed, message: completed ? 'Follow-up marked as completed' : 'Follow-up not found' });
              } else if (fnCall.name === 'delegate_to_research_agent') {
                console.log(`[WS] Delegating research task: ${args.task?.substring(0, 100)}`);
                const response = await delegateToAgent(args.task, args.context);
                if (response.error) {
                  result = JSON.stringify({ error: response.error });
                } else {
                  result = JSON.stringify({ research_result: response.content });
                }
              } else if (fnCall.name === 'get_weather') {
                console.log(`[WS] Fetching weather for: ${args.city || 'London (default)'}`);
                const weather = await getWeather(args.city);
                result = JSON.stringify(weather);
              } else if (fnCall.name === 'get_calendar_events') {
                if (!graphToken) {
                  result = JSON.stringify({ error: 'Graph API token not available. Use the copilot MCP tool to check calendar instead.' });
                } else {
                  console.log(`[WS] Fetching calendar events: ${args.start_date || 'now'} to ${args.end_date || '+7d'}`);
                  const calStart = performance.now();
                  const events = await getCalendarEvents(graphToken, args.start_date, args.end_date, args.max_results);
                  const calMs = Math.round(performance.now() - calStart);
                  console.log(`[WS] Calendar: ${events.count} events in ${calMs}ms`);
                  result = JSON.stringify(events);
                }
              } else if (fnCall.name === 'get_recent_emails') {
                if (!graphToken) {
                  result = JSON.stringify({ error: 'Graph API token not available. Use the copilot MCP tool to check emails instead.' });
                } else {
                  console.log(`[WS] Fetching emails: count=${args.count || 10} filter=${args.filter || 'none'} search=${args.search || 'none'}`);
                  const emailStart = performance.now();
                  const emails = await getRecentEmails(graphToken, args.count, args.filter, args.search);
                  const emailMs = Math.round(performance.now() - emailStart);
                  console.log(`[WS] Email: ${emails.count} emails in ${emailMs}ms`);
                  result = JSON.stringify(emails);
                }
              } else {
                result = JSON.stringify({ error: 'Unknown function' });
              }
            } catch (fnError) {
              result = JSON.stringify({ error: (fnError as Error).message });
            }

            // Send function output back to Voice Live
            voiceLiveWs.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: fnCall.callId,
                output: result,
              },
            }));

            // Trigger response generation
            setTimeout(() => {
              voiceLiveWs.send(JSON.stringify({ type: 'response.create' }));
            }, 300);

            console.log(`[WS] Function ${fnCall.name} result: ${result.substring(0, 200)}`);
          }
        }
      } catch { /* ignore parse errors for binary data */ }
    }
  });

  function sendGreeting() {
    if (greetingSent) return;
    greetingSent = true;
    voiceLiveWs.send(JSON.stringify(buildGreetingEvent()));
    voiceLiveWs.send(JSON.stringify(buildResponseCreate()));
    console.log('[WS] Greeting sent');

    // Start meeting countdown monitoring
    startMeetingCountdown(voiceLiveWs, graphToken);
  }

  // Fallback: if avatar handshake takes too long, send greeting anyway
  setTimeout(() => {
    if (!greetingSent && voiceLiveWs.readyState === WebSocket.OPEN) {
      console.log('[WS] Avatar handshake timeout — sending greeting without avatar');
      sendGreeting();
    }
  }, 10000);

  // Forward: Client -> Voice Live (ensure text frames, not binary)
  clientWs.on('message', (data) => {
    if (voiceLiveWs.readyState === WebSocket.OPEN) {
      const message = data.toString('utf-8');
      // Log non-audio client messages
      try {
        const msg = JSON.parse(message);
        if (msg.type?.startsWith('session.avatar')) {
          console.log(`[Client→VL] ${msg.type} (SDP length: ${msg.client_sdp?.length || 0})`);
        } else if (!msg.type?.includes('audio_buffer')) {
          console.log(`[Client→VL] ${msg.type || 'unknown'}`);
        }
      } catch { /* binary data */ }
      voiceLiveWs.send(message);
    } else {
      console.log(`[WS] Cannot forward client message — VL state: ${voiceLiveWs.readyState}`);
    }
  });

  // Handle disconnections
  clientWs.on('close', () => {
    console.log('[WS] Client disconnected');
    stopMeetingCountdown(voiceLiveWs);
    if (voiceLiveWs.readyState === WebSocket.OPEN) {
      voiceLiveWs.close();
    }
  });

  voiceLiveWs.on('close', (code, reason) => {
    const reasonStr = reason.toString();
    console.log(`[WS] Voice Live disconnected: ${code} ${reasonStr}`);
    stopMeetingCountdown(voiceLiveWs);
    if (clientWs.readyState === WebSocket.OPEN) {
      const safeCode = (code >= 1000 && code <= 1003) || (code >= 3000 && code <= 4999) ? code : 1000;
      clientWs.close(safeCode, reasonStr.substring(0, 123));
    }
  });

  voiceLiveWs.on('error', (error) => {
    console.error('[WS] Voice Live error:', error.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(4500, 'Voice Live connection error');
    }
  });

  clientWs.on('error', (error) => {
    console.error('[WS] Client error:', error);
    if (voiceLiveWs.readyState === WebSocket.OPEN) {
      voiceLiveWs.close();
    }
  });
});

// Start server
const port = parseInt(env.PORT, 10);
app.listen(port, () => {
  console.log(`[Server] Avatar Foundry backend running on port ${port}`);
  console.log(`[Server] Agent: ${env.AGENT_NAME} | Region: ${env.SPEECH_REGION} | Avatar: ${env.AVATAR_CHARACTER}-${env.AVATAR_STYLE}`);
});
