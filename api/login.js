const { createLoginHandler } = require('../lib/api');
const { createStore } = require('../lib/store');

let handler;

module.exports = function login(req, res) {
  if (!handler) handler = createLoginHandler({ store: createStore() });
  return handler(req, res);
};
