'use strict';

//
// Native modules.
//
var path = require('path')
  , fs = require('fs');

//
// Required defaults.
//
var defaults = require('./config')
  , sections = defaults.sections
  , names = Object.keys(sections)
  , maps = defaults.keys
  , keys = {}
  , config;

//
// Our process orchestrator which we need to verification
//
var Orchestrator = require('./lib/orchestrator');

//
// Config storage.
//
exports.config = config = Object.create(null);

//
// Composer functions.
//
var compose = {
    /**
     * Composer function for readable JSON.
     *
     * @param {Object} data
     * @returns {String} stringified data.
     * @api private
     */
    json: function stringify(data) {
      // Stringify and keep it readable.
      return JSON.stringify(data, null, 2);
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
        var current = data[key];

        return result + Object.keys(current).reduce(function addNames(named, name) {
          var sub = current[name]
            , comm = sub.commentary;

          // Output section and main comments.
          if (comm && comm.pre) result += '# '+ comm.pre +'\n';
          named += key + (name !== 'general' ? ' ' + name + '\n' : '\n');

          // Output section keys and values.
          return named += Object.keys(sub).reduce(function addKeys(section, key) {
            if (key === 'commentary') return section;

            // Check if the key has multiple values stored as array, otherwise
            // just add the key and value and comment (if required).
            if (Object.prototype.toString.call(sub[key]) === '[object Array]') {
              var length = sub[key].length;

              for (var i = 0; i < length; i++) {
                section += '    '+ key + (sub[key][i].length ? ' '+ sub[key][i] : '');
                section += (i === 1 && comm && comm[key] ? ' # ' + comm[key] + '\n' : '\n');
              }

              return section;
            } else {
              return section += '    '+ key + (sub[key].length ? ' '+ sub[key] : '')
                + (comm && comm[key] ? ' # ' + comm[key] + '\n' : '\n');
            }
          }, '') + '\n';
        }, '');
      }, '');
    }
};

//
// Parse functions.
//
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
      var current, hash, section, key, name;

      data.split(/\n/).forEach(function parse(line) {
        line = line.trim();

        // No content on line just return.
        if (!line.length) return;

        // Keep track of the section.
        section = names.filter(findKey.bind(this, line))[0];
        if (section) {
          name = line.split(' ')[1]; // Named section support.
          return current = section;
        }

        // Check content against known keys in current section.
        key = keys[current].filter(findKey.bind(this, line))[0];
        if (!key.length) return;

        // Store the value if we got a key match, and add the comment (if present).
        hash = line.split('#');
        exports[current](name).add(key, hash[0].substr(key.length).trim())(hash[1]);
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
function comment(section, name, key, text) {
  var element, sub;

  // Do add comments, will you!
  if (!text) return;

  config[section] = element = config[section] || {};
  element[name] = sub = element[name] || {};
  sub.commentary = sub.commentary || {};

  return sub.commentary[key] = text.trim();
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
function get(section, name, key) {
  return config[section][name][key];
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
function add(section, name, key, value) {
  var element, sub;

  // Check if the current key is allowed to be set on the section.
  if (!~keys[section].indexOf(key)) return;

  config[section] = element = config[section] || {};
  element[name] = sub = element[name] || {};

  // If this key is undefined just call set.
  if (!sub[key]) return set(section, name, key, value);

  // Convert to array so we can just push to it.
  if (sub[key] && typeof sub[key] === 'string') {
    sub[key] = [sub[key]];
  }

  // Add the value
  sub[key].push(value);

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
function set(section, name, key, value) {
  var element, sub;

  // Check if the current key is allowed to be set on the section.
  if (!~keys[section].indexOf(key)) return;

  config[section] = element = config[section] || {};
  element[name] = sub = element[name] || {};
  sub[key] = value;

  // Expose comment function bound to key.
  return comment.bind(comment, section, name, key);
}

/**
 * Read the config from file and return parsed config to callback.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
exports.read = function read(location, callback) {
  var type = path.extname(location).substr(1);

  if (!(type in compose)) {
    callback(new Error('Supplied file with extension: '+ type +' cannot be parsed'));
    return exports;
  }

  // Read the file and pull content through the right parser.
  fs.readFile(location, 'utf-8', function parseFile(err, data) {
    if (err) return callback(err);

    callback(undefined, parse[type].call(this, data));
  });

  return exports;
};

/**
 * Verify the current config by using HAProxies check.
 *
 * @param {Function} callback
 * @api public
 */
exports.verify = function verify(callback) {
  var tmp = '/tmp/haproxy.'+ Math.random().toString(36).substring(2).toUpperCase()
    , orchestrator = new Orchestrator({ config: tmp })
    , data = compose.cfg(config);

  fs.writeFile(tmp, data, function hollaback(err) {
    if (err) return callback(err);

    orchestrator.verify(function verification() {
      callback.apply(exports, arguments);

      //
      // We don't care if it fails or not, each file would have a unique name.
      // And we don't really need to remove it from the file system but it's
      // just `nice` do some additional cleanup
      //
      fs.unlink(tmp, function likeigiveafuck() {});
    });
  });

  return exports;
};

/**
 * Write the config to file, composer type is aquired from file extension.
 *
 * @param {String} location file location
 * @param {Function} callback
 * @api public
 */
exports.write = function write(location, callback) {
  var type = path.extname(location).substr(1);
  if (!(type in compose)) type = 'json';

  fs.writeFile(location, compose[type].call(this, exports.config), callback);
  return exports;
};

/**
 * Reset and clear the current config
 *
 * @api public
 */
exports.reset = function reset() {
  exports.config = config = Object.create(null);
  return exports;
};

//
// Generate allowed config keys per section from the bitmasks.
//
names.forEach(function prepareKeys(section) {
  var mask = sections[section]
    , current;

  Object.keys(maps).forEach(function bitmask(bit) {
    current = keys[section] || [];
    if (mask & +bit) keys[section] = current.concat(maps[bit]);
  });
});

//
// Generate some helper methods on each section to quickly set and get values.
//
names.forEach(function prepareFunctions(section) {
  exports[section] = function setup(name) {
    // Defaults have no name parameter, but for eaz and consistency we
    // are gonna pretend it has a general name section.
    if (!name || section === 'defaults') name = 'general';

    // Add getters and setters to each section.
    var result = {};
    result.__proto__ = {
      get: get.bind(get, section, name),
      set: set.bind(set, section, name),
      add: add.bind(add, section, name),
      comment: comment.bind(comment, section, name, 'pre')
    };

    // Also add camelCased proxies for each key in the section.
    keys[section].forEach(function addProxies(key) {
      result.__proto__[functionalize(key)] = set.bind(set, section, name, key);
    });

    return result;
  };
});

//
// Expose additional modules while testing.
//
if (process.env.NODE_ENV === 'testing') {
  exports.set = set;
  exports.get = get;
  exports.add = add;
  exports.parse = parse;
  exports.compose = compose;
  exports.comment = comment;
  exports.functionalize = functionalize;
  exports.findKey = findKey;
}
