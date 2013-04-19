'use strict';

/**
 * Native modules.
 */
var fs = require('fs')
  , path = require('path');

/**
 * Third-party modules
 */
var _ = require('lodash');

/**
 * Required defaults.
 */
var defaults = require('./config')
  , sections = defaults.sections
  , names = Object.keys(sections)
  , maps = defaults.keys
  , parser = module.exports
  , keys = {}
  , config;

/**
 * Config storage.
 */
parser.config = config = {};

/**
 * Composer functions.
 */
var compose = {
    /**
     * Composer function for JSON, strips comments and utilizes stringify.
     *
     * @param {Object} data
     * @returns {String} stringified data.
     * @api private
     */
    json: function stringify(data) {
      var clone = JSON.parse(JSON.stringify(data));

      // Remove commentary as it has no place in JSON.
      Object.keys(clone).forEach(function removeComments(key) {
        delete clone[key].commentary;
      });

      // Stringify and keep it readable.
      return JSON.stringify(clone, null, 2);
    }

    /**
     * Composer function for cfg according HAProxy and adds comments.
     *
     * @param {Object} data
     * @returns {String}
     * @api private
     */
  , cfg: function cfgComposer(data) {
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
    }
};

/**
 * Parse functions.
 */
var parse = {
    json: JSON.parse

    /**
     * Parse the content from .cfg file.
     *
     * @param {String} data cfg content
     * @return {Object} results
     * @api private
     */
  , cfg: function cfgParser(data) {
      var current, hash, section, key, add;

      data.split(/\n/).forEach(function parse(line) {
        line = line.trim();

        // No content on line just return.
        if (!line.length) return;

        // Keep track of the section.
        section = _.find(names, findKey.bind(_, line));
        if (section) return current = section;

        // Check content against known keys in current section.
        key = _.find(keys[current], findKey.bind(_, line));
        if (!key) return;

        // Store the value if we got a key match, and add the comment (if present).
        hash = line.split('#');
        add = parser[current].add(key, hash[0].substr(key.length).trim())(hash[1]);
      });

      return config;
    }
};

/**
 * Is config key the first part of the line?
 *
 * @param {String} line of content
 * @param {String} key in config
 * @return {Boolean}
 * @api private
 */
function findKey(line, key) {
  return line.indexOf(key) === 0;
}

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
function comment(section, key, text) {
  if (!text) return;

  config[section] = config[section] || {};
  config[section].commentary = config[section].commentary || {};

  return config[section].commentary[key] = text.trim();
}

/**
 * Change config strings to suitable function names.
 *
 * @param {String} value function name
 * @return {String}
 * @api private
 */
function functionalize(value) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Get value of the section-key combination.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @return {String} key value
 * @api private
 */
function get(section, key) {
  return config[section][key];
}

/**
 * Adds content to key, transforms value to array if required
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} value
 * @return {Object} bind comment to key.
 * @api private
 */
function add(section, key, value) {
  // Check if the current key is allowed to be set on the section.
  if (!~keys[section].indexOf(key)) return;

  config[section] = config[section] || {};

  // If this key is undefined just call set.
  if (!config[section][key]) return parser.set(section, key, value);

  // Convert to array so we can just push to it.
  if (config[section][key] && typeof config[section][key] === 'string') {
    config[section][key] = [config[section][key]];
  }

  // Add the value
  config[section][key].push(value);

  // Expose comment function bound to key.
  return comment.bind(comment, section, key);
}

/**
 * Set the section-key combination to value.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} value
 * @return {Object} bind comment to key.
 * @api private
 */
function set(section, key, value) {
  // Check if the current key is allowed to be set on the section.
  if (!~keys[section].indexOf(key)) return;

  config[section] = config[section] || {};
  config[section][key] = value;

  // Expose comment function bound to key.
  return comment.bind(comment, section, key);
}

/**
 * Read the config from file and return parsed config to callback.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
parser.read = function read(location, callback) {
  var type = path.extname(location).substr(1);
  if (!(type in compose)) {
    throw new Error('Supplied file with extension: '+ type +' cannot be parsed');
  }

  // Read the file and pull content through the right parser.
  fs.readFile(location, 'utf-8', function parseFile(err, data) {
    if (err) throw err;

    callback(null, parse[type].call(this, data));
  });
};

/**
 * Verify the current config by using HAProxies check.
 */
parser.verify = function verify() {
  // Spawn child and use haproxy -c -f </tmp/config>
};

/**
 * Write the config to file, composer type is aquired from file extension.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
parser.write = function write(location, callback) {
  var type = path.extname(location).substr(1);
  if (!(type in compose)) type = 'json';

  fs.writeFile(location, compose[type].call(this, config), callback);
};

/**
 * Reset and clear the current config
 *
 * @api public
 */
parser.reset = function reset() {
  parser.config = config = {};
};

/**
 * Generate allowed config keys per section from the bitmasks.
 */
names.forEach(function prepareKeys(section) {
  var mask = sections[section]
    , current;

  Object.keys(maps).forEach(function bitmask(bit) {
    current = keys[section] || [];
    if (mask & +bit) keys[section] = current.concat(maps[bit]);
  });
});

/**
 * Generate some helper methods on each section to quickly set and get values.
 */
names.forEach(function prepareFunctions(section) {
  var result = {};

  // Add getters and setters to each section.
  result.__proto__ = {
    get: get.bind(get, section),
    set: set.bind(set, section),
    add: add.bind(add, section),
    comment: comment.bind(comment, section, 'pre')
  };

  // Also add camelCased proxies for each key in the section.
  keys[section].forEach(function addProxies(key) {
    result.__proto__[functionalize(key)] = set.bind(set, section, key);
  });

  parser[section] = result;
});

/**
 * Expose additional modules while testing.
 */
if (process.env.NODE_ENV === 'testing') {
  parser.set = set;
  parser.get = get;
  parser.add = add;
  parser.parse = parse;
  parser.compose = compose;
  parser.comment = comment;
  parser.functionalize = functionalize;
  parser.findKey = findKey;
}
