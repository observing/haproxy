'use strict';

var readFile = require('fs').readFileSync
  , path = require('path');

/**
 * Small helper function for reading out files.
 *
 * @param {String} file The file name that should be read without extension.
 * @returns {Buffer} The response the mockup server should give for the command
 * @api private
 */
function read(file) {
  return readFile(path.resolve(__dirname, file + '.out'));
}

//
// A simple object where the key is the command that will be received by the
// server and the value is the output it should return to the socket.
//
module.exports = {
  'show info': read('showinfo'),
  'show stat': read('showstat'),
  'show stat -1 -1 -1': read('showstatall'),
  'show stat parsed': require('./showstat-parsed'),
  'show sess': read('showsess'),

  'clear counters': read('empty'),
  'clear counters all': read('empty'),

  'disable server realtime/node1': read('empty'),
  'disable server realtime/node2': read('noserver'),
  'disable server realtimer/node1': read('nobackend'),

  'enable server realtime/node1': read('empty'),
  'enable server realtime/node2': read('noserver'),
  'enable server realtimer/node1': read('nobackend'),
  'get weight foo/bar': read('weight-initial')
};
