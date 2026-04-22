import React from 'react';
import Keycloak from 'keycloak-js';

interface Props {
  keycloak: Keycloak;
}

const Navbar: React.FC<Props> = ({ keycloak }) => {
  const name =
    (keycloak.tokenParsed as any)?.preferred_username ||
    (keycloak.tokenParsed as any)?.email ||
    'Admin';

  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? [];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">📬</span>
        <span className="navbar-title">Newsletter Admin</span>
      </div>

      <div className="navbar-right">
        {keycloak.authenticated ? (
          <>
            <div className="navbar-user">
              <div className="navbar-avatar">{name.charAt(0).toUpperCase()}</div>
              <div className="navbar-user-info">
                <span className="navbar-username">{name}</span>
                {roles.includes('admin') && (
                  <span className="navbar-role-badge">admin</span>
                )}
              </div>
            </div>
            <button className="btn-logout" onClick={() => keycloak.logout()}>
              Sign out
            </button>
          </>
        ) : (
          <button className="btn-login" onClick={() => keycloak.login()}>
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
