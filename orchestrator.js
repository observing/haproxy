'use strict';

var run = require('child_process').exec
  , format = require('util').format;

function Orchestrator(options) {
  options = options || {};

  this.which = options.which || require('which').sync('haproxy');
  this.pid = options.pid || null;
  this.config = options.config;
}

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

};

Orchestrator.prototype.start = function start() {
  this.run('haproxy -D -f %s -p %s', function ran(err) {

  });
};

Orchestrator.prototype.stop = function stop() {
  if (this.pid) return this.run('kill %s', this.pid, function ran(err) {
    if (err) return this.run('kill -9 %s', this.pid, function again(err) {

    });
  });

  this.run('killall haproxy', function ran(err) {

  });
};

Orchestrator.prototype.reload = function reload() {
  this.run('haproxy -f %s -sf %s', this.config, this.pid, function ran() {

  });
};

Orchestrator.prototype.verify = function verify() {
  this.run('haproxy -c -f %s', this.config, function ran() {

  });
};

Orchestrator.prototype.running = function running() {
  this.run('ps -p %s -o command', this.pid, function ran() {

  });
};

//
// Expose the HAProxy orchestrator
//
module.exports = Orchestrator;
