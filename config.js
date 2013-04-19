/**
 * Config sections and bitmasks.
 *
 * @type {Object}
 */
module.exports.sections = {
    global: 1 << 1    // 2
  , defaults: 1 << 2  // 4
  , frontend: 1 << 3  // 8
  , listen: 1 << 4    // 16
  , backend: 1 << 5   // 32
};

/**
 * Configuration keys and bitwise value, each bitwise value appoints
 * sections to which the key belongs.
 */
module.exports.keys = {
    2: [
        'ca-base', 'chroot', 'crt-base', 'daemon', 'debug', 'gid', 'group'
      , 'log-send-hostname', 'maxcompcpuusage', 'maxcomprate', 'maxconnrate'
      , 'maxpipes', 'maxsslconn', 'nbproc', 'node', 'noepoll', 'nokqueue'
      , 'nopoll', 'nosplice', 'pidfile', 'quiet', 'spread-checks', 'stats'
      , 'tune.bufsize', 'tune.chksize', 'tune.comp.maxlevel', 'tune.http.cookielen'
      , 'tune.http.maxhdr', 'tune.maxaccept', 'tune.maxpollevents'
      , 'tune.maxrewrite', 'tune.pipesize', 'tune.rcvbuf.client'
      , 'tune.rcvbuf.server', 'tune.sndbuf.client', 'tune.sndbuf.server'
      , 'tune.ssl.cachesize', 'tune.ssl.lifetime', 'tune.ssl.maxrecord'
      , 'tune.zlib.memlevel', 'tune.zlib.windowsize', 'uid', 'ulimit-n'
      , 'unix-bind', 'user'
    ]
  , 24: [
        'bind', 'capture cookie', 'capture request header', 'capture response header'
      , 'monitor fail', 'tcp-request connection', 'use_backend'
    ]
  , 28: [
        'backlog', 'default_backend', 'monitor-net', 'monitor-uri'
      , 'option accept-invalid-http-request', 'option clitcpka', 'option contstats'
      , 'option dontlog-normal', 'option dontlognull', 'option http-use-proxy-header'
      , 'option log-separate-errors', 'option logasap', 'option socket-stats'
      , 'option tcp-smart-accept', 'rate-limit sessions', 'timeout client'
      , 'unique-id-format', 'unique-id-header'
    ]
  , 30: [ 'maxconn' ]
  , 48: [
        'appsession', 'dispatch', 'http-check expect', 'server', 'stats admin'
      , 'stats http-request', 'stick match', 'stick on', 'stick store-request'
      , 'stick store-response', 'stick-table', 'tcp-response content'
      , 'tcp-response inspect-delay', 'use-server'
    ]
  , 52: [
        'balance', 'cookie', 'default-server', 'fullconn', 'hash-type'
      , 'http-check disable-on-404', 'http-check send-state', 'option abortonclose'
      , 'option accept-invalid-http-response', 'option allbackups'
      , 'option checkcache', 'option httpchk', 'option lb-agent-chk'
      , 'option ldap-check', 'option log-health-checks', 'option mysql-check'
      , 'option persist', 'option pgsql-check', 'option redis-check'
      , 'option redispatch', 'option smtpchk', 'option srvtcpka'
      , 'option ssl-hello-chk', 'option tcp-smart-connect', 'option transparent'
      , 'persist rdp-cookie', 'retries', 'source', 'stats auth', 'stats enable'
      , 'stats hide-version', 'stats realm', 'stats refresh', 'stats scope'
      , 'stats show-desc', 'stats show-legends', 'stats show-node', 'stats uri'
      , 'timeout check', 'timeout connect', 'timeout queue', 'timeout server'
      , 'timeout tunnel'
    ]
  , 56: [
        'acl', 'block', 'force-persist', 'http-request', 'id', 'ignore-persist'
      , 'redirect', 'reqadd', 'reqallow', 'reqdel', 'reqdeny', 'reqiallow'
      , 'reqidel', 'reqideny', 'reqipass', 'reqirep', 'reqisetbe', 'reqitarpit'
      , 'reqpass', 'reqrep', 'reqsetbe', 'reqtarpit', 'rspadd', 'rspdel'
      , 'rspdeny', 'rspidel', 'rspideny', 'rspirep', 'rsprep', 'tcp-request content'
      , 'tcp-request inspect-delay'
    ]
  , 58: [ 'description' ]
  , 60: [
        'bind-process', 'compression', 'disabled', 'enabled', 'errorfile', 'errorloc'
      , 'errorloc302', 'errorloc303', 'grace', 'mode', 'option forceclose'
      , 'option forwardfor', 'option http-no-delay', 'option http-pretend-keepalive'
      , 'option http-server-close', 'option http_proxy', 'option httpclose'
      , 'option httplog', 'option independent-streams', 'option nolinger'
      , 'option originalto', 'option splice-auto', 'option splice-request'
      , 'option splice-response', 'option tcpka', 'option tcplog'
      , 'timeout http-keep-alive', 'timeout http-request', 'timeout tarpit'
    ]
  , 62: [ 'log' ]
};
