const { verifyPassword, createSessionToken } = require('./auth');
const { createPasswordHash } = require('./auth');
const { parseLeanCloudJsonl } = require('./import-jsonl');
const { rowToLeanCloudObject, publicUserFromRow } = require('./leancloud-shape');

const SUPPORTED_CLASSES = new Set(['_User', 'shuoshuo', 'atComment']);

function sendJson(res, statusCode, body) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-LC-Session');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (typeof res.status === 'function') return res.status(statusCode).json(body);
  res.statusCode = statusCode;
  return res.end(JSON.stringify(body));
}

function pathPartsFromUrl(url) {
  if (!url) return [];
  const pathname = new URL(url, 'http://localhost').pathname;
  const prefix = '/api/classes/';
  if (!pathname.startsWith(prefix)) return [];
  return pathname
    .slice(prefix.length)
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
}

function readPathParts(query, url) {
  const path = query.path || query.className || query[0];
  if (Array.isArray(path)) return path;
  if (path) return [path];
  return pathPartsFromUrl(url);
}

function readClassName(query, url) {
  return readPathParts(query, url)[0];
}

function readObjectId(query, url) {
  const path = readPathParts(query, url);
  if (path.length > 1) return path[1];
  return query.objectId;
}

function parseOptions(query) {
  return {
    where: query.where ? JSON.parse(query.where) : {},
    order: query.order,
    limit: query.limit === undefined ? undefined : Number(query.limit),
    skip: query.skip === undefined ? undefined : Number(query.skip)
  };
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

function assertSupportedClass(className) {
  if (!SUPPORTED_CLASSES.has(className)) {
    const error = new Error(`Unsupported class: ${className}`);
    error.statusCode = 404;
    throw error;
  }
}

function createClassHandler({ store }) {
  return async function classHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    try {
      const className = readClassName(req.query || {}, req.url);
      const objectId = readObjectId(req.query || {}, req.url);
      assertSupportedClass(className);

      if (req.method === 'GET') {
        const rows = await store.listObjects(className, parseOptions(req.query || {}));
        return sendJson(res, 200, { results: rows.map(rowToLeanCloudObject) });
      }

      if (req.method === 'POST') {
        const row = await store.createObject(className, normalizeBody(req.body));
        return sendJson(res, 201, rowToLeanCloudObject(row));
      }

      if (req.method === 'PUT') {
        const row = await store.updateObject(className, objectId, normalizeBody(req.body));
        return sendJson(res, 200, rowToLeanCloudObject(row));
      }

      if (req.method === 'DELETE') {
        await store.deleteObject(className, objectId);
        return sendJson(res, 200, {});
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

function createLoginHandler({ store }) {
  return async function loginHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

    const body = normalizeBody(req.body);
    const username = body.username;
    const password = body.password;
    const user = await store.findUserByUsername(username);
    if (!user) return sendJson(res, 404, { error: 'Could not find user.' });

    const matches = await verifyPassword(password, user);
    if (!matches) return sendJson(res, 401, { error: 'The username and password mismatch.' });

    const sessionToken = createSessionToken();
    const updated = await store.updateUserSession(user.object_id, sessionToken);
    return sendJson(res, 200, publicUserFromRow(updated));
  };
}

function createMeHandler({ store }) {
  return async function meHandler(req, res) {
    const token = req.headers && (req.headers['x-lc-session'] || req.headers['X-LC-Session']);
    if (!token) return sendJson(res, 401, { error: 'Unauthorized' });
    const user = await store.findUserBySessionToken(token);
    if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, publicUserFromRow(user));
  };
}

function createLogoutHandler() {
  return async function logoutHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    return sendJson(res, 200, {});
  };
}

function createSetupStatusHandler({ store }) {
  return async function setupStatusHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      return sendJson(res, 200, await store.setupStatus());
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

function createSetupInitHandler({ store }) {
  return async function setupInitHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      await store.ensureSchema();
      return sendJson(res, 200, await store.setupStatus());
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

function createSetupMigrateHandler({ store }) {
  return async function setupMigrateHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      const body = normalizeBody(req.body);
      const users = parseLeanCloudJsonl(body.users || '');
      const talks = parseLeanCloudJsonl(body.talks || '');
      const comments = parseLeanCloudJsonl(body.comments || '');

      await store.ensureSchema();
      for (const user of users) await store.importUser(user);
      for (const talk of talks) await store.createObject('shuoshuo', talk);
      for (const comment of comments) await store.createObject('atComment', comment);

      return sendJson(res, 200, {
        imported: {
          users: users.length,
          talks: talks.length,
          comments: comments.length
        }
      });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

function createResetHandler({ store }) {
  return async function resetHandler(req, res) {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    try {
      const body = normalizeBody(req.body);
      const username = body.username;
      const legacyPassword = body.legacyPassword;
      const newPassword = body.newPassword;
      if (!username || !legacyPassword || !newPassword) {
        return sendJson(res, 400, { error: 'username, legacyPassword, and newPassword are required' });
      }
      if (String(newPassword).length < 8) {
        return sendJson(res, 400, { error: 'newPassword must be at least 8 characters' });
      }

      const updated = await store.resetUserPasswordWithLegacyProof(
        username,
        legacyPassword,
        await createPasswordHash(newPassword)
      );
      if (!updated) return sendJson(res, 403, { error: 'Invalid reset proof' });
      return sendJson(res, 200, { ok: true, username });
    } catch (error) {
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  };
}

module.exports = {
  createClassHandler,
  createLoginHandler,
  createLogoutHandler,
  createMeHandler,
  createResetHandler,
  createSetupInitHandler,
  createSetupMigrateHandler,
  createSetupStatusHandler
};
