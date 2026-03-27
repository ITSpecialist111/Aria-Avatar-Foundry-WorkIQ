import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from './msalConfig';

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const payload = event.payload as { account?: { homeAccountId: string } };
    if (payload.account) {
      const account = msalInstance
        .getAllAccounts()
        .find((a) => a.homeAccountId === payload.account!.homeAccountId);
      if (account) msalInstance.setActiveAccount(account);
    }
  }
});
