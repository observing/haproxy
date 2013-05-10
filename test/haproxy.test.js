describe('haproxy', function () {
  'use strict';

  var hamock = require('./hamock')
    , HAProxy = require('../')
    , chai = require('chai')
    , expect = chai.expect;

  chai.Assertion.includeStack = true;

  //
  // Create a mockup server that responds with identical output as the HAProxy.
  //
  var server;
  before(function before(done) {
    server = hamock.createServer({ socket: '/tmp/fixture.sock' }).listen(done);
  });

  after(function after(done) {
    server.close(done);
  });

  it('is exported as a function', function () {
    expect(HAProxy).to.be.a('function');

    var proxy = new HAProxy();

    expect(proxy).to.be.instanceof(require('events').EventEmitter);
    expect(proxy).to.be.instanceof(HAProxy);
  });

  it('accepts a single object as argument', function () {
    var proxy = new HAProxy({ socket: '/tmp/fixture.sock', config: '/foo' });

    expect(proxy.socket).to.equal('/tmp/fixture.sock');
    expect(proxy.cfg).to.equal('/foo');
  });

  it('accepts a socket first argument', function () {
    var proxy = new HAProxy('/foo.sock');

    expect(proxy.socket).to.equal('/foo.sock');
  });

  it('emits haproxy:down when it cannot connect to the given socket', function (done) {
    var proxy = new HAProxy('/tmp/wtf/socket/lol/random/path/should/be/ok/now.sock');

    proxy.on('haproxy:down', function down(err) {
      expect(err).to.be.instanceof(Error);

      done();
    });

    proxy.clear(function clear(err) {
      expect(err).to.be.instanceof(Error);
    });
  });

  describe('#clear', function () {
    it('should clear the counters', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });
      proxy.clear(done);
    });

    it('should clear all the counters', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });
      proxy.clear(true, done);
    });
  });

  describe('#disable', function () {
    it('should disable the given backend', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.disable('realtime', 'node1', done);
    });

    it('should ignore errors when the backend is already disabled', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.disable('realtime', 'node1', done);
    });

    it('should error when a non existing backend is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.disable('realtimer', 'node1', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such backend.');

        done();
      });
    });

    it('should error when a non existing server is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.disable('realtime', 'node2', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such server.');

        done();
      });
    });
  });

  describe('#enable', function () {
    it('should enable a disabled backed', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.enable('realtime', 'node1', done);
    });

    it('should not give errors when the backend is already enabled', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.enable('realtime', 'node1', done);
    });

    it('should error when a non existing backend is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

      proxy.enable('realtimer', 'node1', function (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('No such backend.');

        done();
      });
    });

    it('should error when a non existing server is given', function (done) {
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

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
    it('returns the inital and current weight');
    it('returns an error when the given backend does not exist');
    it('returns an error when the given server does not exist');
    it('should set the weight when a weight argument is supplied');
    it('shoudl return an error when the set weight is to high');
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
      var proxy = new HAProxy({ socket: '/tmp/fixture.sock' });

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
});
