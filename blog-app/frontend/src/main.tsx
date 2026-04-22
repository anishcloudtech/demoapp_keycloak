import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import keycloak from './keycloak';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Fired when another SSO app or Keycloak itself ends the session
keycloak.onAuthLogout = () => {
  console.log('SSO session ended externally — redirecting to login');
  root.render(
    <React.StrictMode>
      <App keycloak={keycloak} />
    </React.StrictMode>
  );
};

// Fired when the access token expires and cannot be refreshed
keycloak.onTokenExpired = () => {
  keycloak.updateToken(30).catch(() => {
    console.log('Session expired — user must log in again');
    keycloak.login();
  });
};

keycloak
  .init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: true,              // detects SSO logout from other apps
    checkLoginIframeInterval: 30,        // checks every 30 seconds
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  })
  .then(() => {
    root.render(
      <React.StrictMode>
        <App keycloak={keycloak} />
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error('Keycloak init failed:', err);
    root.render(
      <React.StrictMode>
        <App keycloak={keycloak} />
      </React.StrictMode>
    );
  });