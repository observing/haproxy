'use strict';

var EventEmitter = require('events').EventEmitter
  , Orchestrator = require('./orchestrator.js')
  , Composer = require('./composer.js')
  , Parser = require('./parser.js')
  , path = require('path')
  , util = require('util')
  , fs = require('fs');

//
// Empty function
//
function noop(){}

function Configuration() {
  if (!(this instanceof Configuration)) return new Configuration();
  EventEmitter.call(this);

  //
  //  Required for parsing and composing the configurations.
  //
  this.data = Object.create(null);
  this.source = '';

  //
  // The actual parsers and configurators.
  //
  this.composer = new Composer(this);
  this.parser = new Parser(this);
  this.definitions = Configuration;
}

util.inherits(Configuration, EventEmitter);

/**
 * Read out a configuration file and parse it for conversion.
 *
 * @param {String} location The path to the configuration file.
 * @param {Function} fn Callback
 * @returns {Configuration}
 */
Configuration.prototype.read = function read(location, fn) {
  var type = path.extname(location).substr(1)
    , self = this
    , source;

  fn = fn || noop;

  if (!(type in this.parser)) {
    fn.call(this, new Error('Invalid file, no parser for this extension'));
    return this;
  }

  //
  // Set the `source` and emit the `read` event with file extension so it can
  // start with parsing the original file's source. After everything is parsed
  // we can call the supplied callback which can process things further.
  //

  if (!fn) {
    source = fs.readFileSync(location, 'utf-8');

    this.reset();
    this.source = source;
    this.emit('read', type);

    return this;
  }

  fs.readFile(location, 'utf-8', function read(err, config) {
    if (err) return fn(err);

    self.reset();
    self.source = config;
    self.emit('read', type);

    fn(err, config);
  });

  return this;
};

/**
 * Write the config to file, composer type is aquired from file extension.
 *
 * @param {String} location file location
 * @param {Function} fn
 * @api public
 */
Configuration.prototype.write = function write(location, fn) {
  var type = path.extname(location).substr(1)
    , data;

  //
  // Check if the given extension is supported by our configuration generator.
  // Default to cfg as that's the format that HAProxy supports.
  //
  if (!(type in this.composer)) type = 'cfg';
  data = this.composer[type]();

  if (!fn) fs.writeFileSync(location, data);
  else fs.writeFile(location, data, fn);

  return this;
};

/**
 * Verify the current config by using HAProxies check.
 *
 * @param {Function} fn
 * @api public
 */
Configuration.prototype.verify = function verify(fn) {
  var tmp = '/tmp/haproxy.'+ Math.random().toString(36).substring(2).toUpperCase()
    , orchestrator = new Orchestrator({ config: tmp })
    , data = this.composer.cfg();

  fs.writeFile(tmp, data, function hollaback(err) {
    if (err) return fn(err);

    orchestrator.verify(function verification() {
      fn.apply(exports, arguments);

      //
      // We don't care if it fails or not, each file would have a unique name.
      // And we don't really need to remove it from the file system but it's
      // just `nice` do some additional cleanup
      //
      fs.unlink(tmp, function likeigiveafuck() {});
    });
  });

  return this;
};

/**
 * Get value of the section-key combination.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @return {String} key value
 * @api private
 */
Configuration.prototype.get = function get(section, name, key) {
  switch (arguments.length) {
    case 1:
      return this.data[section];
    case 2:
      return this.data[section][name];
    default:
      return this.data[section][name][key];
  }
};

/**
 * Set the section-key combination to value.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} value
 * @return {Object} bind comment to key.
 * @api private
 */
Configuration.prototype.set = function set(section, name, key, value) {
  var element, sub;

  // Check if the current key is allowed to be set on the section.
  if (!~this.definitions.allowed[section].indexOf(key)) return this;

  this.data[section] = element = this.data[section] || Object.create(null);
  element[name] = sub = element[name] || Object.create(null);
  sub[key] = value;

  // Expose comment function bound to key.
  return this.comment.bind(this, section, name, key);
};

/**
 * Adds content to key, transforms value to array if required
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} value
 * @return {Object} bind comment to key.
 * @api private
 */
Configuration.prototype.add = function add(section, name, key, value) {
  var element, sub;

  // Check if the current key is allowed to be set on the section.
  if (!~this.definitions.allowed[section].indexOf(key)) return this;

  this.data[section] = element = this.data[section] || Object.create(null);
  element[name] = sub = element[name] || Object.create(null);

  // If this key is undefined just call set.
  if (!sub[key]) return this.set(section, name, key, value);

  // Convert to array so we can just push to it.
  if (sub[key] && typeof sub[key] === 'string') sub[key] = [sub[key]];

  // Add the value
  sub[key].push(value);

  // Expose comment function bound to key.
  return this.comment.bind(this, section, key);
};

/**
 * Add comment to section-key combinations. General section comments are added
 * to `commentary.pre`. Return early if there is no actual text.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} text
 * @return {String} text
 * @api private
 */
Configuration.prototype.comment = function comment(section, name, key, text) {
  var element, sub;

  // Do add comments, will you!
  if (!text) return this;

  this.data[section] = element = this.data[section] || Object.create(null);
  element[name] = sub = element[name] || Object.create(null);
  sub.commentary = sub.commentary || Object.create(null);
  sub.commentary[key] = text.trim();

  return sub.commentary[key];
};

/**
 * Reset and clear the current config
 *
 * @api public
 */
Configuration.prototype.reset = function reset() {
  this.data = Object.create(null);
  this.source = '';

  return this;
};

/**
 * Config sections and bitmasks.
 *
 * @type {Object}
 * @api private
 */
Configuration.masks = {
  global: 1 << 1,    // 2
  defaults: 1 << 2,  // 4
  frontend: 1 << 3,  // 8
  listen: 1 << 4,    // 16
  backend: 1 << 5,   // 32
  userlist: 1 << 6   // 64
};

/**
 * Configuration keys and bitwise value, each bitwise value appoints
 * sections to which the key belongs.
 *
 * @type {Object}
 * @api private
 */
Configuration.keys = require('./config');

/**
 * Change config strings to suitable function names.
 *
 * @param {String} value function name
 * @return {String}
 * @api private
 */
Configuration.functionalize = function functionalize(value) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
};

/**
 * Is config key the first part of the line?
 *
 * @param {String} line of content
 * @param {String} key in config
 * @return {Boolean}
 * @api private
 */
Configuration.has = function has(line, key) {
  return line.indexOf(key) === 0;
};

//
// Array of possible configuration sections.
//
Configuration.sections = Object.keys(Configuration.masks);

//
// An object with the allowed sections & configuration value mapping.
//
Configuration.allowed = Object.create(null);

//
// Generate allowed config keys per section from the bitmasks.
//
Configuration.sections.forEach(function prepareKeys(section) {
  var mask = Configuration.masks[section]
    , current;

  Object.keys(Configuration.keys).forEach(function bitmask(bit) {
    current = Configuration.allowed[section] || [];

    if (mask & +bit) {
      Configuration.allowed[section] = current.concat(Configuration.keys[bit]);
    }
  });
});

//
// Generate some helper methods on each section to quickly set and get values.
//
Configuration.sections.forEach(function prepareFunctions(section) {
  if (section in Configuration.prototype) throw new Error('Duplicate method '+ section);

  Configuration.prototype[section] = function setup(name) {
    //
    // Defaults have no name parameter, but for eaz and consistency we
    // are gonna pretend it has a general name section.
    //
    if (!name || section === 'defaults') name = 'general';

    //
    // Add getters and setters to each section.
    //
    var result = Object.create(null)
      , self = this;

    /**
     * Generate property descriptor.
     *
     * @param {Function} fn Method to call.
     * @param {Mixed} arg Additional default arguments, other than section and name.
     * @return {Object} Property description.
     */
    function property(fn, arg) {
      var base = [ section, name ];

      return {
        writable: false,
        enumerable: false,
        value: function () {
          if (arg) base.push(arg);

          return fn.apply(self, base.concat(
            Array.prototype.slice.apply(arguments)
          ));
        }
      };
    }

    Object.defineProperties(result, {
      get: property(self.get),
      set: property(self.set),
      add: property(self.add),
      comment: property(self.comment, 'pre'),
      and: {
        writable: false,
        enumerable: false,
        value: self
      }
    });

    //
    // Also add proxies for each key in the section.
    //
    Configuration.allowed[section].forEach(function addProxies(key) {
      var fn = Configuration.functionalize(key);

      if (Object.prototype.hasOwnProperty.call(result, fn)) return;
      Object.defineProperty(result, fn, property(self.set, key));
    }, this);

    return result;
  };
});

//
// Expose the Config
//
module.exports = Configuration;
