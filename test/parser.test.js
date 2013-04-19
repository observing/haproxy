describe('parser', function () {
  'use strict';

  var chai = require('chai')
    , expect = chai.expect
    , parser = require('../parser')
    , config = require('../config');

  chai.Assertion.includeStack = true;

  it('exposes each config section as key', function () {
    Object.keys(config.sections).forEach(function(key) {
      expect(parser).to.have.property(key);
    });
  });

  it('adds general getters, setters and comment function to sections', function () {
    Object.keys(config.sections).forEach(function(key) {
      expect(parser[key].set).to.be.a('function');
      expect(parser[key].get).to.be.a('function');
      expect(parser[key].comment).to.be.a('function');
    });
  });

  it('section specific comment functions add pre-commentary', function () {
    var comment = 'add some comment';

    parser.defaults.comment(comment);
    expect(parser.config.defaults.commentary.pre).to.equal(comment);
  });

  it('exposes read, write, verify and current config', function () {
    expect(parser).to.have.property('read');
    expect(parser).to.have.property('write');
    expect(parser).to.have.property('verify');
    expect(parser).to.have.property('config');
  });

  it('has getters and setters specific for section and returns function comment', function () {
    var value = 'this value makes no sense as config'
      , comment = 'add some comment to mode'
      , func = parser.defaults.set('mode', value);

    expect(parser.config.defaults.mode).to.equal(value);
    expect(parser.defaults.get('mode')).to.equal(value);
    expect(func).to.be.a('function');

    func(comment);
    expect(parser.config.defaults.commentary.mode).to.equal(comment);
  });

  it('section default has key specific setters', function () {
    var value = 'this value makes no sense as config'
      , comment = 'add some comment to mode';

    // Some random bitmasked methods, testing against all keys is pointless
    parser.defaults.mode(value);
    parser.global.log(value);
    parser.listen.description(value);

    expect(parser.config.defaults.mode).to.equal(value);
    expect(parser.config.global.log).to.equal(value);
    expect(parser.config.listen.description).to.equal(value);
    expect(parser.defaults.get('mode')).to.equal(value);
    expect(parser.global.get('log')).to.equal(value);
    expect(parser.listen.get('description')).to.equal(value);
  });

  it('parse#json reads JSON config from file');
  it('parse#cfg reads cfg config from file');
  it('compose#json creates readable JSON from config');
  it('compose#cfg creates cfg from config');
  it('#set writes specific key to specified section and returns comment function');
  it('#get returns value from section.key');

  it('#functionalize returns suitable lowercased function name', function () {
    var test = {
        'timeoutclient': 'timeout client'
      , 'optionacceptinvalidhttprequest': 'option accept-invalid-http-request'
      , 'tunercvbufclient': 'tune.rcvbuf.client'
      , 'usebackend': 'use_backend'
      , 'lolforgiggsoptionhttpproxy': 'lol-for.giggs option http_proxy'
    };

    Object.keys(test).forEach(function (key) {
      expect(parser.functionalize(test[key])).to.equal(key);
    });
  });

  it('#comment stores commentary related to section.key');
  it('#write stores config to format specified by extension');
  it('#read reads cfg or JSON config to usable object');
});
