describe('haproxy:orchestrator', function () {
  'use strict';

  var HAProxy = require('../')
    , chai = require('chai')
    , expect = chai.expect;

  //
  // The location of the fixtures directory.
  //
  var path = require('path')
    , pidFile = path.resolve(__dirname, 'haproxy.pid')
    , fixtures = path.resolve(__dirname, 'fixtures')
    , orchestrator = fixtures + '/orchestrator.cfg'
    , sock = '/tmp/haproxy.sock'

  chai.Assertion.includeStack = true;

  describe('#start', function () {
    it('should set a pidfile if none exists', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator        
      });

      expect(haproxy.orchestrator.pidFile).to.equal('');
      haproxy.start(function (err) {
        expect(err).to.not.be.instanceof(Error);
        expect(haproxy.orchestrator.pidFile).to.not.equal('');

        done(err);
      });
    });

    it('should verify the given configuration', function (done) {
      var haproxy = new HAProxy(sock, {
        config: fixtures +'/broken.cfg'
      });

      haproxy.start(function starting(err) {
        expect(err).to.be.instanceof(Error);
        done();
      });
    });

    it('should run the application demonized', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator
      });

      haproxy.start(function (err, res, cmd) {
        expect(cmd).to.include('haproxy');
        expect(cmd).to.include('-D');
        
        done(err);
      });
    });

    it('should store the new pid', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator,
        pidFile: pidFile
      });

      expect(haproxy.orchestrator.pid).to.equal(null);

      haproxy.start(function (err) {
        expect(haproxy.orchestrator.pid).to.not.equal('');
        done(err);
      });
    });
  });

  describe('#stop', function () {
    it('should stop all the running processes');

    it('should stop the current running process');
  });

  describe('#reload', function () {
    it('should gracefully reload the server');

    it('should drop all the connections');

    it('set a new pid');
  });

  describe('#verify', function () {
    it('should verify the correctness of the configuration');
  });

  describe('#running', function () {
    it('should check if the current process is still running');

    it('should autodetect proxies if none was started by the process');
  });

  afterEach(function (done) {
    var haproxy = new HAProxy();

    //
    // Attempt to clean up all established HAProxies that are started
    //
    haproxy.stop(true, function () {
      done();
    });
  });
});
