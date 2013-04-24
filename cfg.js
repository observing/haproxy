'use strict';

var path = require('path')
  , fs = require('fs');

//
// Empty function that is used as callbak replacement
//
function noop() {}

/**
 * The actual configuration interface.
 *
 * @constructor
 * @api public
 */
function Configuration() {
  this.data = Object.create(null);
  this.source = '';

  this.composer = new Composer(this);
  this.parser = new Parser(this);
}

Configuration.prototype.__proto__ = require('events').EventEmitter;

/**
 * Read out a configuration file and parse it for conversion.
 *
 * @param {String} location The path to the configuration file.
 * @param {Function} fn Callback
 * @returns {Configuration}
 */
Configuration.prototype.read = function read(location, fn) {
  var type = path.extname(location).substr(1)
    , self = this;

  fn = fn || noop;

  if (!(type in this.parser)) {
    fn.call(this, new Error('Invalid file, no parser for this extension'));
    return this;
  }

  fs.readFile(location, 'utf-8', function read(err, source) {
    if (err) return fn(err);

    //
    // Set the `source` and emit the `read` event with file extension so it can
    // start with parsing the original file's source. After everything is parsed
    // we can call the supplied callback which can process things further.
    //
    self.source = source;
    self.emit('read', type);

    fn(err, source);
  });

  return this;
};

//
// Expose the Parse and Constructor instances so they can be easily extended by
// a third party as well as provide an interface for easy testing.
//
Configuration.Parser = Parser;
Configuration.Composer = Composer;

//
// Export the Configuration.
//
module.exports = Configuration;
