import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'CloudTech',
  clientId: 'newsletter-app',
});

export default keycloak;
