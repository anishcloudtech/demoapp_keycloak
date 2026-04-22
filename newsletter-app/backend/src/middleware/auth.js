const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { recordAudit } = require('../utils/auditLogger');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'CloudTech';

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
    console.log('Authorization header in newsletter aticle:', req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  jwt.verify(token, getSigningKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    console.log('Decoded token:', decoded); 
    next();
  });
};

// Rejects any token not issued for blog-backend-service (prevents user tokens being forwarded)
const requireServiceClient = (req, res, next) => {
  const azp = req.user?.azp;
  if (azp !== 'blog-backend-service') {
    return res.status(403).json({ error: 'Access restricted to internal services' });
  }
  next();
};

// Checks realm roles and all client roles in the token
const requireRole = (...roles) => (req, res, next) => {

  console.log("Check user roles for access control:",req.user);
    console.log('User roles:', {
      realmRoles: req.user?.realm_access?.roles || [],
      resourceAccess: req.user?.resource_access || {},
    });
  const realmRoles = req.user?.realm_access?.roles || [];
  const allClientRoles = Object.values(req.user?.resource_access || {})
    .flatMap((c) => c.roles || []);
  const userRoles = [...realmRoles, ...allClientRoles];
console.log('Combined user roles:', userRoles);
console.log("Required roles for this endpoint:", roles);
console.log("HAs required role?", roles.some((role) => userRoles.includes(role)));
  if (!roles.some((role) => userRoles.includes(role))) {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    recordAudit({
      action: 'UNAUTHORIZED_ACCESS',
      severity: 'CRITICAL',
      actor: {
        type: req.user?.azp === 'blog-backend-service' ? 'service' : 'user',
        userId: req.user?.sub || null,
        username:
          req.user?.preferred_username || req.user?.email || req.user?.sub || null,
        ip,
        clientApp: req.user?.azp || null,
        roles: userRoles,
      },
      resource: req.originalUrl,
      outcome: 'DENIED',
      details: {
        requiredRoles: roles,
        presentRoles: userRoles,
        method: req.method,
        path: req.originalUrl,
      },
    });
    return res.status(403).json({ error: `Required role(s): ${roles.join(', ')}` });
  }
  next();
};

module.exports = { verifyToken, requireRole, requireServiceClient };
