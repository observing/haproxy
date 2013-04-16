# Fixtures

These are the responses that are outputted by HAProxy when a given command is
received. The responses are the output of HAProxy 1.5-dev18 which was released
on 2013/04/03.

The output is created by using the `socat` tool:

```
echo "show info" | socat unix-connect:/tmp/haproxy.sock stdio > fixture.out
```

These responses are then mapped in the `index.js` file in the folder so it can
be used in our "HAMOCKproxy".
