const https = require('https');
const http = require('http');
const os = require('os');
const querystring = require('querystring');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'CloudTech';
const M2M_CLIENT_ID = process.env.M2M_CLIENT_ID || 'blog-backend-service';
const M2M_CLIENT_SECRET = process.env.M2M_CLIENT_SECRET || '';
const NEWSLETTER_API_URL = process.env.NEWSLETTER_API_URL || 'http://localhost:4002';

let cachedToken = null;
let tokenExpiresAt = 0;

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function getServiceToken() {
  // const now = Date.now();
  // if (cachedToken && now < tokenExpiresAt - 30_000) {
  //   return cachedToken;
  // }
  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const body = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: M2M_CLIENT_ID,
    client_secret: M2M_CLIENT_SECRET,
  });
  const data = await httpPost(tokenUrl, body);
  cachedToken = data.access_token;
  // tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

/**
 * Notify the newsletter service that a new post was published.
 * Called by blog-backend internally — no user token involved.
 */
async function notifyNewPost({ postId, title, author, excerpt, publishedBy }) {
  const token = await getServiceToken();
  try {
    return await httpPostJson(`${NEWSLETTER_API_URL}/api/notify`, { postId, title, author, excerpt, publishedBy }, token);
  } catch (err) {
    if (err.status === 401) {
      // Token was rejected (revoked or expired earlier than expected) — clear cache and retry once
      console.warn('M2M token rejected (401) — refreshing and retrying...');
      clearTokenCache();
      const freshToken = await getServiceToken();
      console.log("Fresh token acquired, retrying notifyNewPost...");
      return httpPostJson(`${NEWSLETTER_API_URL}/api/notify`, { postId, title, author, excerpt, publishedBy }, freshToken);
    }
    if (err.status === 403) {
      console.error(
        'M2M notify failed (403): blog-backend-service lacks the "service" realm role. ' +
        'Assign it under: Keycloak → CloudTech → Clients → blog-backend-service → Service accounts roles.'
      );
    }
    throw err;
  }
}

/**
 * Fetch all subscribers from newsletter-backend via M2M.
 * Only called by blog-backend on behalf of an admin user.
 */
async function getSubscribers() {
  const token = await getServiceToken();
  try {
    return await httpGet(`${NEWSLETTER_API_URL}/api/subscribers`, token);
  } catch (err) {
    if (err.status === 401) {
      console.warn('M2M token rejected (401) on getSubscribers — refreshing and retrying...');
      clearTokenCache();
      const freshToken = await getServiceToken();
      console.log("Fresh token acquired, retrying getSubscribers...",freshToken);
      return httpGet(`${NEWSLETTER_API_URL}/api/subscribers`, freshToken);
    }
    if (err.status === 403) {
      console.error(
        'M2M getSubscribers failed (403): blog-backend-service lacks the "service" realm role. ' +
        'Assign it under: Keycloak → CloudTech → Clients → blog-backend-service → Service accounts roles.'
      );
    }
    throw err;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (res.statusCode >= 400) return reject(new Error(json.error_description || json.error));
            resolve(json);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpPostJson(url, payload, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${token}`,
          'X-Caller-Host': os.hostname(),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const err = new Error(json.error || 'Upstream error');
              err.status = res.statusCode;
              return reject(err);
            }
            resolve(json);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const err = new Error(json.error || 'Upstream error');
              err.status = res.statusCode;
              return reject(err);
            }
            resolve(json);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

module.exports = { notifyNewPost, getSubscribers };
