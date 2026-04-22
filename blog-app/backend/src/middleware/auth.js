const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'qa-corenroll';

console.log("KEYCLOAK_URL:", KEYCLOAK_URL);
console.log("Keycloak realms",KEYCLOAK_REALM);


const client = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
} 


const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  jwt.verify(token, getSigningKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    console.log("Is the user admin", decoded);
    next();
  });
};

// Usage: router.get('/admin', verifyToken, requireRole('admin'), handler)
const requireRole = (...roles) => (req, res, next) => {
  console.log('User roles:', {
    realmRoles: req.user?.realm_access?.roles || [],
    resourceAccess: req.user?.resource_access || {},
  });
  const realmRoles = req.user?.realm_access?.roles || [];
  const clientRoles = req.user?.resource_access?.['blog-app']?.roles || [];
  const userRoles = [...realmRoles, ...clientRoles];
  console.log('Combined user roles:', userRoles);

  const hasRole = roles.some((role) => userRoles.includes(role));
  if (!hasRole) {
    return res.status(403).json({ error: `Required role(s): ${roles.join(', ')}` });
  }
  next();
};

module.exports = { verifyToken, requireRole };
