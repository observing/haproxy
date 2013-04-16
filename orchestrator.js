'use strict';

var run = require('child_process').exec;

function Orchestrator(options) {
  options = options || {};

  this.which = options.which || require('which').sync('haproxy');
}

//
// Expose the HAProxy orchestrator
//
module.exports = Orchestrator;
