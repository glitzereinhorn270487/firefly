# Odyssee

A listener and webhook receiver for monitoring Raydium events and token authority changes on Solana.

## Listener / VPS deployment

The Node.js listener can be built and run independently from the Next.js app using the dedicated TypeScript configuration.

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the listener:**
   ```bash
   npm run build:listener
   ```

4. **Start the listener:**
   ```bash
   npm run start:listener
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev:listener
   ```

### Docker Deployment

The listener uses `tsconfig.node.json` for Node.js-specific TypeScript compilation to CommonJS modules in the `dist/` directory.

### Environment Variables

See `.env.example` for required environment variables:
- `RPC_WSS`: QuickNode WebSocket endpoint
- `WEBHOOK_URL`: Target webhook URL for forwarding events
- `WEBHOOK_AUTH`: Optional Bearer token for authentication
- `PORT`: Server port (default: 3000)
- `MAX_GETTX_PER_SEC`: Rate limit for transaction queries (default: 5)

### Files

- `tsconfig.node.json`: TypeScript configuration for Node.js build
- `.env.example`: Environment variable documentation
- `src/listener.ts`: Main listener implementation
- `src/webhook_handler.ts`: Webhook receiver implementation