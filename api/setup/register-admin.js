const { createSetupRegisterAdminHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function setupRegisterAdmin(req, res) {
  if (!handler) handler = createSetupRegisterAdminHandler({ store: createStore() });
  return handler(req, res);
};
