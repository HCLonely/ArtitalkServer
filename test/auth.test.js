const assert = require('node:assert/strict');
const test = require('node:test');

const { createPasswordHash, verifyPassword } = require('../lib/auth');

test('verifyPassword accepts the matching password and rejects a different password', async () => {
  const stored = await createPasswordHash('correct horse battery staple');

  assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  assert.equal(await verifyPassword('wrong-password', stored), false);
});
