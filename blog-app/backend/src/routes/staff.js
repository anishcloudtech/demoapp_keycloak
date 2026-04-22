const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { createUser } = require('../services/keycloakAdminService');

const router = express.Router();

const VALID_PERSONAS = ['agent', 'member', 'staff', 'admin'];

// Basic email format validation — no library dependency needed at this boundary
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/register-staff
 * Admin-only endpoint. Creates a new Keycloak user with the given persona
 * and returns the generated userId + temporary password so the admin can
 * distribute credentials out-of-band.
 *
 * Request body:
 *   email        {string}  required
 *   firstName    {string}  optional
 *   lastName     {string}  optional
 *   persona      {string}  required  — one of AGENT | MEMBER | STAFF | ADMIN
 *   tenantRealm  {string}  required  — target Keycloak realm
 *   ownerSub     {string}  optional  — owner UUID; relevant when persona=STAFF
 */
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  const { email, firstName, lastName, persona, tenantRealm, ownerSub } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!email || !persona || !tenantRealm) {
    return res.status(400).json({ error: 'email, persona, and tenantRealm are required' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Provide a valid email address' });
  }

  if (!VALID_PERSONAS.includes(persona)) {
    return res.status(400).json({
      error: `persona must be one of: ${VALID_PERSONAS.join(', ')}`,
    });
  }

  if (typeof tenantRealm !== 'string' || tenantRealm.trim() === '') {
    return res.status(400).json({ error: 'tenantRealm must be a non-empty string' });
  }

  // ── Create user in Keycloak ─────────────────────────────────────────────
  try {
    const { userId, temporaryPassword } = await createUser({
      email: email.trim().toLowerCase(),
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      persona,
      tenantRealm: tenantRealm.trim(),
      ownerSub: (ownerSub || '').trim(),
      adminToken: req.headers.authorization.slice(7),
    });

    console.log(`[register-staff] Created user ${userId} (${email}) persona=${persona} realm=${tenantRealm}`);


    console.log("AAl detils related newly created user", {
      userId,
      email: email.trim().toLowerCase(),
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      persona,
      tenantRealm: tenantRealm.trim(),
      ownerSub: (ownerSub || '').trim(),
      temporaryPassword
    });


    return res.status(201).json({
      message: 'User registered successfully',
      userId,
      temporaryPassword,
      email: email.trim().toLowerCase(),
      persona,
      tenantRealm: tenantRealm.trim(),
    });
  } catch (err) {
    console.error('[register-staff] error:', err.message);

    // Keycloak returns "User exists with same username" or similar conflict messages
    const isConflict =
      err.message?.toLowerCase().includes('exists') ||
      err.message?.toLowerCase().includes('conflict');

    return res.status(isConflict ? 409 : 500).json({ error: err.message });
  }
});

module.exports = router;
