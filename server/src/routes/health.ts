import { Router } from 'express';
import { env } from '../config/env';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    agent: env.AGENT_NAME,
    region: env.SPEECH_REGION,
    avatar: `${env.AVATAR_CHARACTER}-${env.AVATAR_STYLE}`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
