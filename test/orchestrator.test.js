describe('haproxy:orchestrator', function () {
  'use strict';

  var request = require('request')
    , HAProxy = require('../')
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
    , timeout = 5000
    , servers;

  chai.config.includeStack = true;

  //
  // Make sure that every process is dead before we start so we don't get random
  // failures because we still have a haproxy running locally for testing
  // purposes.
  //
  // In addition to that
  //
  before(function (done) {
    var haproxy = new HAProxy();

    //
    // Attempt to clean up all established HAProxies that are started
    //
    haproxy.stop(true, function () {
      var online = 0;

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
  });

  //
  // As we generated HTTP servers, we need to close them again.
  //
  after(function () {
    Object.keys(servers).forEach(function close(id) {
      servers[id].close();
    });
  });

  it('prefixes the haproxy command', function () {
    var haproxy = new HAProxy(sock, {
        config: orchestrator
      , pidFile: pidFile
      , prefix: 'sudo'
    });

    expect(haproxy.orchestrator.prefix).to.equal('sudo');
    expect(haproxy.orchestrator.which).to.contain('haproxy');
  });

  describe('#running', function () {
    it('should check if the current process is still running', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
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
        , pidFile: pidFile
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
        // Technically this is throwing an error, since the pidfile cannot be
        // generated without sudo-rights, however we just ignore it for now.
        expect(haproxy.orchestrator.pidFile).to.equal('/var/run/haproxy.pid');

        done();
      });
    });

    it('should verify the given configuration', function (done) {
      var haproxy = new HAProxy(sock, {
          config: fixtures +'/broken.cfg'
        , pidFile: pidFile
      });

      haproxy.start(function starting(err) {
        expect(err).to.be.instanceof(Error);
        done();
      });
    });

    it('should run the application demonized', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
      });

      haproxy.start(function (err, res, cmd) {
        expect(cmd).to.include('haproxy');
        expect(cmd).to.include('-D');

        done(err);
      });
    });

    it('should store the new pid', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
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
        , pidFile: pidFile
      });

      var another = new HAProxy('/tmp/another.sock', {
          config: fixtures +'/another.cfg'
        , pidFile: '/tmp/another.pid'
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
        , pidFile: pidFile
      });

      var another = new HAProxy('/tmp/another.sock', {
          config: fixtures +'/another.cfg'
        , pidFile: '/tmp/another.pid'
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

  describe('#softstop', function () {
    this.timeout(timeout + 500);

    it('killing me softly (with his song)', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
      });

      function finish() {
        if (++finish.done === 2) done();
      }
      finish.done = 0;

      //
      // The request will take at least 5 seconds to complete
      //
      haproxy.start(function (err) {
        if (err) return done(err);

        request('http://localhost:8080/foo/', function (err, res, body) {
          if (err) return done(err);

          expect(body).to.include('server');
          expect(body).to.include('ello from port');

          finish();
        });

        var start = Date.now();
        setTimeout(function () {
          haproxy.softstop(function (err) {
            if (err) return done(err);

            expect(Date.now() - start).to.be.above(timeout);
            expect(haproxy.orchestrator.pid).to.equal('');
            finish();
          });
        }, 100);
      });
    });
  });

  describe('#reload', function (done) {
    this.timeout(timeout + 500);

    it('should gracefully reload the server', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
      });

      function finish() {
        if (++finish.done === 2) done();
      }
      finish.done = 0;

      //
      // The request will take at least 5 seconds to complete
      //
      haproxy.start(function (err) {
        if (err) return done(err);

        request('http://localhost:8080/foo/', function (err, res, body) {
          if (err) return done(err);

          expect(body).to.include('server');
          expect(body).to.include('ello from port');

          finish();
        });

        var start = Date.now();
        setTimeout(function () {
          haproxy.reload(function (err) {
            if (err) return done(err);

            expect(Date.now() - start).to.be.below(timeout);
            finish();
          });
        }, 100);
      });
    });

    it('should reload the server instantly', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
      });

      function finish() {
        if (++finish.done === 2) done();
      }
      finish.done = 0;

      //
      // The request will take at least 5 seconds to complete
      //
      haproxy.start(function (err) {
        if (err) return done(err);

        request('http://localhost:8080/foo/', function (err, res) {
          if (err) expect(err.message).to.include('hang up');
          finish();
        });

        var start = Date.now();
        setTimeout(function () {
          haproxy.reload(true, function (err) {
            if (err) return done(err);

            expect(Date.now() - start).to.be.below(timeout);
            finish();
          });
        }, 100);
      });
    });

    it('set a new pid', function (done) {
      var haproxy = new HAProxy(sock, {
          config: orchestrator
        , pidFile: pidFile
      });

      haproxy.start(function (err) {
        if (err) return done(err);

        var pid = haproxy.orchestrator.pid;

        haproxy.reload(function (err) {
          if (err) return done(err);

          expect(haproxy.orchestrator.pid).to.not.equal(pid);
          haproxy.stop(done);
        });
      });
    });
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
