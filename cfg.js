'use strict';

var path = require('path')
  , fs = require('fs');

//
// Empty function that is used as callbak replacement
//
function noop() {}

/**
 * Compose different types of configurations from the given
 * `Configuration` instance.
 *
 * @constructor
 * @param {Configuration} config [description]
 * @api private
 */
function Composer(config) {
  this.config = config;
}

/**
 * Automatic JSON conversion when `JSON.stringify(composer)` is used.
 * It automatically removes any commentary from the JSON.
 *
 * @returns {Object} A plain JavaScript object.
 * @api private
 */
Composer.prototype.toJSON = function toJSON() {
  var clone = JSON.parse(JSON.stringify(this.config.data));

  //
  // Remove commentary as it has no place in the JSON.
  //
  Object.keys(clone).forEach(function clean(key) {
    delete clone[key].commentary;
  });

  return clone;
};

/**
 * Create human readable stringified JSON representation of our config.
 *
 * @return {String} The configuration.
 * @api private
 */
Composer.prototype.json = function json() {
  return JSON.stringify(this, null, 2);
};
/**
 * Composer function for cfg according HAProxy and adds comments.
 *
 * @returns {String} A HAProxy compatible configuration file
 * @api private
 */
Composer.prototype.cfg = function cfg() {
  var data = this.config.data;

  return Object.keys(data).reduce(function addSections(result, key) {
    var current = data[key]
      , comm = current.commentary;

    // Output section and main comments.
    if (comm && comm.pre) result += '# '+ comm.pre +'\n';
    result += key +'\n';

    // Output section keys and values.
    return result += Object.keys(current).reduce(function addKeys(section, key) {
      if (key === 'commentary') return section;

      // Add key and value and if required add comment.
      return section += '    '+ key +' '+ current[key]
        + (comm[key] ? ' # ' + comm[key] : '');
    }, '');
  }, '');
};

/**
 * Automatic parser interface for configuration changes.
 *
 * @constructor
 * @param {Configuration} config The parent configuration instance
 * @api private
 */
function Parser(config) {
  this.config = config;

  this.config.on('read', function read(type) {
    this[type]();
  }.bind(this));
}

/**
 * Parse files with a `.json` extension.
 *
 * @returns {Parser}
 */
Parser.prototype.json = function json() {
  this.config.data = JSON.parse(this.config.source);

  return this;
};

/**
 * Parses files with a `.cfg` extension.
 *
 * @returns {Parser}
 */
Parser.prototype.cfg = function cfg() {
  var data = this.config.source;

  return this;
};

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
