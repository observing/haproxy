'use strict';

var EventEmitter = require('events').EventEmitter
  , Configuration = require('./lib/configuration')
  , Orchestrator = require('./lib/orchestrator')
  , format = require('util').format
  , net = require('net')
  , dsv = require('dsv')
  , fs = require('fs');

//
// Default function.
//
function noop() {}

//
// Store a reference to Array.prototype.slice as it's used for argument
// conversion.
//
var slice = Array.prototype.slice;

/**
 * Control your HAProxy servers using the unix domain socket. This module is
 * based upon the 1.5 branch socket.
 *
 * Options:
 *
 * - pid: The process id
 * - pidFile: The location of the pid file
 * - config: The location of the configuration file
 * - discover: Tries to find your HAProxy instance if you don't know the pid
 * - socket: The location of the unix socket
 * - [optional] which: The location of the haproxy
 *
 * @see http://cbonte.github.io/haproxy-dconv/configuration-1.5.html#9.2
 *
 * @constructor
 * @param {String} socket Path to the unix domain socket
 * @param {Object} options Configuration
 * @api public
 */
function HAProxy(socket, options) {
  if (!(this instanceof HAProxy)) return new HAProxy(socket, options);

  options = options || {};

  //
  // Allow variable arguments, with socket path or just custom options.
  //
  if ('object' === typeof socket) {
    options = socket;
    socket = options.socket || null;
  }

  this.socket = socket || '/tmp/haproxy.sock';                // Path to socket
  this.cfg = options.config || '/etc/haproxy/haproxy.cfg'; // Config location

  //
  // Create a new `haproxy` orchestrator which interacts with the binary.
  //
  this.orchestrator = new Orchestrator({
    discover: options.discover,
    pidFile: options.pidFile,
    prefix: options.prefix,
    which: options.which,
    pid: options.pid,
    config: this.cfg
  });
}

HAProxy.prototype.__proto__ = EventEmitter.prototype;

/**
 * Lazy initialize the configuration.
 *
 * @api private
 */
Object.defineProperty(HAProxy.prototype, 'config', {
  get: function get() {
    this.config = new Configuration();
    return this.config;
  },
  set: function set(value) {
    Object.defineProperty(this, 'config', { value: value, writable: true });
    return value;
  }
});

/**
 * Send a command to the HAProxy socket.
 *
 * @param {String} command The command template
 * @api private
 */
HAProxy.prototype.send = function send(command) {
  var socket = net.connect(this.socket)
    , using = 'object'
    , buffer = ''
    , self = this
    , fn = noop;

  //
  // Format the command.
  //
  command = format.apply(format, arguments).replace(/\%[sdj]/g, '').trim();

  //
  // Set the correct encoding so we don't break on utf-8 chars while we are
  // buffering the response.
  //
  socket.setEncoding('utf8');

  socket.once('connect', function connect() {
    socket.end(command +'\n');
  }).on('data', function data(chunk) {
    buffer += chunk;
  }).once('error', function error(err) {
    fn.call(self, err);

    //
    // We've received an error on the socket, bailout, close the connection and
    // just override the callback so we don't execute it twice.
    //
    socket.destroy();   // Nuke the socket, just for fun.
    buffer = '';        // Kill the buffer, saves memory.
    fn = noop;          // Prevent double callback.

    //
    // If it has failed to connect we want to emit that the proxy as we assume
    // that the proxy should always be alive and kicking with a socket.. Or you
    // wouldn't be using the module. We need to check for the syscall because
    // there are to much error codes to take care of
    //
    if (err.syscall === 'connect') {
      self.emit('haproxy:down', err);
    }
  }).once('end', function end() {
    self.parse(using, buffer.trim(), fn, command);
    buffer = '';
  });

  return {
    /**
     * Set the callback function for the command. By doing this later we can
     * have fire & forget functionality. Or just a better API;
     *
     * @param {Function} callback The callback for the command.
     * @returns {Object} The callback sugar.
     * @api public
     */
    call: function call(callback) {
      if ('function' === typeof callback) fn = callback;
      return this;
    },

    /**
     * Add a custom response parser.
     *
     * @param {String} parser How should the response be parsed?
     * @api private
     */
    using: function as(parser) {
      if (parser) using = parser;

      return this;
    },

    /**
     * Chain support:
     *
     *   haproxy.clear().and.disable(backend, server).and.pause(backend, server);
     *
     * It just returns a reference to the `haproxy` instance.
     *
     * @type {HAProxy}
     */
    and: self
  };
};

/**
 * Parses the response from the HAProxy socket.
 *
 * @param {String} using How should the data be parsed
 * @param {String} buffer The response from the socket
 * @param {Functon} fn Callback function.
 * @param {String} command The command that issued this.
 * @api private
 */
HAProxy.prototype.parse = function parse(using, buffer, fn, command) {
  var result, err;

  //
  // Received an emptry response from the socket
  //
  if (!buffer) return fn.call(this, undefined, true);

  if ('csv' === using ) {
    //
    // The column of the csv is commented, so we have to remove the first to
    // chars from the buffer so we have a correct column for the csv and then we
    // can actually parse it
    //
    result = dsv.csv.parse(buffer.slice(2)).map(function cleanup(row) {
      delete row[''];
      return row;
    });
  } else if (using === 'string') {
    result = buffer.toString();
  } else if (using === 'array') {
    result = buffer.split('\n').map(function (line) { return line.trim(); });
  } else if (typeof using === 'function') {
    result = using(buffer);
  } else if (~buffer.indexOf('\n')) {
    result = buffer.split('\n').reduce(function reducer(data, line) {
      line = line.trim();
      if (!line) return data;

      //
      // Figure out how we are going to parse the response. Nearly every
      // response from thing thing requires a dedicated parser ._. because fuck
      // consistency right?
      //
      if ('object' === using) {
        var kv = line.split(':');
        if(kv.length === 1) {
          data[kv[0]] = '';
        } else {
          kv[1] = kv[1].trim();
          data[kv[0]] = !isNaN(+kv[1]) ? +kv[1] : kv[1];
        }
      }

      return data;
    }, {});
  } else if (~buffer.indexOf('initial')) {
    var data = /(\d*)\s\(initial\s(\d*)\)/.exec(buffer);
    result = { current: +data[1], initial: +data[2] };
  } else {
    err = new Error(buffer);
    err.command = command;
    buffer = result;
  }

  fn.call(this, err, result || buffer);
};

/**
 * Clear the max values of the statistic counts in each proxy (frontend
 * & backend) and in each server.
 *
 * If you clean `all` stats, it will have the same effect as restarting.
 *
 * @param {Boolean} all Do we need to flush all counters.
 * @param {Function} fn Callback
 * @api public
 */
HAProxy.prototype.clear = function clear(all, fn) {
  if ('function' === typeof all) {
    fn = all;
    all = null;
  }

  return this.send('clear counters %s', all ? 'all' : '').call(fn);
};

/**
 * Mark the server as DOWN for maintance. In this mode no checks will be
 * performed on the server until it leaves maintenance.
 *
 * @param {String} backend Name of the backend server.
 * @param {String} server The server that needs to be disabled in the backend.
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.disable = function disable(backend, server, fn) {
  return this.send('disable server %s/%s', backend || '', server || '').call(fn);
};

/**
 * If the server was previously marked as DOWN, this marks the server as UP and
 * all checks are re-enabled.
 *
 * @param {String} backend Name of the backend.
 * @param {String} server The server that needs to be disabled in the backend.
 * @param {Function} fn Callback
 * @api public
 */
HAProxy.prototype.enable = function enable(backend, server, fn) {
  return this.send('enable server %s/%s', backend, server).call(fn);
};

/**
 * Mark the frontend as temporarilty stopped. This corresponds to the mode which
 * is used during a soft restart. THe frontend releases the port but it can be
 * enabled again if needed.
 *
 * @param {String} frontend The frontend that needs to be paused.
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.pause = function pause(frontend, fn) {
  return this.send('disable frontend %s', frontend).call(fn);
};

/**
 * Resume a frontend which was temporarily stopped.
 *
 * @param {String} frontend The frontend that needs to resume again.
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.resume = function resume(frontend, fn) {
  return this.send('enable frontend %s', frontend || '').call(fn);
};

/**
 * Show the server errors.
 *
 * @TODO requires custom
 * @param {String} id Only show the errors for this backend/frontend.
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.errors = function errors(id, fn) {
  if ('function' === typeof id) {
    fn = id;
    id = null;
  }

  return this.send('show errors %s', id || '').using('error').call(fn);
};

/**
 * Get the current weight and the initial weight of the server. The initial
 * weight is the weight that was specified in the configuration.
 *
 * @param {String} backend Name of the backend.
 * @param {String} server Address of the server.
 * @param {String} weight Weight of the server
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.weight = function weights(backend, server, weight) {
  var args = slice.call(arguments, 0)
    , fn;

  //
  // Check if we have an optional callback function so it's easier to determin
  // if we are setting or getting.
  //
  if ('function' === typeof args[args.length - 1]) fn = args.pop();

  if (args.length === 3) {
    return this.send('set weight %s/%s %d', backend, server, +weight).call(fn);
  }

  return this.send('get weight %s/%s', backend, server).call(fn);
};

/**
 * Dynamically change the specified frontend's maxconn setting.
 *
 * @param {String} frontend Name of the frontend
 * @param {Number} value The new maxconn
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.maxconn = function maxconn(frontend, value) {
  var args = slice.call(arguments, 0)
    , fn;

  //
  // Extract the callback function so we can determin if we are doing a global
  // or front-end set
  //
  if ('function' === typeof args[args.length - 1]) fn = args.pop();

  if (args.length === 2) {
    return this.send('set maxconn frontend %s %d', frontend, +value).call(fn);
  }

  return this.send('set maxconn global %d', +value).call(fn);
};

/**
 * Change the process-wide connection rate limit. Setting 0 disables the
 * limitation.
 *
 * @param {Number} value Connection rate limit
 * @param {Function} fn Callback
 * @api public
 */
HAProxy.prototype.ratelimit = function connections(value, fn) {
  return this.send('set rate-limit connections global %d', +value).call(fn);
};

/**
 * Change the maximum input compression rate.
 *
 * @param {Number} value The number of kilobytes per second
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.compression = function compression(value, fn) {
  return this.send('set rate-limit http-compression global %d', +value).call(fn);
};

/**
 * Dumps information about the haproxy status.
 *
 * @param {Function} fn Callback.
 * @api public
 */
HAProxy.prototype.info = function info(fn) {
  return this.send('show info').using('object').call(fn);
};

/**
 * Dump all known sessions if no session id is provided. If a session id is
 * provided only that information is fetched.
 *
 * @param {String} id Session id
 * @param {Function} fn Callback
 * @api public
 */
HAProxy.prototype.session = function session(id, fn) {
  if ('function' === typeof id) {
    fn = id;
    id = null;
  }

  return this.send('show sess %s', id || '').call(fn);
};

/**
 * Dump statistics in the CSV formation. By passing id, type and sid it's
 * possible to dump only selected items.
 *
 * @param {Number} id The proxy id, -1 to dump everything
 * @param {Number} type 1 for frontend, 2 for backend, 4 for servers, -1 for all
 * @param {String} sid Server id or -1 for everything.
 * @param {Function} fn Callback
 * @api public
 */
HAProxy.prototype.stat = function stat() {
  var args = slice.call(arguments, 0)
    , id = -1
    , type = -1
    , sid = 1
    , fn;

  if ('function' === typeof args[args.length - 1]) fn = args.pop();

  id = +args.shift();   // Assume that the first arg is the id
  type = +args.shift(); // This would be the next arg
  sid = +args.shift();  // And yet another args, omg it's amazing

  return this.send('show stat %d %d %d', id || -1, type || -1, sid || -1)
    .using('csv')
    .call(fn);
};

/**
 * Read the HAProxy configuration file.
 *
 * @param {String} path The location of the config file.
 * @param {Function} fn Optional callback if it needs to be async
 * @api public
 */
HAProxy.prototype.load = HAProxy.prototype.read = function load(path, fn) {
  if ('function' === typeof path) {
     fn = path;
     path = null;
  }

  this.config.read(path || this.cfg, fn);
  return this;
};

/**
 * Save the HAProxy configuration file again.
 *
 * @param {String} path The location of the config file.
 * @param {Function} fn Optional callback if it needs to be async
 * @api public
 */
HAProxy.prototype.save = HAProxy.prototype.write = function save(path, fn) {
  if ('function' === typeof path) {
     fn = path;
     path = null;
  }

  this.config.write(path || this.cfg, fn);
  return this;
};

//
// The following methods are proxied from the Orchestrator. For relevant
// documentation please see the orchestrator.js
//
[
  'start', 'stop', 'softstop', 'reload', 'verify', 'running'
].forEach(function each(method) {
  if (method in HAProxy.prototype) throw new Error('HAProxy#'+ method +' is duplicate');

  HAProxy.prototype[method] = function proxy() {
    var args = slice.call(arguments, 0)
      , self = this
      , fn = noop;

    //
    // Extract the callback as we want to inject it with our own and provi
    //
    if ('function' === typeof args[args.length - 1]) {
      fn = args.pop();
    }

    this.orchestrator[method].apply(this.orchestrator, args.concat(function () {
      fn.apply(self, arguments);
    }));

    return {
      /**
       * Set the callback function for the command. By doing this later we can
       * have fire & forget functionality. Or just a better API;
       *
       * @param {Function} callback The callback for the command.
       * @returns {Object} The callback sugar.
       * @api public
       */
      call: function call(callback) {
        if ('function' === typeof callback) fn = callback;
        return this;
      },

      /**
       * Chain support:
       *
       *   haproxy.start().and.stats().and.pause(backend, server);
       *
       * It just returns a reference to the `haproxy` instance.
       *
       * @type {HAProxy}
       */
      and: self
    };
  };
});

//
// Expose the module.
//
module.exports = HAProxy;
