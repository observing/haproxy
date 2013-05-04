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
    server = hamock.createServer().listen(done);
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
    it('should clear the counters');
    it('should clear all the counters');
  });

  describe('#disable', function () {
    it('should disable the given backend');
    it('should ignore errors when the backend is already disabled');
    it('should error when a non existing backend is given');
    it('should error when a non existing server is given');
  });

  describe('#enable', function () {
    it('should enable a disabled backed');
    it('should not give errors when the backend is already enabled');
    it('should error when a non existing backend is given');
    it('should error when a non existing server is given');
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
    it('returns an object with the HAProxy info');
  });
});
