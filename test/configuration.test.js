'use strict';

describe('haproxy:configuration', function () {
  var chai = require('chai')
    , path = require('path')
    , expect = chai.expect;

  var Configuration = require('../lib/configuration')
    , parser = new Configuration()
    , fs = require('fs');

  chai.config.includeStack = true;

  afterEach(function () {
    parser.reset();
  });

  it('exposes each config mask as key', function () {
    Object.keys(Configuration.masks).forEach(function(key) {
      expect(!!parser[key]).to.equal(true);
    });
  });

  it('adds general getters, setters and comment function to mask', function () {
    Object.keys(Configuration.masks).forEach(function(key) {
      expect(parser[key]().set).to.be.a('function');
      expect(parser[key]().get).to.be.a('function');
      expect(parser[key]().comment).to.be.a('function');
    });
  });

  it('section specific comment functions add commentary.pre', function () {
    var comment = 'add some comment';

    parser.defaults().comment(comment);
    expect(parser.data.defaults.general.commentary.pre).to.equal(comment);
  });

  it('exposes read, write, verify and current config', function () {
    expect(parser).to.have.property('read');
    expect(parser).to.have.property('write');
    expect(parser).to.have.property('verify');
    expect(parser).to.have.property('data');
    expect(parser).to.have.property('source');
  });

  it('has getters and setters specific for section and returns function comment', function () {
    var value = 'this value makes no sense as config'
      , comment = 'add some comment to mode'
      , func = parser.defaults().set('mode', value);

    expect(parser.data.defaults.general.mode).to.equal(value);
    expect(parser.defaults().get('mode')).to.equal(value);
    expect(func).to.be.a('function');

    func(comment);
    expect(parser.data.defaults.general.commentary.mode).to.equal(comment);
  });

  it('section default has key specific setters', function () {
    var value = 'this value makes no sense as config';

    // Some random bitmasked methods, testing against all keys is pointless
    parser.defaults().mode(value);
    parser.global().log(value);
    parser.listen().description(value);

    expect(parser.data.defaults.general.mode).to.equal(value);
    expect(parser.data.global.general.log).to.equal(value);
    expect(parser.data.listen.general.description).to.equal(value);
    expect(parser.defaults().get('mode')).to.equal(value);
    expect(parser.global().get('log')).to.equal(value);
    expect(parser.listen().get('description')).to.equal(value);
  });

  describe('#set', function () {
    var value = 'something random';

    it('sets section.key and returns comment function', function () {
      var func = parser.set('defaults', 'general', 'backlog', value);

      expect(parser.data.defaults.general.backlog).to.equal(value);
      expect(func).to.be.a('function');
    });

    it('does nothing if the key is not allowed for the section', function () {
      // Will not have defaults nor bind.
      expect(parser.data).to.not.have.property('defaults');

      parser.set('defaults', 'general', 'backlog', value);
      parser.set('defaults', 'general', 'bind', value);

      // Now will not have bind.
      expect(parser.data.defaults.general).to.not.have.property('bind');
    });
  });

  describe('#add', function () {
    var value = 'double content in array';

    it('adds value to section.key if key is already set', function () {
      parser.set('defaults', 'general', 'backlog', value);
      parser.add('defaults', 'general', 'backlog', value);

      expect(parser.data.defaults.general.backlog.length).to.equal(2);
      expect(parser.data.defaults.general.backlog[0]).to.equal(value);
      expect(parser.data.defaults.general.backlog[1]).to.equal(value);
    });

    it('delegate to set if key is undefined', function () {
      parser.add('defaults', 'general', 'backlog', value);

      expect(parser.data.defaults.general.backlog).to.not.be.an('array');
      expect(parser.data.defaults.general.backlog).to.be.an('string');
      expect(parser.data.defaults.general.backlog).to.equal(value);
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
        expect(Configuration.functionalize(test[key])).to.equal(key);
      });
    });
  });

  it('#comment stores commentary related to section.key');

  describe('#write', function () {
    it('stores proper cfg config', function (done) {
      var data = require(path.join(__dirname, 'fixtures', 'default'));

      parser.data = data;
      parser.write('/tmp/test.cfg', function () {
        fs.readFile(path.join(__dirname, 'fixtures', 'default.cfg'), 'utf-8', function (error, origin) {
          if (error) return done(error);

          fs.readFile('/tmp/test.cfg', 'utf-8', function (err, read) {
            if (err) return done(err);
            expect(origin.trim()).to.equal(read.trim());
            done();
          });
        });
      });
    });

    it('format is specified by file extension', function (done) {
      var data = require(path.join(__dirname, 'fixtures', 'default'));

      parser.data = data;
      parser.write('/tmp/test.json', function () {
        fs.readFile(path.join(__dirname, 'fixtures', 'default.json'), 'utf-8', function (err, origin) {
          if (err) return done(err);

          fs.readFile('/tmp/test.json', 'utf-8', function (error, data) {
            if (error) return done(error);

            expect(origin.trim()).to.equal(data.trim());
            done();
          });
        });
      });
    });
  });

  describe('#read', function () {
    it('reads cfg config to usable object', function (done) {
      parser.read(path.join(__dirname, 'fixtures', 'default.cfg'), function () {
        fs.readFile(path.join(__dirname, 'fixtures', 'default.json'), 'utf-8', function (err, data) {
          if (err) return done(err);

          //
          // Newline needs to be stripped to get a perfect match.
          //
          expect(JSON.stringify(parser.data, null, 2)).to.equal(data.trim());
          done();
        });
      });
    });

    it('reads json config to usable object', function (done) {
      parser.read(path.join(__dirname, 'fixtures', 'default.json'), function () {
        fs.readFile(path.join(__dirname, 'fixtures', 'default.json'), 'utf-8', function (err, data) {
          if (err) return done(err);

          //
          // Newline needs to be stripped to get a perfect match.
          //
          expect(JSON.stringify(parser.data, null, 2)).to.equal(data.trim());
          done();
        });
      });
    });

    it('doesnt care about the comment style used in the config', function (done) {
      parser.read(path.join(__dirname, 'fixtures', 'comment.cfg'), done);
    });
  });

  describe('#has', function () {
    it('checks if key is start of content', function () {
      var content = 'mode http';

      expect(Configuration.has(content, 'mode')).to.equal(true);
      expect(Configuration.has(content, 'http')).to.equal(false);
    });
  });

  describe('#reset', function () {
    it('clears the config', function () {
      parser.data = { test: 'some random key set' };
      parser.source = 'fooo';

      parser.reset();

      expect(Object.keys(parser.data).length).to.equal(0);
      expect(parser.source).to.equal('');
    });
  });
});
