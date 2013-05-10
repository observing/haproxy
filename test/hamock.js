'use strict';

var net = require('net')
  , fs = require('fs');

/**
 * Create new HA proxy mock server.
 *
 * @param {Object} options
 * @api public
 */
exports.createServer = function createServer(options) {
  return new Hamock(options || {});
};

/**
 * A HAProxy unix-socket mockup server.
 *
 * @constructor
 * @param {Object} options
 * @api private
 */
function Hamock(options) {
  this.server = options.server || net.createServer({ allowHalfOpen: true });
  this.server.on('connection', this.handle.bind(this));
  this.commands = options.commands || require('./fixtures');
  this.socket = options.socket || '/tmp/haproxy.sock';
  this.sockets = [];
}

/**
 * Handles requests.
 *
 * @param {Socket} socket TCP socket of the connection.
 * @api private
 */
Hamock.prototype.handle = function handle(socket) {
  this.sockets.push(socket);

  var command = '';
  socket.setEncoding('utf-8');

  socket.on('data', function data(buffer) {
    command += buffer;
  }).on('end', function end() {
    var handler = command.trim()
      , data = this.commands[handler];

    socket.end(data || 'Unkown command: "'+ handler +'"');
  }.bind(this));

  socket.once('close', function close() {
    this.sockets.splice(this.sockets.indexOf(socket), 1);
  }.bind(this));
};

/**
 * Start listening on a something. Accepts what ever a plain net.Server accepts.
 *
 * @param {String} path Location of the socket;
 * @param {Function} fn Callback function
 * @api public
 */
Hamock.prototype.listen = function listen(path, fn) {
  if ('function' === typeof path) {
    fn = path;
    path = null;
  }

  if (path) this.socket = path;

  //
  // Clean up the existing socket so we can connect.
  //
  if (fs.existsSync(this.socket)) fs.unlinkSync(this.socket);

  this.server.listen(this.socket, fn);
  return this;
};

/**
 * Closes the server and kills all the connections.
 *
 * @param {Function} fn Callback when everthing is cleaned.
 * @api public
 */
Hamock.prototype.close = function close(fn) {
  this.sockets.forEach(function each(socket) {
    socket.end();

    if (socket.unref) socket.unref();
  });

  this.server.close(function closed() {
    if (fs.existsSync(this.socket)) fs.unlinkSync(this.socket);
    if (fn) fn.apply(fn, arguments);
  }.bind(this));

  return this;
};
