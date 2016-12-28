describe('haproxy', function () {
  'use strict';

  var request = require('request')
    , hamock = require('./hamock')
    , HAProxy = require('../')
    , chai = require('chai')
    , sinon = require('sinon')
    , expect = chai.expect;

  //
  // The location of the fixtures directory.
  //
  var path = require('path')
    , pidFile = path.resolve(__dirname, 'haproxy.pid')
    , fixtures = require('./fixtures')
    , fixturesPath = path.resolve(__dirname, 'fixtures')
    , orchestrator = fixturesPath + '/orchestrator.cfg'
    , sock = '/tmp/haproxy.sock'
    , timeout = 5000
    , servers
    , server;

  chai.use(require('sinon-chai'));
  chai.config.includeStack = true;

  //
  // Create a mockup server that responds with identical output as the HAProxy.
  //
  before(function before(done) {
    var online = 0;

    server = hamock.createServer({ socket: '/tmp/fixture.sock' }).listen(function () {
      if (++online === 2) done();
    });

    servers = [8083, 8084].reduce(function (set, port) {
      var app = require('http').createServer(function (req, res) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');

        var interval = setInterval(function () {
          res.write('server\n');
        }, 100);

        setTimeout(function () {
          clearInterval(interval);
          res.end('Hello from port: '+port);
        }, timeout);
      });

      set['srv'+ port] = app;

      app.listen(port, function () {
        if (++online === 2) done();
      });

      return set;
    }, {});
  });

  after(function after() {
    Object.keys(servers).forEach(function close(id) {
      servers[id].close();
    });

    server.close();
  });

  it('is exported as a function', function () {
    expect(HAProxy).to.be.a('function');

    var proxy = new HAProxy({ socket: '/tmp/fixture.sock', config: '/foo', which: '/fake/path/haproxy' });

    expect(proxy).to.be.instanceof(require('events').EventEmitter);
    expect(proxy).to.be.instanceof(HAProxy);
  });

  it('accepts a single object as argument', function () {
    var proxy = new HAProxy({ socket: '/tmp/fixture.sock', config: '/foo', which: '/fake/path/haproxy' });

    expect(proxy.socket).to.equal('/tmp/fixture.sock');
    expect(proxy.cfg).to.equal('/foo');
  });

  it('accepts a socket first argument', function () {
    var proxy = new HAProxy('/foo.sock', {which: '/fake/path/haproxy'});

    expect(proxy.socket).to.equal('/foo.sock');
  });

  it('emits haproxy:down when it cannot connect to the given socket', function (done) {
    var proxy = new HAProxy('/tmp/wtf/socket/lol/random/path/should/be/ok/now.sock', {which: '/fake/path/haproxy'});

    proxy.on('haproxy:down', function down(err) {
      expect(err).to.be.instanceof(Error);

      done();
    });

    proxy.clear(function clear(err) {
      expect(err).to.be.instanceof(Error);
    });
  });

  describe('#load', function () {
    it('has #read as alias', function () {
      var proxy = new HAProxy('/foo.sock', {which: '/fake/path/haproxy' });

      expect(proxy.load).to.equal(proxy.read);
    });

    it('reads the given configuration file', function (done) {
      var proxy = new HAProxy('/foo.sock', { config: __dirname + '/fixtures/default.cfg', which: '/fake/path/haproxy' });

      proxy.load(__dirname + '/fixtures/comment.cfg', function (err, data) {
        if (err) return done(err);

        expect(data).to.include('different comment styles');
        expect(data).to.not.include('maximum time to wait for a connection attempt');
        done();
      });
    });

    it('reads the config from the options', function (done) {
      var proxy = new HAProxy('/foo.sock', { config: __dirname + '/fixtures/default.cfg', which: '/fake/path/haproxy' });

      proxy.load(function (err, data) {
        if (err) return done(err);

        expect(data).to.not.include('different comment styles');
        expect(data).to.include('maximum time to wait for a connection attempt');
        done();
      });
    });

    it('parses the configration', function (done) {
      var proxy = new HAProxy('/foo.sock', { config: __dirname + '/fixtures/default.cfg', which: '/fake/path/haproxy' });

      proxy.load(function (err, data) {
        if (err) return done(err);

        expect(data).to.equal(proxy.config.source);
        expect(proxy.config.get('global', 'general', 'pidfile')).to.equal('/tmp/haproxy.pid');

        done();
      });
    });
  });

  describe('#clear', function () {
    it('should clear the counters', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      proxy.clear(done);
    });

    it('should clear all the counters', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      proxy.clear(true, done);
    });
  });

  describe('#disable', function () {
    it('should disable the given backend', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.disable('realtime', 'node1', done);
    });

    it('should ignore errors when the backend is already disabled', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.disable('realtime', 'node1', done);
    });

    it('should error when a non existing backend is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.disable('realtimer', 'node1', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such backend.');

        done();
      });
    });

    it('should error when a non existing server is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.disable('realtime', 'node2', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such server.');

        done();
      });
    });
  });

  describe('#enable', function () {
    it('should enable a disabled backed', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.enable('realtime', 'node1', done);
    });

    it('should not give errors when the backend is already enabled', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.enable('realtime', 'node1', done);
    });

    it('should error when a non existing backend is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.enable('realtimer', 'node1', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such backend.');

        done();
      });
    });

    it('should error when a non existing server is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.enable('realtime', 'node2', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such server.');

        done();
      });
    });
  });

  describe('#pause', function () {
    it('should disable the frontend');
    it('should ignore errors when the frontend is already disabled');
    it('should error when a non existing frontend is given');
  });

  describe('#resume', function () {
    it('should resume the frontend');
    it('should ignore errors when the frontend is already active');
    it('should error when a non existing frontend is given');
  });

  describe('#errors', function () {
    it('return errors only for the given id');
    it('returns a list of errors');
    it('returns nothing when there are no errors');
  });

  describe('#weight', function () {
    it('returns the inital and current weight', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.weight('foo', 'bar', function (err, data) {
        expect(err).to.not.be.instanceOf(Error);

        expect(data.initial).to.equal(1);
        expect(data.current).to.equal(5);

        done();
      });
    });

    it('returns an error when the given backend does not exist');

    it('returns an error when the given server does not exist');

    it('should set the weight when a weight argument is supplied');

    it('should return an error when the set weight is to high');
  });

  describe('#maxconn', function () {
    it('sets the max connections for the frontend');
    it('sets the max connections globally');
    it('returns an error if the frontend is unknown');
  });

  describe('#ratelimit', function () {
    it('should rate limit the connections for a frontend');
    it('should rate limit the connections globally');
  });

  describe('#compression', function () {
    it('should rate limit the compression for a frontend');
    it('should rate limit the compression globally');
  });

  describe('#info', function () {
    it('returns an object with the HAProxy info', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });

      proxy.info(function (err, data) {
        expect(err).to.not.be.instanceOf(Error);
        expect(data).to.be.a('object');

        expect(data.Tasks).to.equal(33);
        expect(data.PipesFree).to.equal(0);
        expect(data.Uptime).to.equal('0d 0h08m10s');

        done();
      });
    });
  });

  describe('#parse', function () {
    it('calls func parameter with true boolean result if buffer is falsey', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      proxy.parse('csv', null, funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, true);
    });
    it('parses output from haproxy socket using csv parser and calls func parameter with result', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      proxy.parse('csv', fixtures['show stat'].toString(), funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, fixtures['show stat parsed'].csv);
    });
    it('parses output from haproxy socket using string parser and calls func parameter with result', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      proxy.parse('string', fixtures['show stat'].toString(), funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, fixtures['show stat parsed'].string);
    });
    it('parses output from haproxy socket using array parser and calls func parameter with result', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      proxy.parse('array', fixtures['show stat'].toString(), funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, fixtures['show stat parsed'].array);
    });
    it('parses output from haproxy socket using a custom function parser and calls func parameter with result', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      var parser = function (buffer) {
        return buffer.substring(0,5);
      };
      proxy.parse(parser, fixtures['show stat'].toString(), funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, fixtures['show stat parsed'].func);
    });
    it('parses output from haproxy socket using object parser and calls func parameter with result if parser argument is unrecognized', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      proxy.parse('unknown_parser', fixtures['show stat'].toString(), funcSpy);
      expect(funcSpy).to.be.calledWith(undefined, fixtures['show stat parsed'].obj);
    });
    it('returns error and undefined if haproxy socket response is a single line whitespace string', function () {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock', which: '/fake/path/haproxy' });
      var funcSpy = sinon.spy();
      var err = new Error(' ');
      err.command = 'blah';
      proxy.parse('unknown_parser', ' ', funcSpy, 'blah');
      expect(funcSpy).to.be.calledWith(err, undefined);
    });
  });
});
