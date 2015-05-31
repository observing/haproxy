'use strict';

var request = require('request')
  , config = require('../lib/config')
  , version = process.env.VERSION || '1.5';

/**
 * Do an 'any' check against each scope of the config.
 *
 * @param {String} value Option to check.
 * @returns {Boolean}
 * @api private
 */
function check(value) {
  return Object.keys(config).reduce(function check(memo, key) {
    if (memo) return memo;
    return !!~config[key].indexOf(value);
  }, false);
}

/**
 * Report missing config value.
 *
 * @param {String} scope Scope of option.
 * @param {String} key Config option.
 * @api private
 */
function missing(scope, key) {
  if (check(key)) return;
  console.log('Missing %s option: %s', scope, key);
}

request([
  'http://www.haproxy.org/git?p=haproxy-',
  version,
  '.git;',
  'a=blob_plain;',
  'f=doc/configuration.txt;',
  'hb=HEAD'
].join(''), function conf(error, response, body) {
  if (error) throw error;

  console.log('Finished fetching configuration docs', body.length);

  //
  // Check of global parameters.
  //
  body.slice(
    body.indexOf('3. Global parameters'),
    body.indexOf('3.1. Process management and security')
  ).split('\n').forEach(function each(line) {
    if (!~line.indexOf('   - ')) return;
    missing('global', line.slice(5));
  });

  //
  // Check proxy configuration parameters.
  //
  body.slice(
    body.indexOf('4.1. Proxy keywords matrix'),
    body.indexOf('4.2. Alphabetically sorted keywords reference')
  ).split('\n').forEach(function each(line) {
    if (!~line.indexOf('     -    ')
      || !~line.indexOf('     X    ')
      || ~line.indexOf('deprecated')) return;

    //
    // Special case with inversion asterix.
    //
    if (~line.indexOf('(*)')) {
      return missing('proxy', line.slice(0, line.indexOf('(*)  X')).trim());
    }

    var optNeg = line.indexOf('     -')
      , optPos = line.indexOf('     X');

    missing('proxy', line.slice(0, optNeg < optPos ? optNeg : optPos).trim());
  });
});