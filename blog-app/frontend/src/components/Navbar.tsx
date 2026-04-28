import React from 'react';
import Keycloak from 'keycloak-js';

interface Props {
  keycloak: Keycloak;
}

const Navbar: React.FC<Props> = ({ keycloak }) => {
  const username = keycloak.tokenParsed?.preferred_username ?? 'Reader';
  const initial = username.charAt(0).toUpperCase();

  const resetPassword = async () => {
    const baseUrl = keycloak.authServerUrl;
    const realm = keycloak.realm;
    const clientId = keycloak.clientId;
    const redirectUri = encodeURIComponent(window.location.origin);

    const url = `${baseUrl}/realms/${realm}/protocol/openid-connect/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=openid` +
      `&kc_action=UPDATE_PASSWORD`;

    window.location.href = url;
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">✦ TheBlogs..</div>
      <div className="nav-right">
        {keycloak.authenticated ? (
          <>
            <div className="nav-user-badge">
              <div className="nav-avatar">{initial}</div>
              <span className="welcome-text">{username}</span>
            </div>
            <button className="btn-outline" onClick={resetPassword}>
              Reset Password
            </button>
            <button className="btn-outline" onClick={() => keycloak.logout()}>
              Sign Out
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={() => keycloak.login()}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

