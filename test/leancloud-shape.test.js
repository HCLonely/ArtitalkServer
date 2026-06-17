const assert = require('node:assert/strict');
const test = require('node:test');

const { rowToLeanCloudObject, publicUserFromRow } = require('../lib/leancloud-shape');

test('rowToLeanCloudObject returns LeanCloud-compatible object shape', () => {
  const shaped = rowToLeanCloudObject({
    object_id: 'abc123',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    data: { atContentMd: 'hello', avatar: 'https://example.com/a.png' }
  });

  assert.equal(shaped.id, 'abc123');
  assert.equal(shaped.objectId, 'abc123');
  assert.equal(shaped.createdAt, '2024-01-01T00:00:00.000Z');
  assert.equal(shaped.updatedAt, '2024-01-02T00:00:00.000Z');
  assert.deepEqual(shaped.attributes, {
    atContentMd: 'hello',
    avatar: 'https://example.com/a.png'
  });
});

test('publicUserFromRow omits password hash fields', () => {
  const user = publicUserFromRow({
    object_id: 'u1',
    username: 'admin',
    img: 'https://example.com/avatar.png',
    password_hash: 'secret',
    password_salt: 'secret-salt',
    session_token: 'token'
  });

  assert.deepEqual(user, {
    id: 'u1',
    objectId: 'u1',
    sessionToken: 'token',
    attributes: {
      username: 'admin',
      img: 'https://example.com/avatar.png'
    }
  });
});
