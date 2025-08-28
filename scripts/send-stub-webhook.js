// Convenience script to send a sample webhook event to the Raydium webhook stub.
// Usage: node scripts/send-stub-webhook.js [<webhookUrl>]

(async () => {
  try {
    const url = process.argv[2] || process.env.WEBHOOK_URL || 'http://localhost:3000/raydium-webhook';
    const payload = { type: 'candidate', id: 'test-1', data: { foo: 'bar' }, timestamp: Date.now() };
    const body = JSON.stringify(payload);
    const { URL } = require('url');
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(opts, (res) => {
      let resp = '';
      res.on('data', (c) => (resp += c));
      res.on('end', () => {
        console.log('sent to', url, 'status', res.statusCode, 'response', resp);
        process.exit(0);
      });
    });

    req.on('error', (err) => {
      console.error('request error', err);
      process.exit(1);
    });

    req.write(body);
    req.end();
  } catch (err) {
    console.error('Failed to send stub webhook:', err);
    process.exit(1);
  }
})();