const assert = require('node:assert/strict');
const test = require('node:test');

const { createClassHandler, createLoginHandler } = require('../lib/api');

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

test('class handler lists objects using query parameters', async () => {
  const calls = [];
  const handler = createClassHandler({
    store: {
      listObjects: async (className, options) => {
        calls.push({ className, options });
        return [{ object_id: 'talk1', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', data: { atContentMd: 'hello' } }];
      }
    }
  });
  const res = mockResponse();

  await handler({
    method: 'GET',
    query: {
      path: ['shuoshuo'],
      where: '{"objectId":"talk1"}',
      order: '-createdAt',
      limit: '5',
      skip: '10'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{
    className: 'shuoshuo',
    options: {
      where: { objectId: 'talk1' },
      order: '-createdAt',
      limit: 5,
      skip: 10
    }
  }]);
  assert.equal(res.body.results[0].objectId, 'talk1');
});

test('class handler splits slash-delimited Vercel catch-all path strings', async () => {
  const calls = [];
  const handler = createClassHandler({
    store: {
      deleteObject: async (className, objectId) => {
        calls.push({ className, objectId });
      }
    }
  });
  const res = mockResponse();

  await handler({
    method: 'DELETE',
    query: {
      path: 'shuoshuo/5f65ee6617d94f6ebb3ff25e'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{
    className: 'shuoshuo',
    objectId: '5f65ee6617d94f6ebb3ff25e'
  }]);
});

test('sendJson allows all origins when ALLOW_ORIGIN is unset', async () => {
  const originalAllowOrigin = process.env.ALLOW_ORIGIN;
  delete process.env.ALLOW_ORIGIN;
  const handler = createClassHandler({
    store: {
      listObjects: async () => []
    }
  });
  const res = mockResponse();

  try {
    await handler({ method: 'GET', query: { path: ['shuoshuo'] } }, res);
  } finally {
    if (originalAllowOrigin === undefined) delete process.env.ALLOW_ORIGIN;
    else process.env.ALLOW_ORIGIN = originalAllowOrigin;
  }

  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
});

test('sendJson echoes matching origins from ALLOW_ORIGIN', async () => {
  const originalAllowOrigin = process.env.ALLOW_ORIGIN;
  process.env.ALLOW_ORIGIN = 'https://blog.example.com, https://admin.example.com/';
  const handler = createClassHandler({
    store: {
      listObjects: async () => []
    }
  });
  const res = mockResponse();

  try {
    await handler({
      method: 'GET',
      headers: { origin: 'https://admin.example.com' },
      query: { path: ['shuoshuo'] }
    }, res);
  } finally {
    if (originalAllowOrigin === undefined) delete process.env.ALLOW_ORIGIN;
    else process.env.ALLOW_ORIGIN = originalAllowOrigin;
  }

  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://admin.example.com');
  assert.equal(res.headers.Vary, 'Origin');
});

test('login handler returns LeanCloud-like mismatch errors', async () => {
  const handler = createLoginHandler({
    store: {
      findUserByUsername: async () => ({ password_hash: 'bad', password_salt: 'bad' })
    }
  });
  const res = mockResponse();

  await handler({
    method: 'POST',
    body: { username: 'admin', password: 'wrong' }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'The username and password mismatch.');
});
