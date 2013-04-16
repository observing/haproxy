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
    expect(proxy.config).to.equal('/foo');
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
});
