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
