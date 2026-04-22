import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import keycloak from './keycloak';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

keycloak.onAuthLogout = () => {
  root.render(
    <React.StrictMode>
      <App keycloak={keycloak} />
    </React.StrictMode>
  );
};

keycloak.onTokenExpired = () => {
  keycloak.updateToken(30).catch(() => {
    keycloak.login();
  });
};

keycloak
  .init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: true,
    checkLoginIframeInterval: 30,
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  })
  .then(() => {
    root.render(
      <React.StrictMode>
        <App keycloak={keycloak} />
      </React.StrictMode>
    );
  })
  .catch(() => {
    root.render(
      <div style={{ padding: '2rem', color: '#f87171', fontFamily: 'sans-serif' }}>
        Failed to connect to Keycloak. Make sure it is running on{' '}
        <strong>http://localhost:8080</strong>.
      </div>
    );
  });
