const { createClassHandler } = require('../../lib/api');
const { createStore } = require('../../lib/store');

let handler;

module.exports = function classes(req, res) {
  if (!handler) handler = createClassHandler({ store: createStore() });
  return handler(req, res);
};
