import { z } from 'zod';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from repo root (parent of server/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  // Azure / Foundry
  AZURE_TENANT_ID: z.string(),
  AZURE_SUBSCRIPTION_ID: z.string().optional(),
  FOUNDRY_PROJECT_ENDPOINT: z.string().url().optional(),
  VOICELIVE_ENDPOINT: z.string().url(),
  VOICELIVE_API_VERSION: z.string().default('2026-01-01-preview'),
  VOICELIVE_MODEL: z.string().default('gpt-4o-realtime-preview'),
  SPEECH_RESOURCE_KEY: z.string().optional(),
  SPEECH_REGION: z.string(),
  AZURE_AI_SERVICES_ENDPOINT: z.string().url().optional(),
  // Agent
  AGENT_NAME: z.string().default('Aria'),
  PROJECT_NAME: z.string().optional(),
  VOICE_NAME: z.string().default('en-US-Ava:DragonHDLatestNeural'),
  // Avatar
  AVATAR_CHARACTER: z.string().default('meg'),
  AVATAR_STYLE: z.string().default('casual'),
  AVATAR_BACKGROUND_URL: z.string().url().optional(),
  // MSAL
  MSAL_CLIENT_ID: z.string().default('9b00c7ab-2ec3-463f-9a30-0dbfbb3800af'),
  MSAL_CLIENT_SECRET: z.string().optional(),
  MSAL_TENANT_ID: z.string(),
  // Work IQ MCP
  WORKIQ_ENVIRONMENT_ID: z.string().optional(),
  // Optional
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
