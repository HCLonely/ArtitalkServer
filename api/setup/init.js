const { createSetupInitHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function setupInit(req, res) {
  if (!handler) handler = createSetupInitHandler({ store: createStore() });
  return handler(req, res);
};
