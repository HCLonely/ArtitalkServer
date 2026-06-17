const assert = require('node:assert/strict');
const test = require('node:test');

const { parseLeanCloudJsonl } = require('../lib/import-jsonl');

test('parseLeanCloudJsonl skips non-json lines and returns parsed records', () => {
  const records = parseLeanCloudJsonl('# leancloud export\n{"objectId":"talk1","createdAt":"2024-01-01T00:00:00.000Z"}\n\n{"objectId":"talk2"}\n');

  assert.deepEqual(records, [
    { objectId: 'talk1', createdAt: '2024-01-01T00:00:00.000Z' },
    { objectId: 'talk2' }
  ]);
});
