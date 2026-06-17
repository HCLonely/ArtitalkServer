const { createMeHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function me(req, res) {
  if (!handler) handler = createMeHandler({ store: createStore() });
  return handler(req, res);
};
