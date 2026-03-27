import { ConfidentialClientApplication } from '@azure/msal-node';
import { env } from '../config/env';

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: env.MSAL_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${env.MSAL_TENANT_ID}`,
        clientSecret: env.MSAL_CLIENT_SECRET,
      },
    });
  }
  return msalClient;
}

/**
 * Exchange user's access token for an OBO token with the required scopes
 * for Work IQ MCP server access.
 */
export async function exchangeTokenOBO(
  userToken: string,
  scopes: string[]
): Promise<string> {
  const client = getMsalClient();
  console.log('[OBO] Attempting token exchange...');
  console.log('[OBO] Client ID:', env.MSAL_CLIENT_ID);
  console.log('[OBO] Scopes:', scopes.join(', '));
  console.log('[OBO] User token length:', userToken.length);

  try {
    const result = await client.acquireTokenOnBehalfOf({
      oboAssertion: userToken,
      scopes,
    });

    if (!result?.accessToken) {
      throw new Error('OBO returned no access token');
    }
    console.log('[OBO] Success — token length:', result.accessToken.length);
    // Decode JWT payload to check audience and scopes
    try {
      const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1]!, 'base64').toString());
      console.log('[OBO] Token audience:', payload.aud);
      console.log('[OBO] Token scopes:', payload.scp || payload.roles || 'none');
      console.log('[OBO] Token issuer:', payload.iss?.substring(0, 60));
    } catch { /* non-JWT token */ }
    return result.accessToken;
  } catch (error: unknown) {
    const err = error as { errorCode?: string; errorMessage?: string; message?: string };
    console.error('[OBO] Exchange failed:');
    console.error('[OBO]   Error code:', err.errorCode || 'N/A');
    console.error('[OBO]   Message:', err.errorMessage || err.message || 'Unknown');
    throw error;
  }
}
