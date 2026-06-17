const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createSetupStatusHandler, createSetupInitHandler, createSetupMigrateHandler, createSetupRegisterAdminHandler } = require('../lib/api');

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
    empty: false,
    counts: { users: 1, talks: 1, comments: 1 }
  });

  assert.match(elements.status.innerHTML, /HCLonely\/ArtitalkServer/);
  assert.match(elements.status.innerHTML, /https:\/\/github\.com\/HCLonely\/ArtitalkServer/);
  assert.equal(elements['empty-actions'].classList.contains('hidden'), true);
  assert.equal(elements['admin-actions'].classList.contains('hidden'), true);
});

test('setup page shows admin registration when initialized but no users', async () => {
  const elements = await renderIndexWithStatus({
    initialized: true,
    empty: false,
    counts: { users: 0, talks: 1, comments: 1 }
  });

  assert.equal(elements['admin-actions'].classList.contains('hidden'), false);
  assert.equal(elements['empty-actions'].classList.contains('hidden'), true);
  assert.match(elements.status.textContent, /还没有管理员账户/);
});

test('setup migrate imports uploaded LeanCloud JSONL content', async () => {
  const created = [];
  const migrated = [];
  const handler = createSetupMigrateHandler({
    store: {
      ensureSchema: async () => {},
      migrateUsers: async (users) => { migrated.push(...users); return users.length; },
      createObject: async (className, record) => created.push({ className, record })
    }
  });
  const res = mockResponse();

  await handler({
    method: 'POST',
    body: {
      users: '{"objectId":"u1","username":"admin"}\n{"objectId":"u2","username":"test"}',
      talks: '{"objectId":"t1","atContentMd":"hello"}',
      comments: '{"objectId":"c1","atId":"t1","commentContent":"hi"}'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { imported: { users: 2, talks: 1, comments: 1 } });
  assert.equal(migrated.length, 2);
  assert.equal(migrated[0].username, 'admin');
  assert.equal(created[0].className, 'shuoshuo');
  assert.equal(created[1].className, 'atComment');
});

test('register admin creates first admin when user table is empty', async () => {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  const prevImg = process.env.ADMIN_IMG;
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret123';
  process.env.ADMIN_IMG = 'https://example.com/avatar.png';

  try {
    const created = [];
    const handler = createSetupRegisterAdminHandler({
      store: {
        setupStatus: async () => ({ initialized: true, counts: { users: 0 } }),
        createUser: async ({ username, img, passwordRecord }) => {
          created.push({ username, img, passwordRecord });
          return { object_id: 'admin1', username };
        },
        updateUserSession: async (id, token) => ({ object_id: id, session_token: token, username: 'admin' })
      }
    });
    const res = mockResponse();

    await handler({ method: 'POST' }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(created.length, 1);
    assert.equal(created[0].username, 'admin');
    assert.equal(created[0].img, 'https://example.com/avatar.png');
    assert.ok(created[0].passwordRecord);
    assert.ok(created[0].passwordRecord.password_hash);
    assert.ok(created[0].passwordRecord.password_salt);
  } finally {
    process.env.ADMIN_USERNAME = prevUser;
    process.env.ADMIN_PASSWORD = prevPass;
    process.env.ADMIN_IMG = prevImg;
  }
});

test('register admin rejects when user table not empty', async () => {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret123';

  try {
    const handler = createSetupRegisterAdminHandler({
      store: {
        setupStatus: async () => ({ initialized: true, counts: { users: 1 } })
      }
    });
    const res = mockResponse();

    await handler({ method: 'POST' }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, '管理员账户已存在。');
  } finally {
    process.env.ADMIN_USERNAME = prevUser;
    process.env.ADMIN_PASSWORD = prevPass;
  }
});

test('register admin rejects when database not initialized', async () => {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'secret123';

  try {
    const handler = createSetupRegisterAdminHandler({
      store: {
        setupStatus: async () => ({ initialized: false })
      }
    });
    const res = mockResponse();

    await handler({ method: 'POST' }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, '请先初始化数据库。');
  } finally {
    process.env.ADMIN_USERNAME = prevUser;
    process.env.ADMIN_PASSWORD = prevPass;
  }
});

test('register admin rejects when env vars not set', async () => {
  const prevUser = process.env.ADMIN_USERNAME;
  const prevPass = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;

  try {
    const handler = createSetupRegisterAdminHandler({
      store: {
        setupStatus: async () => ({ initialized: true, counts: { users: 0 } })
      }
    });
    const res = mockResponse();

    await handler({ method: 'POST' }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, '请先设置 ADMIN_USERNAME 和 ADMIN_PASSWORD 环境变量。');
  } finally {
    process.env.ADMIN_USERNAME = prevUser;
    process.env.ADMIN_PASSWORD = prevPass;
  }
});

