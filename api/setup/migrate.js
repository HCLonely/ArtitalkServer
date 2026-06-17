const { createSetupMigrateHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function setupMigrate(req, res) {
  if (!handler) handler = createSetupMigrateHandler({ store: createStore() });
  return handler(req, res);
};
