import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

/**
 * POST /api/session
 * Returns Voice Live connection details for the client.
 * The actual WebSocket connection is handled by the /ws endpoint.
 */
router.post('/', authMiddleware, async (_req, res) => {
  try {
    res.json({
      voiceLiveEndpoint: env.VOICELIVE_ENDPOINT,
      apiVersion: env.VOICELIVE_API_VERSION,
      agentName: env.AGENT_NAME,
      projectName: env.PROJECT_NAME,
      voiceName: env.VOICE_NAME,
      avatar: {
        character: env.AVATAR_CHARACTER,
        style: env.AVATAR_STYLE,
      },
    });
  } catch (error) {
    console.error('[Session] Error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

export default router;
