import { useState, useRef, useCallback, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import type { SessionState, TranscriptEntry, AgentAction, AvatarConfig, VoiceConfig } from '../types';

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
  toggleSession: () => void;
  toggleMute: () => void;
  sendTextMessage: (text: string) => void;
  confirmAction: (actionId: string) => void;
  rejectAction: (actionId: string) => void;
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

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const isMutedRef = useRef(false);

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

      // When remote tracks arrive, attach to video element (both video + audio)
      pc.ontrack = (event) => {
        if (event.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = event.streams[0] ?? null;
          // Unmute the video element so avatar audio plays through it
          // This works because the user already clicked "Start Conversation" (user gesture)
          videoRef.current.muted = false;
          console.log('[Avatar] Video track received, unmuted for audio');
        }
        if (event.track.kind === 'audio' && videoRef.current) {
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
          // Also set on dedicated audio element as fallback
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0] ?? null;
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

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          let pcm16: Int16Array;
          if (isMutedRef.current) {
            // Send silence to keep the audio stream alive for server_vad
            pcm16 = new Int16Array(event.inputBuffer.length);
          } else {
            const inputData = event.inputBuffer.getChannelData(0);
            // Convert float32 to PCM16
            pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]!));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
          }
          // Send as base64 encoded audio
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64,
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
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
      console.log(`[Mic] ${newMuted ? 'Muted' : 'Unmuted'}`);
      return newMuted;
    });
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

        case 'response.audio_transcript.done': {
          // Strip VQ token artifacts from transcript before display
          const rawTranscript = data.transcript || '';
          const cleanTranscript = rawTranscript.replace(/<\|[a-z0-9_]+\|>/gi, '').trim();
          console.log('[VL] Audio transcript done:', cleanTranscript?.substring(0, 80));
          if (cleanTranscript && !cleanTranscript.startsWith('{')) {
            addTranscript({ role: 'assistant', content: cleanTranscript });
          }
          break;
        }

        case 'response.audio.delta':
          setIsSpeaking(true);
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
          } else if (addedItem?.type === 'mcp_list_tools') {
            console.log('[VL] MCP tool discovery started for server:', addedItem.server_label);
          }
          break;
        }

        case 'response.output_item.done': {
          const doneItem = data.item;
          if (doneItem?.type === 'mcp_call') {
            const outputPreview = typeof doneItem.output === 'string'
              ? doneItem.output.substring(0, 500)
              : JSON.stringify(doneItem.output)?.substring(0, 500);
            console.log('[VL] MCP call done:', doneItem.name, '| server:', doneItem.server_label);
            console.log('[VL] MCP output:', outputPreview);
            if (doneItem.error) {
              console.error('[VL] MCP error:', JSON.stringify(doneItem.error));
            }
            setActions(prev => prev.map(a =>
              a.id === doneItem.id
                ? { ...a, status: (doneItem.error ? 'failed' : 'completed') as 'failed' | 'completed' }
                : a
            ));
          }
          break;
        }

        case 'response.done':
          console.log('[VL] Response done:', data.response?.status, 'output items:', data.response?.output?.length);
          if (data.response?.status === 'failed' || data.response?.status_details) {
            console.error('[VL] Response FAILED — full event:', JSON.stringify(data.response).substring(0, 2000));
          }
          break;

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
    } catch {
      // Binary data or non-JSON — ignore
    }
  }, [addTranscript, startMicCapture, playAudioChunk, stopPlayback, startAvatarViaVoiceLive]);

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
    toggleSession,
    toggleMute,
    sendTextMessage,
    confirmAction,
    rejectAction,
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
