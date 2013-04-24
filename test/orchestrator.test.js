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
    , sock = '/tmp/haproxy.sock';

  chai.Assertion.includeStack = true;

  //
  // Make sure that every process is dead before we start so we don't get random
  // failures because we still have a haproxy running locally for testing
  // purposes.
  //
  before(function (done) {
    var haproxy = new HAProxy();

    //
    // Attempt to clean up all established HAProxies that are started
    //
    haproxy.stop(true, function () {
      done();
    });
  });

  describe('#running', function () {
    it('should check if the current process is still running', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator
      });

      haproxy.running(function (err, running) {
        if (err) return done(err);

        expect(running).to.equal(false);

        haproxy.start(function (err) {
          if (err) return done(err);

          haproxy.running(function (err, running) {
            if (err) return done(err);

            expect(running).to.equal(true);
            haproxy.stop(done);
          });
        });
      });
    });

    it('should autodetect proxies if none was started by the process', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator
      });

      haproxy.start(function (err) {
        if (err) return done(err);

        var proxy = new HAProxy(sock, {
          config: orchestrator
        });

        proxy.running(function (err, running) {
          if (err) return done(err);

          expect(running).to.equal(true);
          haproxy.stop(done);
        });
      });
    });
  });

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

      expect(haproxy.orchestrator.pid).to.equal('');

      haproxy.start(function (err) {
        expect(haproxy.orchestrator.pid).to.not.equal('');
        done(err);
      });
    });
  });

  describe('#stop', function () {
    it('should stop all the running processes', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator
      });

      var another = new HAProxy('/tmp/another.sock', {
        config: fixtures +'/another.cfg',
        pidFile: '/var/run/another.pid'
      });

      //
      // start both servers, ensure they are both running, killall ensure that
      // they are all not running.
      //
      function running(value, fn) {
        haproxy.running(function (err, running) {
          if (err) return done(err);

          expect(running).to.equal(value);
          another.running(function (err, running) {
            if (err) return done(err);

            expect(running).to.equal(value);
            fn();
          });
        });
      }

      function stop(fn) {
        haproxy.stop(true, function (err) {
          if (err) return done(err);

          running(false, fn);
        });
      }

      haproxy.start(function (err) {
        if (err) return done(err);

        another.start(function (err) {
          if (err) return done(err);

          running(true, stop.bind(undefined, done));
        });
      });
    });

    it('should only stop the current running process', function (done) {
      var haproxy = new HAProxy(sock, {
        config: orchestrator
      });

      var another = new HAProxy('/tmp/another.sock', {
        config: fixtures +'/another.cfg',
        pidFile: '/var/run/another.pid'
      });

      //
      // start both servers, ensure they are both running, killall ensure that
      // they are all not running.
      //
      function running(value, fn) {
        haproxy.running(function (err, running) {
          if (err) return done(err);

          expect(running).to.equal(value);
          another.running(function (err, running) {
            if (err) return done(err);

            expect(running).to.equal(value);
            fn();
          });
        });
      }

      function stop(fn) {
        haproxy.stop(function (err) {
          if (err) return done(err);

          haproxy.running(function (err, running) {
            if (err) return done(err);

            expect(running).to.equal(false);

            another.running(function (err, running) {
              if (err) return done(err);

              expect(running).to.equal(true);
              another.stop(fn);
            });
          });
        });
      }

      haproxy.start(function (err) {
        if (err) return done(err);

        another.start(function (err) {
          if (err) return done(err);

          running(true, stop.bind(undefined, done));
        });
      });
    });
  });

  describe('#reload', function () {
    it('should gracefully reload the server');

    it('should drop all the connections');

    it('set a new pid');
  });

  describe('#verify', function () {
    it('should verify the correctness of the configuration', function (done) {
      var broken = new HAProxy(sock, {
        config: orchestrator
      });

      broken.verify(function (err, okay) {
        expect(okay).to.equal(true);
        done(err);
      });
    });

    it('should verify the broken configuration', function (done) {
      var broken = new HAProxy(sock, {
        config: fixtures +'/broken.cfg'
      });

      broken.verify(function (err, okay) {
        expect(okay).to.equal(false);
        done(err);
      });
    });
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
