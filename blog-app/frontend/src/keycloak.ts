import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'corenroll',
  clientId: 'blog-app',
});

export default keycloak;
