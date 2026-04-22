import React, { useState } from 'react';
import Keycloak from 'keycloak-js';

interface Props {
  keycloak: Keycloak;
  onDismiss: () => void;
  onRefreshed: () => void;
}

const TokenExpiryBanner: React.FC<Props> = ({ keycloak, onDismiss, onRefreshed }) => {
  const [loading, setLoading] = useState(false);

  const handleKeepLoggedIn = () => {
    setLoading(true);
    keycloak
      .updateToken(-1)
      .then(() => {
        onRefreshed();
      })
      .catch(() => {
        keycloak.login();
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="token-expiry-banner">
      <div className="token-expiry-banner__content">
        <span className="token-expiry-banner__icon">⚠</span>
        <p className="token-expiry-banner__message">
          Your session is about to expire in less than <strong>5 minutes</strong>.
        </p>
        <div className="token-expiry-banner__actions">
          <button
            className="token-expiry-banner__btn-keep"
            onClick={handleKeepLoggedIn}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Keep me logged in'}
          </button>
          <button className="token-expiry-banner__btn-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenExpiryBanner;
