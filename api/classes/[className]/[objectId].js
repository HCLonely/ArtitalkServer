const { createClassHandler } = require('../../../lib/api');
const { createStore } = require('../../../lib/store');

let handler;

module.exports = function classObject(req, res) {
  if (!handler) handler = createClassHandler({ store: createStore() });
  req.query = req.query || {};
  req.query.path = [req.query.className, req.query.objectId];
  return handler(req, res);
};
