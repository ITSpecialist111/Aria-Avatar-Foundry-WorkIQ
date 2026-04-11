import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { exchangeTokenOBO } from '../services/authService';
import { env } from '../config/env';

const router = Router();

const WORKIQ_BASE_URL = 'https://agent365.svc.cloud.microsoft/agents/tenants';

/** MCP servers to test (mirrors voiceLive.ts WORKIQ_MCP_SERVERS) */
const MCP_SERVERS = [
  { label: 'calendar', serverId: 'mcp_CalendarTools' },
  { label: 'mail', serverId: 'mcp_MailTools' },
  { label: 'teams', serverId: 'mcp_TeamsServer' },
  { label: 'me', serverId: 'mcp_MeServer' },
  { label: 'copilot', serverId: 'mcp_M365Copilot' },
  { label: 'word', serverId: 'mcp_WordServer' },
];

/** Simple MCP tool calls for each server to test actual data retrieval */
const SMOKE_TOOL_CALLS: Record<string, { method: string; params: Record<string, unknown> } | null> = {
  me: { method: 'tools/call', params: { name: 'GetMyDetails', arguments: {} } },
  calendar: null, // tool discovery only — calendar calls need parameters
  mail: null,
  teams: null,
  copilot: null,
  word: null,
};

interface TimingResult {
  label: string;
  serverId: string;
  serverUrl: string;
  discovery: {
    status: 'ok' | 'error';
    durationMs: number;
    toolCount?: number;
    toolNames?: string[];
    error?: string;
  };
  toolCall?: {
    status: 'ok' | 'error' | 'skipped';
    durationMs: number;
    method?: string;
    outputPreview?: string;
    error?: string;
  };
}

/**
 * Make an MCP Streamable HTTP request (JSON-RPC over HTTP POST).
 * The MCP protocol sends JSON-RPC 2.0 messages.
 */
async function mcpRequest(
  serverUrl: string,
  oboToken: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ result?: unknown; error?: unknown; durationMs: number; rawStatus: number; rawBody: string }> {
  const start = performance.now();
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  });

  try {
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oboToken}`,
        'x-ms-agentid': env.MSAL_CLIENT_ID,
        'User-Agent': 'AvatarFoundry/1.0.0 (SmokeTest; Node.js)',
        'Accept': 'application/json, text/event-stream',
      },
      body,
    });

    const durationMs = Math.round(performance.now() - start);
    const rawBody = await res.text();

    // MCP Streamable HTTP may return SSE or JSON
    let parsed: { result?: unknown; error?: unknown } = {};
    if (rawBody.startsWith('{')) {
      parsed = JSON.parse(rawBody);
    } else if (rawBody.includes('data:')) {
      // SSE — extract JSON from data lines
      const dataLines = rawBody.split('\n').filter(l => l.startsWith('data:'));
      for (const line of dataLines) {
        try {
          const obj = JSON.parse(line.replace('data:', '').trim());
          if (obj.result || obj.error) {
            parsed = obj;
            break;
          }
        } catch (_e) { /* skip */ }
      }
    }

    return { result: parsed.result, error: parsed.error, durationMs, rawStatus: res.status, rawBody: rawBody.substring(0, 2000) };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    return { error: (err as Error).message, durationMs, rawStatus: 0, rawBody: '' };
  }
}

/**
 * GET /api/smoke-test
 * Requires auth (same MSAL token as WebSocket).
 * Tests OBO exchange + MCP tool discovery + optional tool call for each server.
 * Returns timing breakdown.
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const results: {
    obo: { status: string; durationMs: number; error?: string };
    servers: TimingResult[];
    summary: { totalMs: number; slowestServer?: string; fastestServer?: string };
  } = {
    obo: { status: 'pending', durationMs: 0 },
    servers: [],
    summary: { totalMs: 0 },
  };

  const overallStart = performance.now();

  // Step 1: OBO token exchange
  let oboToken: string;
  const oboStart = performance.now();
  try {
    if (!env.MSAL_CLIENT_SECRET || !env.WORKIQ_ENVIRONMENT_ID) {
      res.status(400).json({
        error: 'MSAL_CLIENT_SECRET and WORKIQ_ENVIRONMENT_ID required for smoke test',
      });
      return;
    }

    const mcpScope = 'ea9ffc3e-8a23-4a7d-836d-234d7c7565c1/.default';
    oboToken = await exchangeTokenOBO(req.accessToken!, [mcpScope]);
    results.obo = {
      status: 'ok',
      durationMs: Math.round(performance.now() - oboStart),
    };
  } catch (err) {
    results.obo = {
      status: 'error',
      durationMs: Math.round(performance.now() - oboStart),
      error: (err as Error).message,
    };
    res.json(results);
    return;
  }

  // Step 2: Test each MCP server in parallel
  const tenantId = env.MSAL_TENANT_ID;

  const serverTests = MCP_SERVERS.map(async (server): Promise<TimingResult> => {
    const serverUrl = `${WORKIQ_BASE_URL}/${tenantId}/servers/${server.serverId}/`;
    const result: TimingResult = {
      label: server.label,
      serverId: server.serverId,
      serverUrl,
      discovery: { status: 'error', durationMs: 0 },
    };

    // 2a: Tool discovery (tools/list)
    const disc = await mcpRequest(serverUrl, oboToken, 'tools/list');
    if (disc.error || disc.rawStatus !== 200) {
      result.discovery = {
        status: 'error',
        durationMs: disc.durationMs,
        error: typeof disc.error === 'string'
          ? disc.error
          : JSON.stringify(disc.error || `HTTP ${disc.rawStatus}`).substring(0, 500),
      };
    } else {
      const tools = (disc.result as { tools?: Array<{ name: string }> })?.tools || [];
      result.discovery = {
        status: 'ok',
        durationMs: disc.durationMs,
        toolCount: tools.length,
        toolNames: tools.map(t => t.name).slice(0, 20),
      };
    }

    // 2b: Smoke tool call (if defined for this server)
    const smokeCall = SMOKE_TOOL_CALLS[server.label];
    if (smokeCall) {
      const call = await mcpRequest(serverUrl, oboToken, smokeCall.method, smokeCall.params);
      if (call.error || call.rawStatus !== 200) {
        result.toolCall = {
          status: 'error',
          durationMs: call.durationMs,
          method: `${(smokeCall.params as { name?: string }).name}`,
          error: typeof call.error === 'string'
            ? call.error
            : JSON.stringify(call.error || `HTTP ${call.rawStatus}`).substring(0, 500),
        };
      } else {
        const output = typeof call.result === 'string' ? call.result : JSON.stringify(call.result);
        result.toolCall = {
          status: 'ok',
          durationMs: call.durationMs,
          method: `${(smokeCall.params as { name?: string }).name}`,
          outputPreview: output?.substring(0, 300),
        };
      }
    } else {
      result.toolCall = { status: 'skipped', durationMs: 0 };
    }

    return result;
  });

  results.servers = await Promise.all(serverTests);

  // Summary
  const totalMs = Math.round(performance.now() - overallStart);
  const discoveryTimes = results.servers
    .filter(s => s.discovery.status === 'ok')
    .map(s => ({ label: s.label, ms: s.discovery.durationMs }));

  results.summary = {
    totalMs,
    slowestServer: discoveryTimes.sort((a, b) => b.ms - a.ms)[0]?.label,
    fastestServer: discoveryTimes.sort((a, b) => a.ms - b.ms)[0]?.label,
  };

  console.log(`[SmokeTest] Completed in ${totalMs}ms — OBO: ${results.obo.durationMs}ms, Servers: ${results.servers.map(s => `${s.label}=${s.discovery.durationMs}ms`).join(', ')}`);

  res.json(results);
});

export default router;
