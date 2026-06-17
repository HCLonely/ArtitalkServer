const assert = require('node:assert/strict');
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

test('Vercel className route resolves /api/classes/shuoshuo', async () => {
  process.env.DATABASE_URL = 'postgres://unused';
  const storeModulePath = require.resolve('../lib/store');
  const routeModulePath = require.resolve('../api/classes/[className]');
  const originalStoreModule = require.cache[storeModulePath];
  const originalRouteModule = require.cache[routeModulePath];

  require.cache[storeModulePath] = {
    id: storeModulePath,
    filename: storeModulePath,
    loaded: true,
    exports: {
      createStore: () => ({
        listObjects: async (className) => {
          assert.equal(className, 'shuoshuo');
          return [];
        }
      })
    }
  };
  delete require.cache[routeModulePath];

  try {
    const route = require('../api/classes/[className]');
    const res = mockResponse();
    await route({ method: 'GET', query: { className: 'shuoshuo' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { results: [] });
  } finally {
    if (originalStoreModule) require.cache[storeModulePath] = originalStoreModule;
    else delete require.cache[storeModulePath];
    if (originalRouteModule) require.cache[routeModulePath] = originalRouteModule;
    else delete require.cache[routeModulePath];
  }
});
