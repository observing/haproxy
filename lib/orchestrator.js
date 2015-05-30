'use strict';

var run = require('child_process').exec
  , format = require('util').format
  , mkdirp = require('mkdirp')
  , path = require('path')
  , fs = require('fs')
  , undef;

/**
 * Orchestrator is a haproxy interface that allows you to run and interact with
 * the `haproxy` binary.
 *
 * Options:
 *
 * - pid: The pid file
 * - pidFile: The location of the pid file
 * - config: The location of the configuration file
 * - [optional] discover: Tries to find your HAProxy instance if you don't know the pid
 * - [optional] which: The location of the haproxy
 *
 * @constructor
 * @param {Object} options Orchestrator configuration.
 * @api public
 */
function Orchestrator(options) {
  if (!(this instanceof Orchestrator)) return new Orchestrator(options);

  options = options || {};

  this.which = options.which || require('which').sync('haproxy');
  this.pid = options.pid || '';
  this.pidFile = options.pidFile || '';
  this.config = options.config;
  this.discover = options.discover || false;
  this.prefix = options.prefix || '';

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
    , template = args.shift();

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

  if (this.prefix) {
    cmd = this.prefix + ' ' + cmd;
  }

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
  fn = fn.bind(this);

  //
  // We always launch HAProxy with a pidFile location. If we don't have one, we
  // will default to a common location for pid files.
  //
  if (!this.pidFile) this.pidFile = '/var/run/haproxy.pid';

  //
  // Ensure that our pidFile actually existst.
  //
  var pidDir = path.dirname(this.pidFile);
  if (!fs.existsSync(pidDir)) try {
    mkdirp.sync(pidDir);
  } catch (e) { return fn(e); }

  return this.verify(function verified(err) {
    if (err) return fn(err);

    this.run('haproxy -D -f %s -p %s', this.config, this.pidFile, function ran(err, res, cmd) {
      //
      // It could be that it outputs some warnings
      //
      if (err && !err.stderr) return fn(err, undef, cmd);
      var warnings = err && err.stderr ? err.stderr : undef;

      this.read(function reader() {
        //
        // We don't really care if we got errors or not.
        //
        fn(undef, warnings, cmd);
      });
    });
  });
};

/**
 * Stop the running HAProxy server, this is done with force and will not wait
 * until connections have been closed.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.stop = function stop(all, fn) {
  if ('function' === typeof all) {
    fn = all;
    all = null;
  }

  fn = fn.bind(this);

  if (this.pid && !all) return this.run('kill %s', this.pid, function ran(err, output, cmd) {
    if (err) return this.run('kill -9 %s', this.pid, function again(err, output, cmd) {
      if (err) return fn(err, undef, cmd);

      this.pid = '';
      fn(undef, !output, cmd);
    });

    this.pid = '';
    fn(undef, !output, cmd);
  });

  return this.run('killall haproxy', function ran(err, output, cmd) {
    if (err) return fn(err, undef, cmd);

    this.pid = '';
    fn(undef, !output, cmd);
  });
};

/**
 * Issue a softstop for the load balancers so they gracefully stop the process.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.softstop = function softstop(fn) {
  return this.run('killall -USR1 haproxy', function ran(err, output, cmd) {
    if (err) return fn(err, undef, cmd);

    //
    // Poll for process death.
    //
    (function piddy() {
      this.running(function running(err, alive) {
        if (err) return fn(err, undef, cmd);
        if (alive) return setTimeout(piddy.bind(this), 100);

        this.pid = '';
        fn(undef, true, cmd);
      });
    }.bind(this))();
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
  if ('function' === typeof hard) {
    fn = hard;
    hard = null;
  }

  fn = fn.bind(this);

  var cmd = 'haproxy -D -f %s -p %s -sf %s';
  if (hard) cmd = 'haproxy -D -f %s -p %s -st %s';

  return this.verify(function verified(err) {
    if (err) return fn(err);

    var current = this.pid;

    this.run(cmd, this.config, this.pidFile, current, function ran(err, res, cmd) {
      if (err) return fn(err);

      //
      // Poll for the change of pid.
      //
      (function piddy() {
        this.read(function read(err, pid) {
          if (err) return fn(err, undef, cmd);
          if (pid !== current) return fn(undef, true, cmd);

          setTimeout(piddy.bind(this), 100);
        });
      }.bind(this))();
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
  fn = fn.bind(this);

  return this.run('haproxy -c -f %s', this.config, function verified(err, res, cmd) {
    fn(undefined, !err && !!res, cmd);
  });
};

/**
 * Check if there's a HAProxy instance running.
 *
 * @param {Function} fn Callback.
 * @api public
 */
Orchestrator.prototype.running = function running(fn) {
  fn = fn.bind(this);

  // We don't have a pid, fetch it and re-retry
  if (!this.pid) return this.read(function read(err, pid) {
    if (err || !pid) return fn(undef, false);
    if (this.pid) return this.running(fn);

    // We don't have a pid or we were unable to find it which is probably an
    // indication of no processes live, no need to continue onwards!
    fn(undef, false);
  });

  return this.run('ps -p %s -o args=', this.pid, function ran(err, res, cmd) {
    fn(undef, !err, cmd);
  });
};

/**
 * Read out the process id a.k.a. pid file.
 *
 * @param {Function} fn Callback.
 * @api private
 */
Orchestrator.prototype.read = function read(fn) {
  if (fn) fn = fn.bind(this);

  if (this.pidFile) {
    fs.readFile(this.pidFile, 'utf-8', function reader(err, pid, cmd) {
      this.pid = (pid || '').trim();

      if (fn) fn(err, this.pid, cmd);
    }.bind(this));
    return this;
  }

  //
  // Check if we have a process running if we don't have a pidFile. The command
  // will return an error when nothing exists.
  //
  return this.run('pgrep haproxy', function find(err, processes, cmd) {
    if (err) return fn && fn(err, undef, cmd);

    this.pid = (processes.split('\n')[0] || '').trim();
    if (fn) fn(undef, this.pid, cmd);
  });
};

//
// Expose the HAProxy orchestrator.
//
module.exports = Orchestrator;
