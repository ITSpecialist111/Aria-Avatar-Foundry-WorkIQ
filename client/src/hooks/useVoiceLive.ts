import { useState, useRef, useCallback, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import type { SessionState, TranscriptEntry, AgentAction, AvatarConfig, VoiceConfig, DashboardCard, DashboardCardType } from '../types';

export interface WorkflowStep {
  toolName: string;
  serverLabel: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
}

interface UseVoiceLiveOptions {
  avatarConfig: AvatarConfig;
  voiceConfig: VoiceConfig;
}

interface UseVoiceLiveReturn {
  sessionState: SessionState;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  transcript: TranscriptEntry[];
  actions: AgentAction[];
  dashboardCards: DashboardCard[];
  workflowSteps: WorkflowStep[];
  toggleSession: () => void;
  toggleMute: () => void;
  sendTextMessage: (text: string) => void;
  confirmAction: (actionId: string) => void;
  rejectAction: (actionId: string) => void;
  runSmokeTest: () => Promise<unknown>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useVoiceLive(_options: UseVoiceLiveOptions): UseVoiceLiveReturn {
  const { instance } = useMsal();
  const [sessionState, setSessionState] = useState<SessionState>('disconnected');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [dashboardCards, setDashboardCards] = useState<DashboardCard[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const isMutedRef = useRef(false);
  // Track pending MCP tool responses to auto-retry on turn_detected cancellation
  const mcpCallPendingRef = useRef(false);
  // Track MCP call start times for client-side latency measurement
  const mcpCallTimersRef = useRef<Map<string, { name: string; server: string; startTime: number }>>(new Map());
  const autoRetryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 3;
  // Track response boundaries for workflow step accumulation
  const currentResponseIdRef = useRef<string | null>(null);
  // Track whether current response produced non-empty audio (for duplicate MCP call detection)
  const currentResponseHasAudioRef = useRef(false);

  // Audio playback state
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const gainNodeRef = useRef<GainNode | null>(null);

  /** Initialize audio playback context with a gain node for instant muting */
  const initPlayback = useCallback(() => {
    if (!playbackContextRef.current) {
      const ctx = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = ctx;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
    }
    return playbackContextRef.current;
  }, []);

  /** Schedule a PCM16 audio chunk for playback */
  const playAudioChunk = useCallback((pcm16Data: Int16Array) => {
    const ctx = initPlayback();
    const floatData = new Float32Array(pcm16Data.length);
    for (let i = 0; i < pcm16Data.length; i++) {
      floatData[i] = pcm16Data[i]! / (pcm16Data[i]! < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = ctx.createBuffer(1, floatData.length, 24000);
    buffer.copyToChannel(floatData, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodeRef.current || ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, [initPlayback]);

  /** Stop audio playback immediately by disconnecting the gain node */
  const stopPlayback = useCallback(() => {
    nextPlayTimeRef.current = 0;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    // Kill all scheduled audio by replacing the gain node
    if (gainNodeRef.current && playbackContextRef.current) {
      gainNodeRef.current.disconnect();
      const newGain = playbackContextRef.current.createGain();
      newGain.connect(playbackContextRef.current.destination);
      gainNodeRef.current = newGain;
    }
  }, []);

  /** Play a short notification tone when a tool call starts */
  const playToolCallTone = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);       // A5
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.08); // ~C#6

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);

      oscillator.onended = () => ctx.close();
    } catch (_e) {
      // Audio not available — ignore
    }
  }, []);

  /** Start the WebRTC avatar via Voice Live's built-in avatar support */
  const startAvatarViaVoiceLive = useCallback(async (iceServers?: Array<{urls: string[]; username: string; credential: string}>) => {
    try {
      let iceConfig: RTCIceServer[];
      if (iceServers && iceServers.length > 0) {
        iceConfig = iceServers;
      } else {
        // Fallback: fetch ICE from our backend
        const iceResponse = await fetch('/api/avatar/ice');
        if (!iceResponse.ok) {
          console.warn('[Avatar] ICE token fetch failed, running without avatar');
          return;
        }
        const iceData = await iceResponse.json();
        iceConfig = [{
          urls: iceData.Urls || iceData.urls,
          username: iceData.Username || iceData.username,
          credential: iceData.Password || iceData.credential,
        }];
      }

      const pc = new RTCPeerConnection({ iceServers: iceConfig });
      peerConnectionRef.current = pc;

      // When remote tracks arrive, attach to video/audio elements
      pc.ontrack = (event) => {
        if (event.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = event.streams[0] ?? null;
          // Unmute the video element so avatar audio plays through it
          // This works because the user already clicked "Start Conversation" (user gesture)
          videoRef.current.muted = false;
          console.log('[Avatar] Video track received, unmuted for audio');
        }
        if (event.track.kind === 'audio') {
          if (videoRef.current) {
            // Attach audio to the same video element's stream if not already there
            // Some browsers send audio as a separate track
            const existingStream = videoRef.current.srcObject as MediaStream | null;
            if (existingStream && !existingStream.getAudioTracks().length) {
              existingStream.addTrack(event.track);
              console.log('[Avatar] Audio track added to video element stream');
            } else if (!existingStream) {
              videoRef.current.srcObject = event.streams[0] ?? null;
              videoRef.current.muted = false;
              console.log('[Avatar] Audio track received (no video yet)');
            } else {
              console.log('[Avatar] Audio track received (video stream already has audio)');
            }
          }
          // Set on dedicated audio element (primary path in accessible mode, fallback in standard mode)
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0] ?? null;
            console.log('[Avatar] Audio track attached to audio element');
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Avatar] ICE connection state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('[Avatar] Connection state:', pc.connectionState);
      };

      // Create data channel (required by Voice Live avatar service)
      pc.createDataChannel('eventChannel');

      // Add transceivers — sendrecv for both audio and video (required by Voice Live)
      // Mic audio is NOT sent via WebRTC — it goes via WebSocket (input_audio_buffer.append)
      // WebRTC is only for receiving avatar video + audio output
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE candidates to be gathered (2s, matching official sample)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const localDesc = pc.localDescription;
      if (localDesc && wsRef.current?.readyState === WebSocket.OPEN) {
        // Voice Live expects base64-encoded JSON of the RTCSessionDescription
        const clientSdp = btoa(JSON.stringify(localDesc));
        wsRef.current.send(JSON.stringify({
          type: 'session.avatar.connect',
          client_sdp: clientSdp,
        }));
        console.log(`[Avatar] Sent client SDP to Voice Live (base64-encoded, ${clientSdp.length} chars)`);
      }
    } catch (error) {
      console.warn('[Avatar] Failed to start avatar:', error);
    }
  }, []);

  /** Stop the avatar WebRTC connection */
  const stopAvatar = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const addTranscript = useCallback((entry: Omit<TranscriptEntry, 'id' | 'timestamp'>) => {
    setTranscript(prev => [...prev, {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }]);
  }, []);

  const startMicCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      // Load AudioWorklet processor (runs on dedicated audio thread)
      await audioContext.audioWorklet.addModule('/mic-processor.js');

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'mic-processor');
      processorRef.current = workletNode;

      // Receive PCM16 data from the worklet thread
      workletNode.port.onmessage = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && event.data.pcm16) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(event.data.pcm16.buffer)));
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64,
          }));
        }
      };

      source.connect(workletNode);
      // AudioWorklet doesn't need to connect to destination for capture-only
      setIsListening(true);
    } catch (error) {
      console.error('[Mic] Failed to start capture:', error);
    }
  }, []);

  const stopMicCapture = useCallback(() => {
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current = null;
    processorRef.current = null;
    setIsListening(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      isMutedRef.current = newMuted;
      // Tell the AudioWorklet to send silence when muted
      processorRef.current?.port.postMessage({ type: 'mute', muted: newMuted });
      console.log(`[Mic] ${newMuted ? 'Muted' : 'Unmuted'}`);
      return newMuted;
    });
  }, []);

  /** Parse MCP tool output into dashboard cards */
  const parseMcpOutputToCards = useCallback((toolName: string, serverLabel: string, output: string): DashboardCard[] => {
    const nameLower = (toolName || '').toLowerCase();
    const labelLower = (serverLabel || '').toLowerCase();

    // Determine card type from tool name or server label
    let cardType: DashboardCardType = 'info';
    if (labelLower.includes('calendar') || nameLower.includes('calendar') || nameLower.includes('event')) {
      cardType = 'calendar';
    } else if (labelLower.includes('mail') || nameLower.includes('mail') || nameLower.includes('email') || nameLower.includes('message')) {
      cardType = 'email';
    } else if (nameLower.includes('task') || nameLower.includes('planner')) {
      cardType = 'task';
    } else if (labelLower.includes('copilot')) {
      cardType = 'info';
    }

    // Determine if this is an action (write operation)
    const isAction = /^(create|update|reply|send|delete)/i.test(toolName);

    // Build title based on tool name
    let title = toolName || 'Tool Result';
    if (isAction) {
      const actionTitles: Record<string, string> = {
        createevent: 'Event Created',
        updateevent: 'Event Updated',
        sendmail: 'Email Sent',
        replytomessage: 'Reply Sent',
        searchmessages: 'Email Results',
        createdocument: 'Document Created',
        listcalendarview: 'Calendar Events',
      };
      title = actionTitles[nameLower] || `${toolName} Completed`;
    } else {
      const queryTitles: Record<string, string> = {
        searchmessages: 'Email Results',
        searchmessagesqueryparameters: 'Email Search',
        listcalendarview: 'Calendar Events',
        getmydetails: 'User Details',
        getuserdateandtimezonesettings: 'Timezone Info',
        copilot_chat: 'Copilot Response',
      };
      title = queryTitles[nameLower] || title;
    }

    // Content: truncate to 200 chars
    const content = output.length > 200 ? output.substring(0, 200) + '...' : output;

    const cards: DashboardCard[] = [];

    // Primary card
    cards.push({
      id: crypto.randomUUID(),
      type: isAction ? 'action' : cardType,
      title,
      content,
      timestamp: Date.now(),
      toolName,
    });

    return cards;
  }, []);

  const handleVoiceLiveMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string);

      switch (data.type) {
        case 'session.created':
          console.log('[VL] Session created');
          setSessionState('connected');
          break;

        case 'session.updated':
          console.log('[VL] Session updated');
          setSessionState('active');
          // Only start avatar/mic on the FIRST session.updated (not on fallback updates)
          if (data.session?.avatar && !peerConnectionRef.current) {
            console.log('[VL] Avatar mode — starting WebRTC for video + WebSocket mic for audio');
            startAvatarViaVoiceLive(data.session.avatar.ice_servers);
          }
          // Only start mic capture once
          if (!audioContextRef.current) {
            startMicCapture();
          }
          break;

        case 'session.avatar.connecting':
          // Voice Live responded with a base64-encoded JSON SDP — decode and complete WebRTC handshake
          if (data.server_sdp && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            try {
              const serverSdpJson = atob(data.server_sdp);
              const serverSdpObj = JSON.parse(serverSdpJson) as RTCSessionDescriptionInit;
              pc.setRemoteDescription(serverSdpObj).then(() => {
                console.log('[Avatar] WebRTC connection established via Voice Live');
              }).catch((err) => {
                console.warn('[Avatar] Failed to set remote SDP:', err);
              });
            } catch (err) {
              console.warn('[Avatar] Failed to decode server SDP:', err);
            }
          }
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (data.transcript && !data.transcript.includes('<|')) {
            addTranscript({ role: 'user', content: data.transcript });
          }
          break;

        case 'response.created':
          // Track response boundary for workflow step accumulation
          currentResponseIdRef.current = data.response?.id || null;
          currentResponseHasAudioRef.current = false;
          break;

        case 'response.audio_transcript.done': {
          // Strip VQ token artifacts and audio modality leaks from transcript
          const rawTranscript = data.transcript || '';
          const cleanTranscript = rawTranscript
            .replace(/<\|[a-z0-9_]+\|>/gi, '')
            .replace(/\baudio\s*(text|hba)\b/gi, '')
            .trim();
          console.log('[VL] Audio transcript done:', cleanTranscript?.substring(0, 80));
          if (cleanTranscript && !cleanTranscript.startsWith('{') && !/^\s*audio\s*$/i.test(cleanTranscript)) {
            addTranscript({ role: 'assistant', content: cleanTranscript });
            currentResponseHasAudioRef.current = true;
          }
          break;
        }

        case 'response.audio.delta':
          setIsSpeaking(true);
          // Response audio is flowing — tool result response delivered successfully
          if (mcpCallPendingRef.current) {
            mcpCallPendingRef.current = false;
            autoRetryCountRef.current = 0;
          }
          // Decode base64 PCM16 audio and play it
          if (data.delta) {
            try {
              const binaryString = atob(data.delta);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              playAudioChunk(pcm16);
            } catch (err) {
              console.error('[Audio] Failed to decode audio delta:', err);
            }
          }
          break;

        case 'response.audio.done':
          setIsSpeaking(false);
          break;

        case 'input_audio_buffer.speech_started':
          setIsListening(true);
          setIsSpeaking(false);
          // Stop any Aria playback when user starts speaking (barge-in)
          stopPlayback();
          break;

        case 'input_audio_buffer.speech_stopped':
          setIsListening(false);
          break;

        case 'response.function_call_arguments.done': {
          const action: Omit<AgentAction, 'id' | 'timestamp'> = {
            type: inferActionType(data.name),
            status: 'executing',
            summary: `Calling: ${data.name}`,
            requiresConfirmation: false,
          };
          setActions(prev => [...prev, {
            ...action,
            id: data.call_id || crypto.randomUUID(),
            timestamp: new Date(),
          }]);
          break;
        }

        // MCP tool events
        case 'mcp_list_tools.completed':
          // Bare notification — no tools array on this event (per API spec)
          console.log('[VL] MCP tool discovery completed for item:', data.item_id);
          break;

        case 'mcp_list_tools.failed':
          console.error('[VL] MCP tool discovery failed:', JSON.stringify(data));
          break;

        // MCP call arguments streaming (bare events — name/server_label come from output_item events)
        case 'response.mcp_call_arguments.done': {
          console.log('[VL] MCP call args done — item:', data.item_id, 'args:', data.arguments?.substring(0, 300));
          break;
        }

        // MCP call lifecycle (bare notifications — output comes from output_item.done)
        case 'response.mcp_call.completed':
          console.log('[VL] MCP call completed — item:', data.item_id);
          break;

        case 'response.mcp_call.in_progress':
          console.log('[VL] MCP call in progress — item:', data.item_id);
          break;

        case 'response.mcp_call.failed':
          console.error('[VL] MCP call failed — item:', data.item_id, JSON.stringify(data));
          break;

        // The REAL MCP data comes through output_item events
        case 'response.output_item.added': {
          const addedItem = data.item;
          if (addedItem?.type === 'mcp_call') {
            console.log('[VL] MCP call started:', addedItem.name, '| server:', addedItem.server_label, '| id:', addedItem.id);
            mcpCallTimersRef.current.set(addedItem.id, {
              name: addedItem.name,
              server: addedItem.server_label,
              startTime: performance.now(),
            });
            playToolCallTone();
            const mcpAction: Omit<AgentAction, 'id' | 'timestamp'> = {
              type: inferActionType(addedItem.name || ''),
              status: 'executing',
              summary: `${addedItem.server_label || 'MCP'}: ${addedItem.name || 'calling...'}`,
              requiresConfirmation: false,
            };
            setActions(prev => [...prev, {
              ...mcpAction,
              id: addedItem.id || crypto.randomUUID(),
              timestamp: new Date(),
            }]);
            // Track workflow step
            setWorkflowSteps(prev => [...prev, {
              toolName: addedItem.name,
              serverLabel: addedItem.server_label,
              status: 'running',
              startTime: Date.now(),
            }]);
          } else if (addedItem?.type === 'mcp_list_tools') {
            console.log('[VL] MCP tool discovery started for server:', addedItem.server_label);
          }
          break;
        }

        case 'response.output_item.done': {
          const doneItem = data.item;
          if (doneItem?.type === 'mcp_call') {
            const timer = mcpCallTimersRef.current.get(doneItem.id);
            const latencyMs = timer ? Math.round(performance.now() - timer.startTime) : -1;
            mcpCallTimersRef.current.delete(doneItem.id);
            const outputPreview = typeof doneItem.output === 'string'
              ? doneItem.output.substring(0, 500)
              : JSON.stringify(doneItem.output)?.substring(0, 500);
            console.log(`[VL] MCP call done: ${doneItem.name} | server: ${doneItem.server_label} | ${latencyMs}ms`);
            console.log('[VL] MCP output:', outputPreview);
            if (latencyMs > 8000) {
              console.warn(`[VL] ⚠ SLOW MCP CALL: ${doneItem.name} took ${latencyMs}ms`);
            }
            if (doneItem.error) {
              console.error('[VL] MCP error:', JSON.stringify(doneItem.error));
            }
            setActions(prev => prev.map(a =>
              a.id === doneItem.id
                ? { ...a, status: (doneItem.error ? 'failed' : 'completed') as 'failed' | 'completed' }
                : a
            ));
            // Update workflow step status
            setWorkflowSteps(prev => prev.map(step =>
              step.toolName === doneItem.name && step.status === 'running'
                ? { ...step, status: doneItem.error ? 'failed' : 'completed', endTime: Date.now() }
                : step
            ));
            // Flag that we're waiting for GPT-5 to present tool results
            mcpCallPendingRef.current = true;
            autoRetryCountRef.current = 0;
            // GPT-5 Realtime doesn't auto-generate a follow-up response after MCP output —
            // explicitly trigger response.create so Aria presents the findings
            setTimeout(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                console.log('[VL] Triggering response.create after MCP call output');
                wsRef.current.send(JSON.stringify({ type: 'response.create' }));
              }
            }, 300);
            // Generate dashboard cards from MCP output
            const newCards = parseMcpOutputToCards(doneItem.name, doneItem.server_label, doneItem.output || '');
            if (newCards.length > 0) {
              setDashboardCards(prev => [...newCards, ...prev].slice(0, 10));
            }
          }
          break;
        }

        case 'response.done': {
          // Generate a workflow summary card if multi-step (2+ tool calls)
          if (workflowSteps.length >= 2) {
            const workflowCard: DashboardCard = {
              id: crypto.randomUUID(),
              type: 'task',
              title: 'Workflow Completed',
              content: `${workflowSteps.filter(s => s.status === 'completed').length}/${workflowSteps.length} steps completed`,
              items: workflowSteps.map((step, i) => ({
                label: `Step ${i + 1}`,
                value: `${step.toolName} — ${step.status === 'completed' ? 'Done' : step.status === 'failed' ? 'Failed' : 'Running'}`,
              })),
              timestamp: Date.now(),
            };
            setDashboardCards(prev => [workflowCard, ...prev].slice(0, 10));
          }
          setWorkflowSteps([]);

          const respStatus = data.response?.status;
          const respOutputs = data.response?.output || [];
          const hasMessage = respOutputs.some((o: { type: string }) => o.type === 'message');
          const hasMcpCall = respOutputs.some((o: { type: string }) => o.type === 'mcp_call');
          console.log('[VL] Response done:', respStatus, 'outputs:', respOutputs.map((o: { type: string }) => o.type).join(','));

          if (respStatus === 'cancelled' &&
              data.response?.status_details?.reason === 'turn_detected' &&
              mcpCallPendingRef.current &&
              autoRetryCountRef.current < MAX_AUTO_RETRIES) {
            // VAD cancelled the response after a tool call — auto-retry
            autoRetryCountRef.current++;
            console.log(`[VL] turn_detected cancelled tool response — auto-retry ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES}`);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'response.create' }));
            }
          } else if (respStatus === 'completed' && hasMessage) {
            // Only clear MCP pending if we actually got a non-empty spoken response
            if (currentResponseHasAudioRef.current || !mcpCallPendingRef.current) {
              mcpCallPendingRef.current = false;
              autoRetryCountRef.current = 0;
            } else {
              console.log('[VL] Empty message response after MCP call — keeping mcpCallPending (GPT-5 may auto-retry)');
            }
          } else if (respStatus === 'completed' && hasMcpCall) {
            // MCP call response completed — keep mcpCallPendingRef, waiting for follow-up message
            console.log('[VL] MCP call response completed — awaiting follow-up message');
          } else if (respStatus === 'failed') {
            const errorCode = data.response?.status_details?.error?.code;
            const hasOnlyMessage = respOutputs.every((o: { type: string }) => o.type === 'message');
            console.error('[VL] Response FAILED — full event:', JSON.stringify(data.response).substring(0, 2000));

            // Auto-retry VQ token glitches (failed message with no MCP calls) — safe to retry
            if (errorCode === 'server_error' && hasOnlyMessage && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
              autoRetryCountRef.current++;
              console.log(`[VL] VQ token / message glitch — auto-retry ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES}`);
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'response.create' }));
                }
              }, 500);
            } else {
              mcpCallPendingRef.current = false;
              autoRetryCountRef.current = 0;
              if (errorCode === 'server_error') {
                addTranscript({ role: 'assistant', content: 'Sorry, that hit a server error. Could you try asking again?' });
              }
            }
          }
          break;
        }

        case 'response.text.delta':
          // Text deltas (non-audio responses) — add to transcript
          if (data.delta && !data.delta.includes('<|')) {
            // These accumulate; we'll show the full text on response.text.done
          }
          break;

        case 'response.text.done':
          if (data.text && !data.text.includes('<|')) {
            addTranscript({ role: 'assistant', content: data.text });
          }
          break;

        case 'error':
          console.error('[VL] Error:', data.error);
          break;

        default:
          // Log unhandled event types (skip high-frequency ones)
          if (data.type && !data.type.includes('audio.delta') && !data.type.includes('audio_buffer') && !data.type.includes('audio_transcript.delta')) {
            console.log('[VL] Unhandled:', data.type);
          }
          break;
      }
    } catch (_e) {
      // Binary data or non-JSON — ignore
    }
  }, [addTranscript, startMicCapture, playAudioChunk, stopPlayback, startAvatarViaVoiceLive, playToolCallTone, parseMcpOutputToCards, workflowSteps]);

  /** Run smoke test against all WorkIQ MCP servers */
  const runSmokeTest = useCallback(async () => {
    try {
      const accounts = instance.getAllAccounts();
      const account = accounts[0];
      if (!account) throw new Error('Not signed in');

      const tokenResponse = await instance.acquireTokenSilent({
        scopes: [`api://${import.meta.env.VITE_MSAL_CLIENT_ID || '9b00c7ab-2ec3-463f-9a30-0dbfbb3800af'}/access_as_user`],
        account,
      });

      console.log('[SmokeTest] Running...');
      const start = performance.now();
      const res = await fetch('/api/smoke-test', {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });
      const data = await res.json();
      const totalMs = Math.round(performance.now() - start);

      console.log(`[SmokeTest] Completed in ${totalMs}ms`);
      console.log('[SmokeTest] OBO exchange:', data.obo?.durationMs + 'ms', data.obo?.status);
      if (data.servers) {
        console.table(data.servers.map((s: { label: string; discovery: { status: string; durationMs: number; toolCount?: number }; toolCall?: { status: string; durationMs: number } }) => ({
          Server: s.label,
          'Discovery (ms)': s.discovery.durationMs,
          'Discovery Status': s.discovery.status,
          'Tools Found': s.discovery.toolCount ?? '-',
          'Tool Call (ms)': s.toolCall?.durationMs ?? '-',
          'Tool Call Status': s.toolCall?.status ?? '-',
        })));
      }
      console.log('[SmokeTest] Summary:', data.summary);
      return data;
    } catch (err) {
      console.error('[SmokeTest] Failed:', err);
      return { error: (err as Error).message };
    }
  }, [instance]);

  const toggleSession = useCallback(async () => {
    if (sessionState === 'connected' || sessionState === 'active') {
      // End session
      wsRef.current?.close();
      wsRef.current = null;
      stopMicCapture();
      stopPlayback();
      stopAvatar();
      playbackContextRef.current?.close();
      playbackContextRef.current = null;
      setSessionState('disconnected');
      setDashboardCards([]);
      setWorkflowSteps([]);
      return;
    }

    setSessionState('connecting');

    try {
      // Get access token
      const accounts = instance.getAllAccounts();
      const account = accounts[0];
      if (!account) {
        throw new Error('No authenticated account');
      }

      const tokenResponse = await instance.acquireTokenSilent({
        scopes: [`api://${import.meta.env.VITE_MSAL_CLIENT_ID || '9b00c7ab-2ec3-463f-9a30-0dbfbb3800af'}/access_as_user`],
        account,
      });

      // Connect WebSocket to our backend proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/voice-live?token=${encodeURIComponent(tokenResponse.accessToken)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to backend');
      };

      ws.onmessage = handleVoiceLiveMessage;

      ws.onclose = (event) => {
        console.log(`[WS] Closed: ${event.code} ${event.reason}`);
        stopMicCapture();
        setSessionState('disconnected');
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setSessionState('error');
      };
    } catch (error) {
      console.error('[Session] Failed to start:', error);
      setSessionState('error');
    }
  }, [sessionState, instance, handleVoiceLiveMessage, stopMicCapture, stopAvatar]);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      }));
      wsRef.current.send(JSON.stringify({ type: 'response.create' }));
      addTranscript({ role: 'user', content: text });
    }
  }, [addTranscript]);

  const confirmAction = useCallback((actionId: string) => {
    setActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'confirmed' as const } : a
    ));
  }, []);

  const rejectAction = useCallback((actionId: string) => {
    setActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'failed' as const } : a
    ));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      stopMicCapture();
      stopPlayback();
      stopAvatar();
      playbackContextRef.current?.close();
    };
  }, [stopMicCapture, stopPlayback, stopAvatar]);

  return {
    sessionState,
    isListening,
    isSpeaking,
    isMuted,
    transcript,
    actions,
    dashboardCards,
    workflowSteps,
    toggleSession,
    toggleMute,
    sendTextMessage,
    confirmAction,
    rejectAction,
    runSmokeTest,
    videoRef,
    audioRef,
  };
}

function inferActionType(toolName: string): AgentAction['type'] {
  const name = toolName.toLowerCase();
  if (name.includes('mail') || name.includes('email')) return 'email';
  if (name.includes('calendar') || name.includes('meeting') || name.includes('event')) return 'meeting';
  if (name.includes('search') || name.includes('copilot')) return 'search';
  if (name.includes('task') || name.includes('planner')) return 'task';
  if (name.includes('chat') || name.includes('teams')) return 'chat';
  if (name.includes('web') || name.includes('bing')) return 'web_search';
  if (name.includes('user') || name.includes('people') || name.includes('me')) return 'user_lookup';
  if (name.includes('file') || name.includes('drive') || name.includes('sharepoint')) return 'file';
  return 'search';
}
