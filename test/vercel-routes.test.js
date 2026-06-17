const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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

async function withMockedStore(routeModulePath, store, run) {
  process.env.DATABASE_URL = 'postgres://unused';
  const storeModulePath = require.resolve('../lib/store');
  const originalStoreModule = require.cache[storeModulePath];
  const originalRouteModule = require.cache[routeModulePath];

  require.cache[storeModulePath] = {
    id: storeModulePath,
    filename: storeModulePath,
    loaded: true,
    exports: {
      createStore: () => store
    }
  };
  delete require.cache[routeModulePath];

  try {
    await run(require(routeModulePath));
  } finally {
    if (originalStoreModule) require.cache[storeModulePath] = originalStoreModule;
    else delete require.cache[storeModulePath];
    if (originalRouteModule) require.cache[routeModulePath] = originalRouteModule;
    else delete require.cache[routeModulePath];
  }
}

test('Vercel catch-all class route resolves /api/classes/shuoshuo', async () => {
  const routeModulePath = require.resolve('../api/classes/[...path]');
  await withMockedStore(
    routeModulePath,
    {
      listObjects: async (className) => {
        assert.equal(className, 'shuoshuo');
        return [];
      }
    },
    async (route) => {
      const res = mockResponse();
      await route({ method: 'GET', query: { path: ['shuoshuo'] } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { results: [] });
    }
  );
});

test('Vercel catch-all class route falls back to request url when path query is absent', async () => {
  const routeModulePath = require.resolve('../api/classes/[...path]');
  await withMockedStore(
    routeModulePath,
    {
      listObjects: async (className) => {
        assert.equal(className, 'shuoshuo');
        return [];
      }
    },
    async (route) => {
      const res = mockResponse();
      await route({ method: 'GET', url: '/api/classes/shuoshuo?order=-createdAt&limit=5&skip=0', query: {} }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { results: [] });
    }
  );
});

test('Vercel catch-all class route resolves /api/classes/shuoshuo/object-id', async () => {
  const routeModulePath = require.resolve('../api/classes/[...path]');
  await withMockedStore(
    routeModulePath,
    {
      updateObject: async (className, objectId, body) => {
        assert.equal(className, 'shuoshuo');
        assert.equal(objectId, 'object-id');
        assert.deepEqual(body, { content: 'updated' });
        return {
          object_id: objectId,
          class_name: className,
          data: body,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-02T00:00:00.000Z')
        };
      }
    },
    async (route) => {
      const res = mockResponse();
      await route({
        method: 'PUT',
        query: { path: ['shuoshuo', 'object-id'] },
        body: { content: 'updated' }
      }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.objectId, 'object-id');
      assert.deepEqual(res.body.attributes, { content: 'updated' });
    }
  );
});

test('Vercel class routes avoid dynamic segment name conflicts', () => {
  const classesDir = path.join(__dirname, '..', 'api', 'classes');
  const entries = fs.readdirSync(classesDir, { withFileTypes: true }).map((entry) => entry.name);

  assert(entries.includes('[...path].js'));
  assert(!entries.includes('[className].js'));
  assert(!entries.includes('[className]'));
});
