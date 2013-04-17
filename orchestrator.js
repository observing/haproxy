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
 * - discover: Tries to find your HAProxy instance if you don't know the pid
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
  this.pidFile = options.pidFile;
  this.config = options.config;
  this.discover = options.discover || false;

  //
  // Discover a running process.
  //
  if (this.discover && !this.pid) this.read();
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
    , callback = args.pop().bind(this)
    , template = args.shift()
    , undef;

  //
  // update the `haproxy` part with a the actual location of the binary. We just
  // use it for the sake of readability.
  //
  if (template.indexOf('haproxy') === 0) {
    template = this.which + template.slice(7);
  }

  //
  // Parse the template and create the command.
  //
  var cmd = format.apply(format, [template].concat(args)).replace(/\%[sdj]/g, '').trim();

  run(cmd, function execution(err, stdout, stderr) {
    stdout = stdout.toString().trim();
    stderr = stderr.toString().trim();

    if (err) return callback(err, undef, cmd);

    if (stderr.length) {
      err = new Error(stderr);
      err.stderr = true;

      return callback(err, undef, cmd);
    }

    callback(undef, stdout, cmd);
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
  return this.verify(function verified(err) {
    if (err) fn.call(this, err);

    this.run('haproxy -D -f %s -p %s', this.config, this.pidFile, function ran(err) {
      //
      // It could be that it outputs some warnings
      //
      if (err && !err.stderr) return fn.call(this, err);
      var warnings = err && err.stderr ? err.stderr : undefined;

      this.read(function reader() {
        //
        // We don't really care if we got errors or not.
        //
        fn.call(this, undefined, warnings);
      });
    });
  });
};

/**
 * Stop the running HAProxy server.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.stop = function stop(fn) {
  if (this.pid) return this.run('kill %s', this.pid, function ran(err, output) {
    if (err) return this.run('kill -9 %s', this.pid, function again(err, output) {
      if (err) return fn.call(this, err);

      this.pid = null;
      fn.call(this, undefined, !output);
    });

    this.pid = null;
    fn.call(this, undefined, !output);
  });

  return this.run('killall haproxy', function ran(err, output) {
    if (err) return fn.call(this, err);

    this.pid = null;
    fn.call(this, undefined, !output);
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

  return this.verify(function verified(err) {
    if (err) return fn.call(this, err);

    this.run(cmd, this.config, this.pidFile, this.pid, function ran() {

    });
  });
};

/**
 * Verify the given configuration to see if it's in working order.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.verify = function verify(fn) {
  return this.run('haproxy -c -f %s', this.config, fn.bind(this));
};

/**
 * Check if there's a HAProxy instance running.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.running = function running(fn) {
  // We don't have a pid, fetch it and re-retry
  if (!this.pid) return this.read(function read(err, pid) {
    if (err) return fn.call(this, err);
    if (this.pid) return this.running(fn);

    // We don't have a pid or we were unable to find it which is probably an
    // indication of no processes live, no need to continue onwards!
    fn.call(this, undefined, false);
  });

  return this.run('ps -p %s -o args=', this.pid, function ran(err) {
    fn.call(this, undefined, !err);
  });
};

/**
 * Read out the process id a.k.a. pid file.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.read = function read(fn) {
  if (!this.pidFile) {
    fs.readFile(this.pidFile, 'utf-8', function reader(err, pid) {
      this.pid = pid || null;

      if (fn) fn.call(this, err, pid);
    }.bind(this));
    return this;
  }

  //
  // We don't have a pid file, so maybe we have a process running.
  //
  return this.run('ps x -o args=,pid | grep haproxy', function find(err, processes, cmd) {
    if (err) return fn && fn.call(this, err);

    //
    // Parse the process list, we get it returned with <pid> <process>
    //
    processes = processes.split('\n').filter(function filter(process) {
      return !(~process.indexOf('grep haproxy') || !process);
    }).map(function map(process) {
      // @TODO try to parse the arguments out of the process if we don't have
      // a `pidFile` specified.
      return process.split(' ').pop();
    });

    this.pid = processes[0];
    if (fn) fn.call(this, undefined, this.pid);
  });
};

//
// Expose the HAProxy orchestrator.
//
module.exports = Orchestrator;
