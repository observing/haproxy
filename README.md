```
Here be deamons, this module is still under heavy development not all parsers
are hooked up on the API's yet. Feel free to contribute and build the best
HAProxy orchestration module out there.
```

[![Version npm][version]](http://browsenpm.org/package/haproxy)[![Build Status][build]](https://travis-ci.org/observing/haproxy)[![Dependencies][david]](https://david-dm.org/observing/haproxy)[![Coverage Status][cover]](https://coveralls.io/r/observing/haproxy?branch=master)

[version]: http://img.shields.io/npm/v/haproxy.svg?style=flat-square
[build]: http://img.shields.io/travis/observing/haproxy/master.svg?style=flat-square
[david]: https://img.shields.io/david/observing/haproxy.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/observing/haproxy/master.svg?style=flat-square

# haproxy

HAProxy is an amazing proxy, it has support for many different algorithms for
load balancing, it can handle HTTP, TCP, WebSocket connects, does SSL
termination and much much more. But managing these proxies can be a bit of
a pain. That's where `haproxy` comes in, it provides a access to the stat socket
of HAProxy which allows you to enable, disable servers and front-ends, read out
stats and much more. In addition to that it's also capable of hot reloading
configuration changes and starting, stopping your HAProxy, even when it's
running as a daemon.

## Installation

The package is released in `npm`, the Node.js package registry. To add it as a
dependency to any project, do:

```
npm install haproxy --save
```

## Testing

Tests can be executed after installation by running `npm test`. For test to run
properly *Haproxy 1.5.12* or greater is required. See commands below:

```bash
sudo apt-get install -qq build-essential libssl-dev libev-dev
wget http://www.haproxy.org/download/1.5/src/haproxy-1.5.12.tar.gz
tar xzvf haproxy-1.5.12.tar.gz
cd haproxy-1.5.12

# Build haproxy on OSX, see below for different OS, after verify that
# haproxy is installed and has the correct version.
sudo make TARGET=generic USE_OPENSSL=1
sudo make install
haproxy -v

# Finally run the tests in the github repository
git clone git@github.com:observing/haproxy.git
cd haproxy
npm install
npm test
```

- For Linux run: `make TARGET=linux26 USE_OPENSSL=1`
- For Solaris/Smart OS: `make TARGET=solaris USE_OPENSSL=1`
- For OSX: `make TARGET=generic USE_OPENSSL=1`

## haproxy.cfg

In order to make your HAProxy installation work with this module you need to
expose the `stats socket` interface of HAProxy. If you don't have this specified
in your configuration please add the following to the `global` section of your
configuration.

```
global
  # Exposes the stat socket so we can manage the proxy through node.js
  stats socket /tmp/haproxy.sock level admin
```

Reload you configuration to make this change active and you should be ready to
rock.

# API

```js
'use strict';

var HAProxy = require('haproxy');

var haproxy = new HAProxy('/optional/socket/path.sock', { /* options */ });
```

An alternate interface is:

```js
var haproxy = new HAProxy({ socket: 'path' /*, the rest of the options */});
```

I personally prefer the first interface as a correct socket path is required for
a functioning module. The options are not required, but the following options
are supported:

- `pid`: The process id
- `pidFile`: The location of the pid file
- `config`: The location of the configuration file
- `discover`: Tries to find your HAProxy instance if you don't know the pid
- `socket`: The location of the unix socket
- [optional] `which`: The location of the HAProxy
- [optional] `prefix`: Prefixes the HAProxy commands. Useful for `sudo`

There's a lot of freedom in this module, callbacks are always optional so you
can do fire and forget management as well as how you add the callbacks.

```js
haproxy.method('value', function () { .. });

//
// Is the same as
//

haproxy.method('value').call(function () { .. });
```

It also supports a chaining API:

```js
haproxy.method().and.method2('value').and.method3('value', function () {
  // woop woop
});

//
// The example above will call method() and method() as fire and forget and
// method3() is called with a callback. It doesn't maintain order so it could be
// that method() is called after method3() as it could take longer to complete.
//
```

The following methods are available:

### HAProxy.start(fn)

Start a new HAProxy instance with the given configuration. It will verify the
configuration before it attempts to start HAProxy. The process will
automatically be daemonized and the pidFile will be stored in the supplied
pidFile location or default to `/var/run/haproxy.pid`.

Please note that it does not check if there are any HAProxy processes running.

```js
haproxy.start(function (err) {
  .. yay it's started ..
});
```

### HAProxy.stop([all], fn)

Stops the currently running HAProxy process, even if it's not started using
`HAProxy.start` it will find the process using the supplied pidFile argument or
scans the process list for a running process.

When the `all` boolean is supplied it will kill all running HAProxy processes
instead of the first one it found.

```js
haproxy.stop(function (err) {
 .. the proxy is stopped ..
});
```

### HAProxy.softstop(fn)

This executes a softstop on all running HAProxy installations. So instead of
termining all active connections it will wait for them to finish and then, kill
the process.

```js
haproxy.softstop(function (err) {
  .. wheee ..
});
```

### HAProxy.reload([hard], fn)

Hot reload the configuration without any downtime. If the `hard` boolean is
given it will terminate the process forcefully and kill all active connections.

Before it reloads it will again, verify the configuration so we don't create any
broken mess.

```js
haproxy.reload(function (err) {
  .. the proxy has reloaded ..
});
```

### HAProxy.verify(fn)

Verify the given configuration to see if it's all in working order.

```js
HAProxy.verify(function (err, working) {
 .. failed to do things ..
 if (working) .. yay configuration is working ..
});
```

### HAProxy.running(fn)

Scans the system for running HAProxy instances. It's mostly used internally but
it might be useful for you as well.

```js
HAProxy.running(function (err, running) {
  if (running) .. yup, process running ..
});
```

### HAProxy.clear([all], fn)

Clear the max values of the statistic counts in the proxy for each front-end and
backend. When the `all` boolean is supplied it will clean all the stats. This
has the same effect as restarting.

```js
haproxy.clear(function (err) {
  // stats cleared
})
```

### HAProxy.disable(backend, server, fn)

Mark the given server a down for maintenance, in this mode no checks will be
preformed on the server until it leaves maintenance.

```js
haproxy.disable('realtime', 'server1', function (err) {
  // server out of the pool
});
```

### HAProxy.enable(backend, server, fn)

If the server was previously marked as down for maintenance, it will mark the
server as up again and all checks will be re-enabled.

```js
haproxy.enable('realtime', 'server1', function (err) {
  // server enabled again
});
```

### HAProxy.pause(frontend, fn)

Mark the frontend as temporarily stopped. This corresponds to the mode which is
used during a softrestart. The frontend releases the port it was bound on but it
can be enabled again when needed.

```js
haproxy.pause('frontend', function (err) {
  // disable the frontend
});
```

### HAProxy.resume(frontend, fn)

Resume the front-end that you previously paused.

```js
haproxy.resume('frontend', function (err) {
  // enable the frontend
});
```

### HAProxy.errors([id], fn)

Show the server errors or the errors for the given session id. The session id is
optional.

```js
haproxy.errors(function (err, errors) {
  console.log(errors);
});
```

### HAProxy.weight(backend, server, [weight], fn)

Get the assigned weight for the server from the given backend.

```js
haproxy.weight('backend', 'server1', function (err, weight) {
  console.log(weight);
});
```

If the `weight` argument is set, it will automatically set the weight for this
server:

```js
haproxy.weight('backend', 'server1', 10, function (err) {
// woop
});
```

Please note that the weight should be between 0 and 255

### HAProxy.maxconn([frontend], max, fn)

Update the maxconnection setting for the frontend.

```js
haproxy.maconn('public', 809809, function (err) {
  // handle failures.
});
```

If no frontend is supplied it will apply this configuration globally

```js
haproxy.maconn(809809, function (err) {
  // handle failures.
});
```

### HAProxy.ratelimit(24242, fn)

Change the process-wide rate limit. Setting this value to 0 will disable the
rate-limitter.

```js
haproxy.connections(4242, function (err) {
  // handle errors ._.
});
```

### HAProxy.compression(2, fn)

Change the maximum input compression rate.

```js
haproxy.compression(3, function (err) {
  // oh noes. error handling, but this is optional, if you don't care about
  // errors
});
```

### HAProxy.info(fn)

Retrieve some information about the HAProxy

```js
haproxy.info(function (err, info) {
  // do something with the info..
});
```

### HAProxy.session([id], fn)

Dump all know session if no session id is provided.

```js
haproxy.session(function (err, sess) {
  // wooop
});
```

### HAProxy.stat(id, type, id, fn)

Dump all statistics, if you want everything, supply -1 for all values.

```js
haproxy.stat('-1', '-1', '-1', function (err, stats) {

});
```

### License

MIT:

Copyright (c) 2013 Observe.it (http://observe.it) opensource@observe.it

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
