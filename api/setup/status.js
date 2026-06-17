const { createSetupStatusHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function setupStatus(req, res) {
  if (!handler) handler = createSetupStatusHandler({ store: createStore() });
  return handler(req, res);
};
