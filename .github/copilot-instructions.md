# Odyssee (Firefly) - Solana Raydium Event Listener

Odyssee is a TypeScript Node.js application that monitors Solana blockchain events, specifically Raydium program activities, and forwards them via webhooks. It includes paper trading functionality, sampling filters, and comprehensive logging.

**Always reference these instructions first and only fallback to search or bash commands when you encounter unexpected information that contradicts what's documented here.**

## Working Effectively

### Bootstrap and Build Process

- **Install dependencies:**
  ```bash
  npm install
  ```
  Takes ~17 seconds. No errors expected.

- **Build the listener application:**
  ```bash
  npm run build:listener
  ```
  OR
  ```bash
  npm run build:all
  ```
  Takes ~2 seconds. Builds TypeScript to `dist/` directory using `tsconfig.node.json`.

- **Run comprehensive tests:**
  ```bash
  npm test
  ```
  Takes ~6 seconds. NEVER CANCEL. All 40 tests across 5 test suites must pass.

- **Run test coverage:**
  ```bash
  npm run test:coverage
  ```
  Takes ~11 seconds. NEVER CANCEL. Set timeout to 30+ minutes for safety.

### Development Workflow

- **Development mode with auto-reload:**
  ```bash
  npm run dev:listener
  ```
  Requires environment variables. Will show error about missing RPC_WSS and WEBHOOK_URL if not configured.

- **Copy environment template:**
  ```bash
  cp .env.example .env
  # Edit .env with your Solana QuickNode WSS endpoint and webhook URL
  ```

- **Run individual components in development:**
  ```bash
  npm run dev:webhook    # Webhook receiver
  npm run dev:metrics    # Health/metrics server on port 3001
  ```

### Production Deployment

- **Start production listener:**
  ```bash
  npm run start:listener
  ```
  Runs `node dist/listener.js`. Requires build to be completed first.

- **Start individual production services:**
  ```bash
  npm run start:webhook   # Production webhook receiver
  npm run start:metrics   # Production metrics server
  ```

### Docker Deployment

- **Build Docker image:**
  ```bash
  docker build -t firefly-listener .
  ```
  Takes ~76 seconds. NEVER CANCEL. Set timeout to 120+ minutes. Uses Node 18 Alpine base.

- **The Dockerfile:**
  - Installs production dependencies
  - Copies source and pre-built `dist/` if available
  - Builds the listener if sources are present
  - Exposes port 3000
  - Runs `dist/listener.js`

### Complete Workflow Validation

**From fresh clone to working application** (validated timing):
```bash
git clone https://github.com/glitzereinhorn270487/firefly.git
cd firefly
npm install          # ~17 seconds
npm run build:listener  # ~2 seconds  
npm test             # ~6 seconds
```
Total time: ~25 seconds for complete setup and validation.

## Linting and Code Quality

- **No linting configured**: `npm run lint` outputs "Linting not configured"
- **No formatting tools**: No prettier or eslint setup
- **TypeScript strict mode**: Enabled in both `tsconfig.json` and `tsconfig.node.json`

## Testing Strategy

### Test Structure
- Tests located in `tests/` directory
- Uses Jest with TypeScript support
- Test timeout: 10 seconds per test
- Coverage reports generated in `coverage/` directory

### Key Test Commands
```bash
npm test                    # Run all tests (~6 seconds)
npm run test:watch         # Watch mode for development  
npm run test:coverage      # Full coverage report (~11 seconds)
```

### **CRITICAL VALIDATION REQUIREMENT**
After making any changes to core functionality:
1. **ALWAYS run the complete test suite**: `npm test`
2. **ALWAYS build the listener**: `npm run build:listener`
3. **ALWAYS test a brief startup**: `timeout 5s npm run dev:listener` (should show config error if .env missing)
4. **Verify the metrics endpoint**: `timeout 5s npm run dev:metrics` (should start server on port 3001)

## Environment Configuration

### Required Environment Variables
- `RPC_WSS`: Solana QuickNode WebSocket endpoint
- `WEBHOOK_URL`: Target webhook URL for forwarding events  
- `WEBHOOK_AUTH`: Optional Bearer token for authentication

### Optional Configuration
- `SAMPLE_RATE`: Event sampling rate (0.0 to 1.0, default: 0.05)
- `SAMPLE_BY`: Sample by 'poolAddress' or 'txHash' (default: poolAddress)
- `PAPER_TRADING`: Enable simulated trading (default: false)
- `LOG_LEVEL`: Logging level - debug, info, warn, error (default: info)
- `PORT`: Server port (default: 3000)
- `MAX_GETTX_PER_SEC`: Rate limit for transaction queries (default: 5)

## Architecture and Key Components

### TypeScript Configuration
- **`tsconfig.json`**: Next.js configuration (ESNext modules, no emit)
- **`tsconfig.node.json`**: Node.js listener configuration (CommonJS, outputs to `dist/`)
- **`jest.config.js`**: Test configuration with TypeScript support

### Core Modules (`src/` directory)
- **`listener.ts`**: Main application entry point
- **`webhook_handler.ts`**: Webhook receiver implementation  
- **`config/index.ts`**: Environment configuration management
- **`filters/sampling.ts`**: Deterministic event sampling (100% test coverage)
- **`trading/paperTrader.ts`**: Simulated trading functionality
- **`metrics/health.ts`**: Health check and metrics endpoints
- **`logging/logger.ts`**: Structured JSON logging

### Build Artifacts
- **`dist/`** directory contains compiled JavaScript
- **Source maps** and **TypeScript declarations** included
- **Modular structure** mirrors `src/` organization

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/ci.yml`)
- Runs on Node.js 18
- Executes: `npm ci`, `npm run lint --if-present`, `npm run build --if-present`, `npm test --if-present`
- **All commands succeed in the current codebase**

### Deployment Scripts
- **`scripts/deploy.sh`**: VPS deployment script for systemd service
- **`ops/odyssee-listener.service`**: SystemD service configuration
- **Environment file**: Expected at `/etc/odyssee/.env` in production

## **TIMING EXPECTATIONS & NEVER CANCEL WARNINGS**

| Command | Expected Time | Timeout Setting | Never Cancel Warning |
|---------|---------------|-----------------|---------------------|
| `npm install` | ~17 seconds | 600 seconds | Standard npm install |
| `npm run build:listener` | ~2 seconds | 300 seconds | Fast TypeScript compilation |
| `npm test` | ~6 seconds | 300 seconds | **NEVER CANCEL** - All 40 tests must complete |
| `npm run test:coverage` | ~11 seconds | 600 seconds | **NEVER CANCEL** - Coverage analysis takes time |
| `docker build` | ~76 seconds | 7200 seconds | **NEVER CANCEL** - Docker builds can be slow |
| Full workflow | ~25 seconds | 900 seconds | **NEVER CANCEL** - Complete validation required |

## **MANUAL VALIDATION SCENARIOS**

After making changes, ALWAYS validate these scenarios:

### **Basic Application Startup**
```bash
# Should show configuration error for missing environment
timeout 10s npm run dev:listener
# Expected output: Missing required environment variables error
```

### **Metrics Endpoint Functionality**  
```bash
# Should start metrics server on port 3001
timeout 5s npm run dev:metrics
# Expected output: "Metrics server listening on port 3001"
```

### **Build and Production Startup**
```bash
npm run build:listener
timeout 5s npm run start:metrics
# Expected output: Production metrics server starts successfully
```

### **Test Suite Validation**
```bash
npm test
# Expected: All 40 tests pass across 5 test suites
```

## Common Development Tasks

### **Adding New Features**
1. Always run existing tests first: `npm test`
2. Create feature in `src/` directory following existing patterns
3. Add tests in `tests/` directory matching the module structure
4. Build and test: `npm run build:listener && npm test`
5. Validate startup: `timeout 5s npm run dev:listener`

### **Debugging Configuration Issues**
1. Check environment variables in `.env` file
2. Review config validation in `src/config/index.ts`  
3. Run with debug logging: `LOG_LEVEL=debug npm run dev:listener`
4. Use metrics endpoint for health checking: `npm run dev:metrics`

### **Repository File Structure Quick Reference**

```
.env.example              # Environment template
.github/workflows/ci.yml  # GitHub Actions CI pipeline  
Dockerfile               # Container build configuration
README.md                # Project overview and basic setup
docs/                    # Detailed operation and deployment guides
  ├── DEPLOYMENT.md      # VPS and systemd deployment
  ├── OPERATION.md       # Sampling, logging, paper trading
jest.config.js           # Test configuration
package.json             # Dependencies and npm scripts
scripts/                 # Deployment automation
  ├── deploy.sh          # VPS deployment script
src/                     # TypeScript source code
  ├── config/            # Configuration management
  ├── listener.ts        # Main application entry
  ├── webhook_handler.ts # Webhook receiver
  └── [modules]          # Core functionality modules
tests/                   # Test suites (Jest)
tsconfig.json           # Next.js TypeScript config
tsconfig.node.json      # Node.js TypeScript config (used for builds)
```

## **ERROR HANDLING AND TROUBLESHOOTING**

### **Common Build Issues**
- **TypeScript compilation errors**: Check `tsconfig.node.json` configuration
- **Missing dependencies**: Run `npm install` 
- **Port conflicts**: Change PORT environment variable (default: 3000)

### **Runtime Issues**
- **Missing environment variables**: Copy and configure `.env` from `.env.example`
- **WebSocket connection errors**: Verify `RPC_WSS` QuickNode endpoint
- **Webhook delivery failures**: Check `WEBHOOK_URL` and `WEBHOOK_AUTH` settings

### **Testing Issues**  
- **Tests failing after changes**: Run `npm run test:coverage` to see what broke
- **Timeout errors**: All commands have been validated with appropriate timeouts
- **Memory issues**: Tests run with 10-second timeout, sufficient for current test suite

## **CRITICAL REMINDERS**

1. **NEVER CANCEL long-running builds or tests** - they have been validated to complete successfully
2. **ALWAYS run complete test suite** before committing changes
3. **ALWAYS validate application startup** after making configuration changes
4. **Use the provided timeout values** - they include safety margins based on measured performance
5. **Follow the environment variable patterns** established in `src/config/index.ts`
6. **Build outputs go to `dist/` directory** - always build before running production commands