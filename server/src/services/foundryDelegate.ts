import { DefaultAzureCredential } from '@azure/identity';
import { env } from '../config/env';

const credential = new DefaultAzureCredential();

interface AgentResponse {
  content: string;
  error?: string;
}

/**
 * Delegate a research task to a Foundry Agent (GPT-4o).
 * Uses the Azure AI Foundry REST API to create a thread, run, and get the result.
 */
export async function delegateToAgent(task: string, context?: string): Promise<AgentResponse> {
  const projectEndpoint = env.FOUNDRY_PROJECT_ENDPOINT;
  if (!projectEndpoint) {
    return { content: '', error: 'Foundry project endpoint not configured' };
  }

  try {
    // Get token for Cognitive Services
    const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
    const token = tokenResponse.token;
    const baseUrl = projectEndpoint.replace(/\/$/, '');
    const apiVersion = '2025-05-01-preview';

    // Step 1: Create a thread
    const threadRes = await fetch(`${baseUrl}/threads?api-version=${apiVersion}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!threadRes.ok) {
      const err = await threadRes.text();
      return { content: '', error: `Failed to create thread: ${threadRes.status} ${err}` };
    }
    const thread = await threadRes.json() as { id: string };
    console.log(`[FoundryDelegate] Thread created: ${thread.id}`);

    // Step 2: Add the user message
    const userMessage = context ? `Context: ${context}\n\nTask: ${task}` : task;
    const msgRes = await fetch(`${baseUrl}/threads/${thread.id}/messages?api-version=${apiVersion}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'user',
        content: userMessage,
      }),
    });
    if (!msgRes.ok) {
      const err = await msgRes.text();
      return { content: '', error: `Failed to add message: ${msgRes.status} ${err}` };
    }

    // Step 3: Create a run with the agent
    const agentName = env.AGENT_NAME;
    // First, list agents to find the agent ID
    const agentsRes = await fetch(`${baseUrl}/assistants?api-version=${apiVersion}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    let assistantId: string | null = null;
    if (agentsRes.ok) {
      const agents = await agentsRes.json() as { data: Array<{ id: string; name: string }> };
      const agent = agents.data?.find((a: { name: string }) => a.name === agentName);
      assistantId = agent?.id || null;
    }

    if (!assistantId) {
      // Fallback: use chat completion instead
      console.log('[FoundryDelegate] No agent found, using chat completion fallback');
      return await chatCompletionFallback(token, baseUrl, task, context);
    }

    const runRes = await fetch(`${baseUrl}/threads/${thread.id}/runs?api-version=${apiVersion}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
      }),
    });
    if (!runRes.ok) {
      const err = await runRes.text();
      return { content: '', error: `Failed to create run: ${runRes.status} ${err}` };
    }
    const run = await runRes.json() as { id: string; status: string };
    console.log(`[FoundryDelegate] Run created: ${run.id}`);

    // Step 4: Poll for completion (max 30 seconds)
    let status = run.status;
    const startTime = Date.now();
    while (status === 'queued' || status === 'in_progress') {
      if (Date.now() - startTime > 30000) {
        return { content: '', error: 'Agent run timed out after 30 seconds' };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollRes = await fetch(`${baseUrl}/threads/${thread.id}/runs/${run.id}?api-version=${apiVersion}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!pollRes.ok) break;
      const pollData = await pollRes.json() as { status: string };
      status = pollData.status;
    }

    if (status !== 'completed') {
      return { content: '', error: `Run ended with status: ${status}` };
    }

    // Step 5: Get the response messages
    const msgsRes = await fetch(`${baseUrl}/threads/${thread.id}/messages?api-version=${apiVersion}&order=desc&limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!msgsRes.ok) {
      return { content: '', error: 'Failed to retrieve response messages' };
    }
    const msgs = await msgsRes.json() as { data: Array<{ role: string; content: Array<{ type: string; text?: { value: string } }> }> };
    const assistantMsg = msgs.data?.find((m: { role: string }) => m.role === 'assistant');
    const textContent = assistantMsg?.content?.find((c: { type: string }) => c.type === 'text');
    const responseText = textContent?.text?.value || 'No response from agent';

    console.log(`[FoundryDelegate] Got response (${responseText.length} chars)`);
    return { content: responseText };

  } catch (error) {
    console.error('[FoundryDelegate] Error:', error);
    return { content: '', error: (error as Error).message };
  }
}

/**
 * Fallback: use chat completions if no agent is configured
 */
async function chatCompletionFallback(token: string, baseUrl: string, task: string, context?: string): Promise<AgentResponse> {
  try {
    // Use the deployed model for a simple completion
    const deploymentName = 'gpt-4o';
    const userMessage = context ? `Context: ${context}\n\nTask: ${task}` : task;

    const res = await fetch(`${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-10-21`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a research assistant. Provide thorough, well-structured analysis. Be concise but comprehensive.' },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { content: '', error: `Chat completion failed: ${res.status} ${err}` };
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return { content: data.choices?.[0]?.message?.content || 'No response' };
  } catch (error) {
    return { content: '', error: (error as Error).message };
  }
}
