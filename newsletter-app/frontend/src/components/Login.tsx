import React from 'react';
import Keycloak from 'keycloak-js';

interface Props {
  keycloak: Keycloak;
}

const Login: React.FC<Props> = ({ keycloak }) => (
  <div className="login-page">
    <div className="login-card">
      <div className="login-icon">📬</div>
      <h1 className="login-title">Newsletter Admin</h1>
      <p className="login-desc">
        Sign in with your Keycloak account to view email notification logs.
        <br />
        <strong>Admin</strong> role required.
      </p>
      <button className="btn-hero" onClick={() => keycloak.login()}>
        Sign in with Keycloak →
      </button>
    </div>
  </div>
);

export default Login;
