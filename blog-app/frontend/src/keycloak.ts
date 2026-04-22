import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'https://qa-sso.corenroll.com',
  realm: 'qa-corenroll',
  clientId: 'blog-app',
});

export default keycloak;
