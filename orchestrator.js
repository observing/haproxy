'use strict';

var run = require('child_process').exec
  , format = require('util').format
  , fs = require('fs');

/**
 * Options:
 *
 * - pid: The pid file
 * - pidFile: The location of the pid file
 * - config: The location of the configuration file
 * - [optional] which: The location of the haproxy
 *
 * @constructor
 * @param {Object} options Orchestrator configuration.
 * @api public
 */
function Orchestrator(options) {
  options = options || {};

  this.which = options.which || require('which').sync('haproxy');
  this.pid = options.pid || null;
  this.pidfile = options.pidfile;
  this.config = options.config;

  //
  // If we don't know the pid, we should read out the file.
  //
  if (!this.pid) this.read();
}

/**
 * A little execution helper which automatically formats our "template".
 *
 * @param {String} template The arguments
 * @param {Function} callback The last supplied argument is always the callback
 * @api private
 */
Orchestrator.prototype.run = function ran() {
  var args = Array.prototype.slice.call(arguments, 0)
    , template = args.shift()
    , callback = args.pop();

  //
  // update the `haproxy` part with a the actual location of the binary. We just
  // use it for the sake of readability.
  //
  if (template.indexOf('haproxy') === 0) {
    template = this.which + template.slice(7);
  }

  run(format.apply(format, args), function execution() {

  });

  return this;
};

/**
 * Start HAProxy demonized.
 *
 * @param {Functon} fn Callback.
 * @api public
 */
Orchestrator.prototype.start = function start(fn) {
  //
  // We always launch HAProxy with a pidFile location. If we don't have one, we
  // will default to a common location for pid files.
  //
  if (!this.pidFile) this.pidFile = '/var/run/haproxy.pid';

  return this.run('haproxy -D -f %s -p %s', this.pidFile, function ran(err) {

  });
};

/**
 * Stop the running HAProxy server.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.stop = function stop(fn) {
  if (this.pid) return this.run('kill %s', this.pid, function ran(err) {
    if (err) return this.run('kill -9 %s', this.pid, function again(err) {

    });
  });

  return this.run('killall haproxy', function ran(err) {

  });
};

/**
 * Reload the server without booting the clients.
 *
 * @param {Boolean} hard Hard reload.
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.reload = function reload(hard, fn) {
  var cmd = 'haproxy -D -f %s -p %s -sf %s';
  if (hard) cmd = 'haproxy -D -f %s -p %s -st %s';

  return this.run(cmd, this.config, this.pidFile, this.pid, function ran() {

  });
};

/**
 * Verify the given configuration to see if it's in working order.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.verify = function verify(fn) {
  return this.run('haproxy -c -f %s', this.config, function ran() {

  });
};

/**
 * Check if there's a HAProxy instance running.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.running = function running(fn) {
  return this.run('ps -p %s -o command', this.pid, function ran() {

  });
};

/**
 * Read out the process id a.k.a. pid file.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.read = function read(fn) {
  if (this.pidFile) {
    fs.readFile(this.pidFile, function reader() {

    }.bind(this));
    return this;
  }

  //
  // We don't have a pid file, so maybe we have a process running.
  //
  return this.run('ps x -o command | grep haproxy', function find() {

  });
};

//
// Expose the HAProxy orchestrator.
//
module.exports = Orchestrator;
