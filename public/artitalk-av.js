(function (global) {
  var config = { serverURL: '' };
  var storageKey = 'artitalk:currentUser';

  function baseUrl() {
    return (config.serverURL || '').replace(/\/$/, '');
  }

  function apiUrl(path, params) {
    var query = params ? '?' + new URLSearchParams(params).toString() : '';
    return baseUrl() + '/api' + path + query;
  }

  function request(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return global.fetch(apiUrl(path, options.params), options).then(function (response) {
      return response.json().then(function (json) {
        if (!response.ok) {
          var error = new Error(json.error || 'Request failed');
          error.rawMessage = json.error;
          throw error;
        }
        return json;
      });
    });
  }

  function inflateObject(className, raw) {
    var object = new AVObject(className, raw.objectId || raw.id);
    object.id = raw.objectId || raw.id;
    object.createdAt = raw.createdAt ? new Date(raw.createdAt) : undefined;
    object.updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : undefined;
    object.attributes = Object.assign({}, raw.attributes || {});
    return object;
  }

  function AVObject(className, id) {
    this.className = className;
    this.id = id;
    this.attributes = {};
  }

  AVObject.prototype.set = function (key, value) {
    this.attributes[key] = value;
  };

  AVObject.prototype.save = function () {
    var method = this.id ? 'PUT' : 'POST';
    var path = '/classes/' + encodeURIComponent(this.className) + (this.id ? '/' + encodeURIComponent(this.id) : '');
    var self = this;
    return request(path, {
      method: method,
      body: JSON.stringify(this.attributes)
    }).then(function (raw) {
      var saved = inflateObject(self.className, raw);
      self.id = saved.id;
      self.createdAt = saved.createdAt;
      self.updatedAt = saved.updatedAt;
      self.attributes = saved.attributes;
      return self;
    });
  };

  AVObject.prototype.destroy = function () {
    return request('/classes/' + encodeURIComponent(this.className) + '/' + encodeURIComponent(this.id), {
      method: 'DELETE'
    });
  };

  function Query(className) {
    this.className = className;
    this._where = {};
    this._order = '';
    this._limit = undefined;
    this._skip = undefined;
  }

  Query.prototype.equalTo = function (key, value) {
    this._where[key] = value;
    return this;
  };

  Query.prototype.descending = function (key) {
    this._order = '-' + key;
    return this;
  };

  Query.prototype.limit = function (value) {
    this._limit = value;
    return this;
  };

  Query.prototype.skip = function (value) {
    this._skip = value;
    return this;
  };

  Query.prototype.find = function () {
    var params = {};
    if (Object.keys(this._where).length) params.where = JSON.stringify(this._where);
    if (this._order) params.order = this._order;
    if (this._limit !== undefined) params.limit = String(this._limit);
    if (this._skip !== undefined) params.skip = String(this._skip);
    var className = this.className;
    return request('/classes/' + encodeURIComponent(className), { params: params }).then(function (json) {
      return (json.results || []).map(function (raw) {
        return inflateObject(className, raw);
      });
    });
  };

  var AV = {
    init: function (options) {
      config = Object.assign({}, config, options || {});
    },
    User: {
      current: function () {
        var raw = global.localStorage && global.localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
      },
      logIn: function (username, password) {
        return request('/login', {
          method: 'POST',
          body: JSON.stringify({ username: username, password: password })
        }).then(function (user) {
          if (global.localStorage) global.localStorage.setItem(storageKey, JSON.stringify(user));
          return user;
        });
      },
      logOut: function () {
        if (global.localStorage) global.localStorage.removeItem(storageKey);
        return request('/logout', { method: 'POST' });
      }
    },
    Object: {
      extend: function (className) {
        return function LeanCloudObject() {
          AVObject.call(this, className);
        };
      },
      createWithoutData: function (className, id) {
        return new AVObject(className, id);
      }
    },
    Query: Query
  };

  AV.Object.extend = function (className) {
    function LeanCloudObject() {
      AVObject.call(this, className);
    }
    LeanCloudObject.prototype = Object.create(AVObject.prototype);
    LeanCloudObject.prototype.constructor = LeanCloudObject;
    return LeanCloudObject;
  };

  global.AV = AV;
})(typeof window !== 'undefined' ? window : globalThis);
