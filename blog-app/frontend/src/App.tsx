import React, { useState, useEffect, useRef } from 'react';
import Keycloak from 'keycloak-js';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import BlogList from './components/BlogList';
import TokenExpiryBanner from './components/TokenExpiryBanner';

const TOKEN_WARN_SECONDS = 300; // 5 minutes

interface AppProps {
  keycloak: Keycloak;
}

const App: React.FC<AppProps> = ({ keycloak }) => {
  const [showBanner, setShowBanner] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!keycloak.authenticated) return;

    const check = () => {
      if (dismissedRef.current) return;
      const exp = keycloak.tokenParsed?.exp;
      if (!exp) return;
      const secondsLeft = exp - Math.ceil(Date.now() / 1000);
      setShowBanner(secondsLeft > 0 && secondsLeft <= TOKEN_WARN_SECONDS);
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [keycloak.authenticated]);
  
  const handleDismiss = () => {
    dismissedRef.current = true;
    setShowBanner(false);
  };

  const handleRefreshed = () => {
    // Token renewed — hide banner and allow it to re-appear if the new token
    // also approaches expiry in the future.
    dismissedRef.current = false;
    setShowBanner(false);
  };

  return (
    <div>
      <Navbar keycloak={keycloak} />
      {showBanner && (
        <TokenExpiryBanner
          keycloak={keycloak}
          onDismiss={handleDismiss}
          onRefreshed={handleRefreshed}
        />
      )}
      {keycloak.authenticated ? (
        <BlogList keycloak={keycloak} />
      ) : (
        <Dashboard keycloak={keycloak} />
      )}
    </div>
  );
};

export default App;
