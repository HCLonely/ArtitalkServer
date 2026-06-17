const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createSetupStatusHandler, createSetupInitHandler, createSetupMigrateHandler, createResetHandler } = require('../lib/api');

function loadIndexScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  return html.match(/<script>([\s\S]*)<\/script>/)[1];
}

function createClassList() {
  const classes = new Set(['hidden']);
  return {
    contains: (className) => classes.has(className),
    add: (className) => classes.add(className),
    remove: (className) => classes.delete(className),
    toggle: (className, force) => {
      if (force) classes.add(className);
      else classes.delete(className);
    }
  };
}

async function renderIndexWithStatus(status) {
  const elements = {};
  const document = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          classList: createClassList(),
          files: [],
          textContent: '',
          innerHTML: '',
          onclick: undefined,
          onsubmit: undefined
        };
      }
      return elements[id];
    }
  };
  const context = {
    document,
    fetch: async () => ({
      ok: true,
      json: async () => status
    })
  };

  vm.runInNewContext(loadIndexScript(), context);
  await new Promise((resolve) => setImmediate(resolve));
  return elements;
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end(value) {
      this.body = value;
      return this;
    }
  };
}

test('setup status reports empty database state', async () => {
  const handler = createSetupStatusHandler({
    store: {
      setupStatus: async () => ({ initialized: true, empty: true, counts: { users: 0, talks: 0, comments: 0 } })
    }
  });
  const res = mockResponse();

  await handler({ method: 'GET' }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    initialized: true,
    empty: true,
    counts: { users: 0, talks: 0, comments: 0 }
  });
});

test('setup page shows project introduction link after database initialization', async () => {
  const elements = await renderIndexWithStatus({
    initialized: true,
    empty: true,
    counts: { users: 0, talks: 0, comments: 0 }
  });

  assert.match(elements.status.innerHTML, /HCLonely\/ArtitalkServer/);
  assert.match(elements.status.innerHTML, /https:\/\/github\.com\/HCLonely\/ArtitalkServer/);
  assert.equal(elements['empty-actions'].classList.contains('hidden'), true);
});

test('setup migrate imports uploaded LeanCloud JSONL content', async () => {
  const imported = [];
  const created = [];
  const handler = createSetupMigrateHandler({
    store: {
      ensureSchema: async () => {},
      importUser: async (record) => imported.push(record),
      createObject: async (className, record) => created.push({ className, record })
    }
  });
  const res = mockResponse();

  await handler({
    method: 'POST',
    body: {
      users: '# comment\n{"objectId":"u1","username":"admin","password":"legacy"}',
      talks: '{"objectId":"t1","atContentMd":"hello"}',
      comments: '{"objectId":"c1","atId":"t1","commentContent":"hi"}'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { imported: { users: 1, talks: 1, comments: 1 } });
  assert.equal(imported[0].username, 'admin');
  assert.equal(created[0].className, 'shuoshuo');
  assert.equal(created[1].className, 'atComment');
});

test('reset handler requires legacy password proof and writes a new password hash', async () => {
  const calls = [];
  const handler = createResetHandler({
    store: {
      resetUserPasswordWithLegacyProof: async (username, legacyPassword, passwordRecord) => {
        calls.push({ username, legacyPassword, passwordRecord });
        return { object_id: 'u1', username };
      }
    }
  });
  const res = mockResponse();

  await handler({
    method: 'POST',
    body: {
      username: 'admin',
      legacyPassword: 'legacy-hash',
      newPassword: 'new-password'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(calls[0].username, 'admin');
  assert.equal(calls[0].legacyPassword, 'legacy-hash');
  assert.equal(calls[0].passwordRecord.password_algorithm, 'pbkdf2-sha256');
});
