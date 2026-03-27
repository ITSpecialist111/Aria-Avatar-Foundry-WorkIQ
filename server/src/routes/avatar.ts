import { Router } from 'express';
import { DefaultAzureCredential } from '@azure/identity';
import { env } from '../config/env';

const router = Router();
const credential = new DefaultAzureCredential();

/**
 * GET /api/avatar/ice
 * Fetches an ICE relay token from Azure Speech Service for WebRTC avatar connection.
 * Server authenticates with DefaultAzureCredential — no user token needed.
 */
router.get('/ice', async (_req, res) => {
  try {
    const headers: Record<string, string> = {};
    if (env.SPEECH_RESOURCE_KEY) {
      headers['Ocp-Apim-Subscription-Key'] = env.SPEECH_RESOURCE_KEY;
    } else {
      // Get Entra token and exchange via STS for a resource-scoped token
      const entraToken = await credential.getToken('https://cognitiveservices.azure.com/.default');
      const aiEndpoint = env.AZURE_AI_SERVICES_ENDPOINT?.replace(/\/$/, '');
      if (aiEndpoint) {
        const stsResponse = await fetch(`${aiEndpoint}/sts/v1.0/issueToken`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${entraToken.token}` },
        });
        if (stsResponse.ok) {
          const speechToken = await stsResponse.text();
          headers['Authorization'] = `Bearer ${speechToken}`;
        } else {
          // Fallback: use Entra token directly with resource ID
          headers['Authorization'] = `Bearer ${entraToken.token}`;
        }
      } else {
        headers['Authorization'] = `Bearer ${entraToken.token}`;
      }
    }

    // Use the regional TTS endpoint for avatar relay tokens
    const url = `https://${env.SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;

    console.log(`[Avatar] Fetching ICE token from: ${url}`);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: 'Failed to fetch ICE token', details: text });
      return;
    }

    const iceInfo = await response.json();
    res.json(iceInfo);
  } catch (error) {
    console.error('[Avatar] ICE token fetch error:', error);
    res.status(500).json({ error: 'Internal server error fetching ICE token' });
  }
});

/**
 * GET /api/avatar/config
 * Returns current avatar configuration.
 */
router.get('/config', (_req, res) => {
  res.json({
    character: env.AVATAR_CHARACTER,
    style: env.AVATAR_STYLE,
    voice: env.VOICE_NAME,
  });
});

export default router;
