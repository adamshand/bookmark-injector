# Loopback test certificate

`localhost-cert.pem` and `localhost-key.pem` are public, disposable test material.
The private key is intentionally committed: it protects no account or real data.
Never deploy it or add it to your system trust store.

The browser suite binds its HTTPS fixture server to `127.0.0.1` on an ephemeral
port. Only the suite's isolated Chromium process ignores certificate validation.
The extension's production HTTPS requirement is unchanged.

To replace these files:

```sh
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout browser-tests/fixtures/localhost-key.pem \
  -out browser-tests/fixtures/localhost-cert.pem \
  -days 3650 -subj '/CN=localhost'
```

Browser API responses are synthetic scenarios controlled by tests. They are not
the version-pinned upstream captures in `test/fixtures/providers/`.
