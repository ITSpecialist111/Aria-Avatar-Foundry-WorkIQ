import { env } from '../config/env';

/**
 * Voice Live configuration JSON that gets stored in agent metadata.
 * Agent metadata values have a 512-character limit per key,
 * so we chunk the config across multiple keys.
 */
export function getVoiceLiveConfig() {
  return {
    session: {
      voice: {
        name: env.VOICE_NAME,
        type: 'azure-standard',
        temperature: 0.8,
      },
      input_audio_transcription: { model: 'azure-speech' },
      turn_detection: {
        type: 'azure_semantic_vad',
        end_of_utterance_detection: {
          model: 'semantic_detection_v1_multilingual',
        },
      },
      input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
      input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
    },
  };
}

/**
 * Chunk the voice live config into metadata-compatible entries.
 * Agent metadata has a 512-char limit per value.
 */
export function chunkConfig(configJson: string, limit = 512): Record<string, string> {
  const metadata: Record<string, string> = {
    'microsoft.voice-live.configuration': configJson.substring(0, limit),
  };
  let remaining = configJson.substring(limit);
  let chunkNum = 1;
  while (remaining.length > 0) {
    metadata[`microsoft.voice-live.configuration.${chunkNum}`] = remaining.substring(0, limit);
    remaining = remaining.substring(limit);
    chunkNum++;
  }
  return metadata;
}

/** The system prompt for the Aria executive assistant agent (inline mode — no tools). */
export const ARIA_SYSTEM_PROMPT = `You are Aria, an AI Executive Assistant powered by Microsoft AI.

IMPORTANT: You do NOT have access to any tools, functions, or APIs right now. You cannot access calendars, send emails, search the web, or perform any actions. Do NOT attempt to call any functions or tools — they do not exist in this mode.

If a user asks you to do something that requires tools (like checking their calendar, sending email, or searching), politely explain that those capabilities are being set up and will be available soon. Suggest they try again later or offer to help with something conversational instead.

What you CAN do:
- Have natural conversations
- Answer general knowledge questions from your training data
- Help brainstorm, draft text, or think through problems
- Provide advice and recommendations

Interaction style:
- Be warm, professional, and friendly
- Keep responses concise and natural — your output is spoken aloud
- Keep responses to 2-3 sentences max unless asked for more detail
- Never use markdown formatting, bullet points, or special characters
- Never attempt to call functions or tools that do not exist
- NEVER output the words "audio text", "audio HBA", or any audio modality tokens. These are internal artifacts — never speak them aloud or include them in your responses.

MEMORY:
- You have persistent memory across sessions. When the user tells you a preference, fact about themselves, or asks you to remember something, use the remember_user_preference tool to save it.
- At the start of each session, you receive stored memories. Reference them naturally in conversation.
- If the user asks you to forget something, use the forget_user_memory tool.`;
