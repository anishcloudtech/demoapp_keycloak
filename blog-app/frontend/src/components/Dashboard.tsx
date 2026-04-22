import React from 'react';
import Keycloak from 'keycloak-js';
import Subscribe from './Subscribe';

interface Props {
  keycloak: Keycloak;
}

const Dashboard: React.FC<Props> = ({ keycloak }) => {
  return (
    <div className="dashboard">
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">✦ Powered by Keycloak SSO</div>
        <h1>
          Where Ideas<br /><span>Come to Life</span>
        </h1>
        <p className="hero-desc">
          Thoughtful articles on technology, security, and software craft.
          Log in to read, write, and connect with a community of curious minds.
        </p>
        <div className="hero-cta-group">
          <button className="btn-hero" onClick={() => keycloak.login()}>
            Start Reading →
          </button>
          <button className="btn-hero-ghost" onClick={() => {
            document.querySelector('.subscribe-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Get Newsletter
          </button>
        </div>
      </section>

      {/* Features */}
      <div className="features-strip">
        <div className="feature-card">
          <div className="feature-icon">🔐</div>
          <h3>SSO Authentication</h3>
          <p>Secure login via Keycloak with PKCE and refresh token rotation.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📬</div>
          <h3>Live Newsletter</h3>
          <p>Subscribe once, get notified instantly when new posts go live.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Real-time M2M</h3>
          <p>Blog and newsletter backends talk via secure service-to-service tokens.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3>Role-based Access</h3>
          <p>Authors, admins, and readers each get exactly the access they need.</p>
        </div>
      </div>

      {/* Subscribe */}
      <section className="subscribe-section">
        <h2>Never Miss a Post</h2>
        <p>Join the newsletter — no spam, just great articles.</p>
        <Subscribe />
      </section>
    </div>
  );
};

export default Dashboard;
