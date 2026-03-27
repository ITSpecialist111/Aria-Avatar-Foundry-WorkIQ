import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// Extend Express Request to include auth info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userName?: string;
      accessToken?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // In production, validate the JWT signature against Entra ID JWKS endpoint.
    // For the showcase, we decode the payload to extract user info.
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64').toString());

    // Basic validation
    if (payload.aud !== env.MSAL_CLIENT_ID && payload.aud !== `api://${env.MSAL_CLIENT_ID}`) {
      res.status(401).json({ error: 'Invalid token audience' });
      return;
    }

    req.userId = payload.oid || payload.sub;
    req.userName = payload.name || payload.preferred_username;
    req.accessToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
