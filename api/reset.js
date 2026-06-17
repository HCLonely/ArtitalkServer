const { createResetHandler } = require('../lib/api');
const { createStore } = require('../lib/store');

let handler;

module.exports = function reset(req, res) {
  if (!handler) handler = createResetHandler({ store: createStore() });
  return handler(req, res);
};
