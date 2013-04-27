'use strict';

/**
 * Compose different types of configurations from the given
 * `Configuration` instance.
 *
 * @constructor
 * @param {Configuration} config [description]
 * @api private
 */
function Composer(config) {
  if (!(this instanceof Composer)) return new Composer(config);

  this.config = config;
}

/**
 * Automatic JSON conversion when `JSON.stringify(composer)` is used.
 *
 * @returns {Object} A plain JavaScript object.
 * @api private
 */
Composer.prototype.toJSON = function toJSON() {
  return this.config.data;
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
        if (Array.isArray(sub[key])) {
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
};

//
// Expose the configuration composer.
//
module.exports = Composer;
