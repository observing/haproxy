/*globals beforeEach, afterEach*/
describe('parser', function () {
  'use strict';

  var chai = require('chai')
    , sinon = require('sinon')
    , fs = require('fs')
    , sinonChai = require('sinon-chai')
    , expect = chai.expect
    , parser = require('../parser')
    , config = require('../config');

  chai.Assertion.includeStack = true;
  chai.use(sinonChai);

  afterEach(function () {
    parser.reset();
  });

  it('exposes each config section as key', function () {
    Object.keys(config.sections).forEach(function(key) {
      expect(parser).to.have.property(key);
    });
  });

  it('adds general getters, setters and comment function to sections', function () {
    Object.keys(config.sections).forEach(function(key) {
      expect(parser[key]().set).to.be.a('function');
      expect(parser[key]().get).to.be.a('function');
      expect(parser[key]().comment).to.be.a('function');
    });
  });

  it('section specific comment functions add commentary.pre', function () {
    var comment = 'add some comment';

    parser.defaults().comment(comment);
    expect(parser.config.defaults.general.commentary.pre).to.equal(comment);
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
      , func = parser.defaults().set('mode', value);

    expect(parser.config.defaults.general.mode).to.equal(value);
    expect(parser.defaults().get('mode')).to.equal(value);
    expect(func).to.be.a('function');

    func(comment);
    expect(parser.config.defaults.general.commentary.mode).to.equal(comment);
  });

  it('section default has key specific setters', function () {
    var value = 'this value makes no sense as config'
      , comment = 'add some comment to mode';

    // Some random bitmasked methods, testing against all keys is pointless
    parser.defaults().mode(value);
    parser.global().log(value);
    parser.listen().description(value);

    expect(parser.config.defaults.general.mode).to.equal(value);
    expect(parser.config.global.general.log).to.equal(value);
    expect(parser.config.listen.general.description).to.equal(value);
    expect(parser.defaults().get('mode')).to.equal(value);
    expect(parser.global().get('log')).to.equal(value);
    expect(parser.listen().get('description')).to.equal(value);
  });

  it('parse#json reads JSON config from file');
  it('parse#cfg reads cfg config from file');
  it('compose#json creates readable JSON from config');
  it('compose#cfg creates cfg from config');

  describe('#set', function () {
    var value = 'something random';

    it('sets section.key and returns comment function', function () {
      var func = parser.set('defaults', 'general', 'backlog', value);

      expect(parser.config.defaults.general.backlog).to.equal(value);
      expect(func).to.be.a('function');
    });

    it('does nothing if the key is not allowed for the section', function () {
      var func = parser.set('defaults', 'general', 'bind', value);

      // Will not have defaults nor bind.
      expect(parser.config).to.not.have.property('defaults');

      parser.set('defaults', 'general', 'backlog', value);
      parser.set('defaults', 'general', 'bind', value);

      // Now will not have bind.
      expect(parser.config.defaults.general).to.not.have.property('bind');
    });
  });

  describe('#add', function () {
    var value = 'double content in array';

    it('adds value to section.key if key is already set', function () {
      parser.set('defaults', 'general', 'backlog', value);
      parser.add('defaults', 'general', 'backlog', value);

      expect(parser.config.defaults.general.backlog.length).to.equal(2);
      expect(parser.config.defaults.general.backlog[0]).to.equal(value);
      expect(parser.config.defaults.general.backlog[1]).to.equal(value);
    });

    it('delegate to set if key is undefined', function () {
      parser.add('defaults', 'general', 'backlog', value);

      expect(parser.config.defaults.general.backlog).to.not.be.an('array');
      expect(parser.config.defaults.general.backlog).to.be.an('string');
      expect(parser.config.defaults.general.backlog).to.equal(value);
    });
  });

  describe('#get', function () {
    it('returns value from section.key', function () {
      parser.defaults().set('backlog', 'test');
      expect(parser.get('defaults', 'general', 'backlog')).to.equal('test');
    });
  });

  describe('#functionalize', function () {
    it('returns suitable lowercased function name', function () {
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
  });

  it('#comment stores commentary related to section.key');

  describe('#write', function () {
    it('stores proper cfg config', function (done) {
      var data = require(__dirname + '/fixtures/default');

      parser.config = data;
      parser.write('/tmp/test.cfg', function (err) {
        fs.readFile(__dirname + '/fixtures/default.cfg', 'utf-8', function (err, origin) {
          fs.readFile('/tmp/test.cfg', 'utf-8', function (err, data) {
            expect(origin).to.equal(data.replace(/\n$/, ''));
            done();
          });
        });
      });
    });

    it('format is specified by file extension');
  });

  describe('#read', function () {
    it('reads cfg config to usable object', function (done) {
      parser.read(__dirname + '/fixtures/default.cfg', function () {
        fs.readFile(__dirname + '/fixtures/default.json', 'utf-8', function (err, data) {
          // Newline needs to be stripped to get a perfect match.
          expect(JSON.stringify(parser.config, null, 2)).to.equal(data.replace(/\n$/, ''));
          done();
        });
      });
    });

    it('reads json config to usable object');
  });

  describe('#findKey', function () {
    it('checks if key is start of content', function () {
      var content = 'mode http';

      expect(parser.findKey(content, 'mode')).to.be.true;
      expect(parser.findKey(content, 'http')).to.be.false;
    });
  });

  describe('#reset', function () {
    it('clears the config', function () {
      parser.config = { test: 'some random key set' };

      parser.reset();
      expect(Object.keys(parser.config).length).to.equal(0);
    });
  });
});
