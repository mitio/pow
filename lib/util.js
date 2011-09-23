(function() {
  var LineBuffer, Stream, async, exec, fs, path, spawn;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __slice = Array.prototype.slice, __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  };
  fs = require("fs");
  path = require("path");
  async = require("async");
  exec = require("child_process").exec;
  spawn = require("child_process").spawn;
  Stream = require('stream').Stream;
  exports.LineBuffer = LineBuffer = (function() {
    __extends(LineBuffer, Stream);
    function LineBuffer(stream) {
      var self;
      this.stream = stream;
      this.readable = true;
      this._buffer = "";
      self = this;
      this.stream.on('data', function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return self.write.apply(self, args);
      });
      this.stream.on('end', function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return self.end.apply(self, args);
      });
    }
    LineBuffer.prototype.write = function(chunk) {
      var index, line, _results;
      this._buffer += chunk;
      _results = [];
      while ((index = this._buffer.indexOf("\n")) !== -1) {
        line = this._buffer.slice(0, index);
        this._buffer = this._buffer.slice(index + 1, this._buffer.length);
        _results.push(this.emit('data', line));
      }
      return _results;
    };
    LineBuffer.prototype.end = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (args.length > 0) {
        this.write.apply(this, args);
      }
      if (this._buffer.length) {
        this.emit('data', this._buffer);
      }
      return this.emit('end');
    };
    return LineBuffer;
  })();
  exports.bufferLines = function(stream, callback) {
    var buffer;
    buffer = new LineBuffer(stream);
    buffer.on("data", callback);
    return buffer;
  };
  exports.mkdirp = function(dirname, callback) {
    var p;
    return fs.lstat((p = path.normalize(dirname)), function(err, stats) {
      var paths;
      if (err) {
        paths = [p].concat((function() {
          var _results;
          _results = [];
          while (p !== "/" && p !== ".") {
            _results.push(p = path.dirname(p));
          }
          return _results;
        })());
        return async.forEachSeries(paths.reverse(), function(p, next) {
          return path.exists(p, function(exists) {
            if (exists) {
              return next();
            } else {
              return fs.mkdir(p, 0755, function(err) {
                if (err) {
                  return callback(err);
                } else {
                  return next();
                }
              });
            }
          });
        }, callback);
      } else if (stats.isDirectory()) {
        return callback();
      } else {
        return callback("file exists");
      }
    });
  };
  exports.chown = function(path, owner, callback) {
    var chown, error;
    error = "";
    chown = spawn("chown", [owner, path]);
    chown.stderr.on("data", function(data) {
      return error += data.toString("utf8");
    });
    return chown.on("exit", function(code) {
      return callback(error, code === 0);
    });
  };
  exports.pause = function(stream) {
    var event, eventsToMute, l, mutedListeners, onClose, onData, onEnd, onNewListener, originalRemoveListener, queue, removeListenerOf, removeListeners, _i, _len;
    queue = [];
    mutedListeners = {};
    eventsToMute = ['data', 'newListener'];
    for (_i = 0, _len = eventsToMute.length; _i < _len; _i++) {
      event = eventsToMute[_i];
      mutedListeners[event] = (function() {
        var _j, _len2, _ref, _results;
        _ref = stream.listeners(event);
        _results = [];
        for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
          l = _ref[_j];
          _results.push(l);
        }
        return _results;
      })();
      stream.removeAllListeners(event);
    }
    onData = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return queue.push(['data'].concat(__slice.call(args)));
    };
    onEnd = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return queue.push(['end'].concat(__slice.call(args)));
    };
    onClose = function() {
      return removeListeners();
    };
    removeListenerOf = function(emitter, event, listener) {
      var index, listeners, _ref;
      listeners = emitter.listeners(event);
      index = listeners.indexOf(listener);
      if (index > -1) {
        return ([].splice.apply(listeners, [index, index - index + 1].concat(_ref = [])), _ref);
      }
    };
    originalRemoveListener = stream.removeListener;
    stream.removeListener = function(event, listener) {
      var l;
      if (__indexOf.call(eventsToMute, event) >= 0) {
        return mutedListeners[event] = (function() {
          var _j, _len2, _ref, _results;
          _ref = mutedListeners[event];
          _results = [];
          for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
            l = _ref[_j];
            if (l !== listener) {
              _results.push(l);
            }
          }
          return _results;
        })();
      } else {
        return removeListenerOf(stream, event, listener);
      }
    };
    onNewListener = function(event, listener) {
      if (__indexOf.call(eventsToMute, event) >= 0) {
        mutedListeners[event].push(listener);
        return removeListenerOf(stream, event, listener);
      }
    };
    removeListeners = function() {
      stream.removeListener = originalRemoveListener;
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('close', onClose);
      return stream.removeListener('newListener', onNewListener);
    };
    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('close', onClose);
    stream.on('newListener', onNewListener);
    return function() {
      var args, event, listener, _j, _k, _l, _len2, _len3, _len4, _ref, _results;
      removeListeners();
      for (_j = 0, _len2 = eventsToMute.length; _j < _len2; _j++) {
        event = eventsToMute[_j];
        _ref = mutedListeners[event];
        for (_k = 0, _len3 = _ref.length; _k < _len3; _k++) {
          listener = _ref[_k];
          if (listener) {
            stream.on(event, listener);
          }
        }
      }
      _results = [];
      for (_l = 0, _len4 = queue.length; _l < _len4; _l++) {
        args = queue[_l];
        _results.push(stream.emit.apply(stream, args));
      }
      return _results;
    };
  };
  exports.sourceScriptEnv = function(script, env, options, callback) {
    var command;
    if (options.call) {
      callback = options;
      options = {};
    } else {
      if (options == null) {
        options = {};
      }
    }
    command = "" + options.before + ";\nsource '" + script + "' > /dev/null;\n'" + process.execPath + "' -e 'JSON.stringify(process.env)'";
    return exec(command, {
      cwd: path.dirname(script),
      env: env
    }, function(err, stdout, stderr) {
      if (err) {
        err.message = "'" + script + "' failed to load";
        err.stdout = stdout;
        err.stderr = stderr;
        callback(err);
      }
      try {
        return callback(null, JSON.parse(stdout));
      } catch (exception) {
        return callback(exception);
      }
    });
  };
}).call(this);
