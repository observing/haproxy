'use strict';

/**
 * Native modules.
 */
var fs = require('fs')
  , path = require('path')
  , util = require('utile');

/**
 * Required defaults.
 */
var config = {}
  , sections = [ 'global', 'defaults', 'frontend', 'backend', 'listen' ]
  , keys = {
        global: [
            'ca-base', 'chroot', 'crt-base', 'daemon', 'gid', 'group'
          , 'log', 'log-send-hostname', 'nbproc', 'pidfile', 'uid', 'ulimit-n'
          , 'user', 'stats', 'node', 'description', 'unix-bind'
        ]
      , defaults: []
      , frontend: []
      , backend: []
      , listen: []
    };

var compose = {
    /**
     * Composer function for JSON, strips comments and utilizes stringify.
     *
     * @param {Object} data
     * @returns {String} stringified data.
     * @api private
     */
    json: function stringify(data) {
      var clone = util.clone(data);

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
      return {};
    }
};

/**
 * Add comment to section-key combinations. General section comments are added
 * to `commentary.pre`.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} text
 * @return {String} text
 * @api private
 */
function comment(section, key, text) {
  config[section] = config[section] || {};
  config[section].commentary = config[section].commentary || {};

  return config[section].commentary[key] = text;
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
 * Set the section-key combination to value.
 *
 * @param {String} section predefined section
 * @param {String} key
 * @param {String} value
 * @return {Object} bind comment to key.
 * @api private
 */
function set(section, key, value) {
  config[section] = config[section] || {};
  config[section][key] = value;

  // Check if the current key is allowed to be set on the section.
  if (!~keys[section].indexOf(key)) {
    throw new Error('Invalid key: '+ key +' for section: '+ section);
  }

  return { comment: comment.bind(comment, section, key) };
}

/**
 * Read the config from file and return parsed config to callback.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
module.exports.read = function read(location, callback) {
  var type = path.extname(location).substr(1);
  if (!(type in compose)) {
    throw new Error('Supplied file with extension: '+ type +' cannot be parsed');
  }

  // Read the file and pull content through the right parser.
  fs.writeFile(location, 'utf-8', function parseFile(err, data) {
    if (err) throw err;

    callback(null, parse[type].call(this, data));
  });
};

/**
 * Write the config to file, composer type is aquired from file extension.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
module.exports.write = function write(location, callback) {
  var type = path.extname(location).substr(1);
  if (!(type in compose)) type = 'json';

  fs.writeFile(location, compose[type].call(this, config), callback);
};

/**
 * Generate some helper methods on each section to quickly set and get values.
 */
sections.forEach(function prepare(section) {
  // Add getters and setters to each section.
  module.exports[section] = {};
  module.exports[section].__proto__ = {
    get: get.bind(get, section),
    set: set.bind(set, section),
    comment: comment.bind(comment, section, 'pre')
  };
});

/**
 * Export module.
 */
module.exports.config = config;
