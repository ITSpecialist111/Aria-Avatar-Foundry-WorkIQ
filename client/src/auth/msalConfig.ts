import { LogLevel } from '@azure/msal-browser';
import type { Configuration } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID || '9b00c7ab-2ec3-463f-9a30-0dbfbb3800af';
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI || 'http://localhost:3000';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        if (import.meta.env.DEV) console.debug('[MSAL]', message);
      },
      logLevel: LogLevel.Info,
      piiLoggingEnabled: false,
    },
  },
};

// Scopes for login — include the API scope for OBO flow
export const loginScopes = {
  scopes: ['openid', 'profile', 'offline_access', `api://${clientId}/access_as_user`],
};

