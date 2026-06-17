const { createClassHandler } = require('../../../lib/api');
const { createStore } = require('../../../lib/store');

let handler;

module.exports = function shuoshuoObject(req, res) {
  if (!handler) handler = createClassHandler({ store: createStore() });
  req.query = {
    ...(req.query || {}),
    path: ['shuoshuo', req.query && req.query.objectId]
  };
  return handler(req, res);
};
