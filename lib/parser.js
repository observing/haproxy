'use strict';

/**
 * Automatic parser interface for configuration changes.
 *
 * @constructor
 * @param {Configuration} config The parent configuration instance
 * @api private
 */
function Parser(config) {
  if (!(this instanceof Parser)) return new Parser(config);

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
  var has = this.config.definitions.has
    , data = this.config.source
    , section
    , current
    , name
    , hash
    , key;

  data.split(/\n/).forEach(function parse(line) {
    line = line.trim();

    // No content on line just return.
    if (!line.length) return;

    // Keep track of the section.
    section = this.config.definitions.sections.filter(has.bind(this, line))[0];

    if (section) {
      name = line.split(' ')[1]; // Named section support.
      return current = section;
    }

    // Check content against known keys in current section.
    key = this.config.definitions.allowed[current].filter(has.bind(this, line))[0];

    if (!key || !key.length) return;

    // Store the value if we got a key match, and add the comment (if present).
    hash = line.split('#');
    this.config[current](name).add(key, hash[0].substr(key.length).trim())(hash[1]);
  }, this);

  return this;
};

//
// Expose the module.
//
module.exports = Parser;
