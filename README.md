# haproxy

HAProxy is an amazing proxy, it has support for many different algorithms for
load balancing, it can handle HTTP, TCP, WebSocket connects, does SSL
termination and much much more. But managing these proxies can be a bit of
a pain. That's where `haproxy` comes in, it provides a access to the stat socket
of HAProxy which allows you to enable, disable servers and front-ends, read out
stats and much more. In addition to that it's also capable of hot reloading
configuration changes and starting, stopping your HAProxy, even when it's
running as a deamon.

## Installation

The package is released in `npm`, the Node.js package registery:

```
npm install haproxy --save
```

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
- [optional] `which`: The location of the haproxy

The following methods are available:

### HAProxy.clear(all, fn)

Clear the max values of the statistic counts in the proxy for each front-end and
backend. When the `all` boolean is supplied it will clean all the stats. This
has the same effect as restarting.

```js
haproxy.clear(function (err) {
  // 
})
```
