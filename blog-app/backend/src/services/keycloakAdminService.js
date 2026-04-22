const crypto = require('crypto');
const querystring = require('querystring');

const KC_BASE_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
// Realm that owns the admin-cli / service-account used for admin operations.
// This is almost always "master" in standard Keycloak setups.
const KC_ADMIN_REALM = process.env.KC_ADMIN_REALM || 'qa-corenroll';
const KC_ADMIN_CLIENT_ID = process.env.KC_ADMIN_CLIENT_ID || 'admin-cli';
const KC_ADMIN_CLIENT_SECRET = process.env.KC_ADMIN_CLIENT_SECRET || '';

/**
 * Exchange admin client credentials for an access token scoped to the
 * master-realm admin interface.    
 *
 * Required Keycloak setup:
 *  - In realm "master", open client "admin-cli" (or your dedicated admin client).
 *  - Enable "Service accounts enabled" and set "Access type" to confidential.
 *  - Assign the service account the "admin" realm role (or finer-grained admin roles).
 *  - Copy the client secret into KC_ADMIN_CLIENT_SECRET env var.
 *
 * @returns {Promise<string>} A short-lived access token
 */
async function getAdminToken() {
    const tokenUrl = `${KC_BASE_URL}/realms/${KC_ADMIN_REALM}/protocol/openid-connect/token`;

    const body = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: KC_ADMIN_CLIENT_ID,
        client_secret: KC_ADMIN_CLIENT_SECRET,
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to obtain Keycloak admin token (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Generate a cryptographically secure temporary password.
 * The password satisfies most default Keycloak password policies:
 * uppercase, lowercase, digit, special character, minimum 12 chars.
 *
 * @returns {string}
 */
function generateTemporaryPassword() {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '@#$!%&*';
    const all = upper + lower + digits + special;

    const randomChar = (set) => {
        const idx = crypto.randomInt(0, set.length);
        return set[idx];
    };

    // Guarantee at least one character from each required class
    const mandatory = [
        randomChar(upper),
        randomChar(lower),
        randomChar(digits),
        randomChar(special),
    ];

    const remaining = Array.from({ length: 10 }, () => randomChar(all));

    // Shuffle the combined array using Fisher-Yates
    const combined = [...mandatory, ...remaining];
    for (let i = combined.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    return combined.join('');
}

/**
 * Create a user in a Keycloak realm via the Admin REST API.
 *
 * @param {object}  params
 * @param {string}  params.email         - User's email (also used as username)
 * @param {string}  [params.firstName]   - First name
 * @param {string}  [params.lastName]    - Last name
 * @param {string}  params.persona       - One of: AGENT, MEMBER, STAFF, ADMIN
 * @param {string}  params.tenantRealm   - Target Keycloak realm name
 * @param {string}  [params.ownerSub]    - Owner UUID (sub), required when persona=STAFF
 *
 * @returns {Promise<{ userId: string, temporaryPassword: string }>}
 */

async function assignRealmRole({ userId, roleName, tenantRealm, token }) {
    // 1. Resolve role id from name
    const roleRes = await fetch(
        `${KC_BASE_URL}/admin/realms/${tenantRealm}/roles/${encodeURIComponent(roleName)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!roleRes.ok) {
        const text = await roleRes.text();
        throw new Error(
            `Role "${roleName}" not found in realm "${tenantRealm}" (${roleRes.status}): ${text}. ` +
            `Create it under Keycloak → ${tenantRealm} → Realm roles → Create role.`
        );
    }

    const role = await roleRes.json();
    // 2. Assign role to user
    const assignRes = await fetch(
        `${KC_BASE_URL}/admin/realms/${tenantRealm}/users/${userId}/role-mappings/realm`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify([{ id: role.id, name: role.name }]),
        }
    );

    // 204 No Content = success
    if (!assignRes.ok && assignRes.status !== 204) {
        const text = await assignRes.text();
        throw new Error(
            `Failed to assign role "${roleName}" to user "${userId}" (${assignRes.status}): ${text}`
        );
    }
}

async function createUser({ email, firstName = '', lastName = '', persona, tenantRealm, ownerSub = '', adminToken }) {
    const token = adminToken || await getAdminToken();
    const temporaryPassword = generateTemporaryPassword();


    console.log("Temp Admin Token", token)
    console.log("Temp Password", temporaryPassword)

    const payload = {
        email,
        username: email,
        firstName,
        lastName,
        emailVerified: true,       // suppresses Keycloak verification email
        enabled: true,
        attributes: {
            persona: [persona],      // e.g. "AGENT", "MEMBER", "STAFF", "ADMIN"
            owner_id: [ownerSub],    // empty string for non-STAFF users
        },
        credentials: [
            {
                type: 'password',
                value: temporaryPassword,
                temporary: true,        // forces password change on first login
            },
        ],
        requiredActions: ['UPDATE_PASSWORD'],
    };

    const response = await fetch(
        `${KC_BASE_URL}/admin/realms/${tenantRealm}/users`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        }
    );
    console.log("Keycloak create user response status", response.status, "status text", response.statusText);

    if (response.status !== 201) {
        const error = await response.json().catch(() => ({ errorMessage: response.statusText }));
        throw new Error(error.errorMessage || `User creation failed with HTTP ${response.status}`);
    }

    // Extract the new user's UUID from the Location header
    const location = response.headers.get('location');
    if (!location) {
        throw new Error('Keycloak did not return a Location header after user creation');
    }
    const userId = location.split('/').pop();
    console.log("User Id", userId)

    // Assign the persona as a realm role → appears in realm_access.roles in JWT
    // await assignRealmRole({ userId, roleName: persona, tenantRealm, token });
    return { userId, temporaryPassword };
}

module.exports = { getAdminToken, createUser, generateTemporaryPassword };
