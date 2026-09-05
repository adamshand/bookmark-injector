# Loopback test TLS

Do not store certificates or private-key files here. The repository is also the
unpacked Chrome extension directory, and Chrome flags bundled PEM files even
when they are harmless test fixtures.

`browser-tests/server.mjs` uses OpenSSL to generate a fresh one-day certificate
in an OS temporary directory outside the repository. It reads the key and
certificate into memory, then immediately removes the temporary files. Cleanup
also runs if certificate generation fails.

Browser tests require `openssl` on PATH. Only the suite's isolated Chromium
process ignores certificate validation; never add test certificates to a system
trust store. The extension's production HTTPS requirement is unchanged.

Browser API responses are synthetic scenarios controlled by tests. They are not
the version-pinned upstream captures in `test/fixtures/providers/`.
