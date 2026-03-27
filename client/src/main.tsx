import React from 'react';
import ReactDOM from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/AuthProvider';
import App from './App';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Initialize MSAL and await redirect handling before rendering
msalInstance.initialize().then(async () => {
  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
    }
  } catch (error) {
    console.error('[MSAL] Redirect handling failed:', error);
  }

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]!);
  }

  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>,
  );
});
