// Quickstart script to run a webhook stub and adapter locally for review/testing.
// Usage: node scripts/quickstart-listeners.js
// Optional env vars: WEBHOOK_PORT (default 3000), ADAPTER_PORT (default 3001)

(async () => {
  const http = require('http');
  const path = require('path');
  const stubPort = Number(process.env.WEBHOOK_PORT || 3000);
  const adapterPort = Number(process.env.ADAPTER_PORT || 3001);

  let stubServer = null;
  let adapterServer = null;
  let stopFns = [];

  function startFallbackStub(port) {
    const server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          console.log('[stub] received POST', body);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, () => console.log(`[stub] listening on ${port}`));
    return () => new Promise((resolve) => server.close(() => resolve()));
  }

  function startFallbackAdapter(port) {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('adapter placeholder');
    });
    server.listen(port, () => console.log(`[adapter] listening on ${port}`));
    return () => new Promise((resolve) => server.close(() => resolve()));
  }

  function tryRequire(modulePath) {
    try {
      return require(modulePath);
    } catch (err) {
      if (err && err.code === 'MODULE_NOT_FOUND') return null;
      throw err;
    }
  }

  try {
    // Attempt to load provided listener modules under src/listener
    const stubModule = tryRequire(path.join(__dirname, '..', 'src', 'listener', 'stub')) || tryRequire(path.join(process.cwd(), 'src', 'listener', 'stub'));
    const adapterModule = tryRequire(path.join(__dirname, '..', 'src', 'listener', 'adapter')) || tryRequire(path.join(process.cwd(), 'src', 'listener', 'adapter'));

    if (stubModule && typeof stubModule.start === 'function') {
      console.log('Starting project-provided webhook stub...');
      const stop = await stubModule.start(stubPort);
      if (typeof stop === 'function') stopFns.push(stop);
    } else {
      console.log('No project-provided stub found, starting fallback stub...');
      stopFns.push(startFallbackStub(stubPort));
    }

    if (adapterModule && typeof adapterModule.start === 'function') {
      console.log('Starting project-provided adapter...');
      const stop = await adapterModule.start(adapterPort);
      if (typeof stop === 'function') stopFns.push(stop);
    } else {
      console.log('No project-provided adapter found, starting fallback adapter...');
      stopFns.push(startFallbackAdapter(adapterPort));
    }

    console.log('\nQuickstart running:');
    console.log(`- webhook stub: http://localhost:${stubPort}`);
    console.log(`- adapter: http://localhost:${adapterPort}`);
    console.log('\nPress CTRL-C to stop.');

    const shutdown = async () => {
      console.log('\nShutting down...');
      try {
        await Promise.all(stopFns.map((fn) => fn()));
        console.log('Stopped all services.');
        process.exit(0);
      } catch (err) {
        console.error('Error while stopping services:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start quickstart listeners:', err);
    process.exit(1);
  }
})();