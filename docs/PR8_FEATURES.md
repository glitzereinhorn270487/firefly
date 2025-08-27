# PR8: Metrics Health & Log Export Features

This PR adds minimal, safe operational and analysis support features for manual analysis workflows.

## Features Added

### 1. Health & Metrics Endpoints (`src/metrics/health.ts`)

Lightweight Express-based HTTP endpoints for operational monitoring:

- **`/health`** - Basic liveness check with uptime information
- **`/ready`** - Readiness check for operational monitoring  
- **`/metrics`** - Prometheus-style metrics (requests, errors, uptime)

**Usage:**
```bash
# Standalone metrics server
npm run start:metrics
# or with custom port
METRICS_PORT=3001 npm run start:metrics

# Development mode
npm run dev:metrics
```

**Integration Example:**
See `src/webhook_with_metrics.ts` for how to integrate metrics with existing services:
```bash
npm run start:webhook-with-metrics
```

### 2. Log Exporter (`src/metrics/logExporter.ts`)

Scriptable module for exporting structured logs from local files:

- Reads `.ndjson` and `.jsonl` files from input directory
- Exports to single ndjson file with timestamp
- Optional gzip compression support
- Optional S3 upload when AWS credentials provided

**CLI Usage:**
```bash
# Direct usage
node dist/metrics/logExporter.js --input logs/ --output exports/session-

# With compression
node dist/metrics/logExporter.js --input logs/ --output exports/session- --compress

# With S3 upload
node dist/metrics/logExporter.js --input logs/ --output exports/session- --s3 my-bucket
```

**Environment Variables for S3:**
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key  
AWS_REGION=us-east-1
S3_BUCKET=your-default-bucket
```

### 3. Export Helper Script (`scripts/export_logs.sh`)

Bash wrapper for easy log export operations:

```bash
# Basic export
./scripts/export_logs.sh

# Custom paths
./scripts/export_logs.sh --input logs/ --output exports/session-

# With compression
./scripts/export_logs.sh --compress

# With S3 upload
./scripts/export_logs.sh --s3 my-bucket

# Help
./scripts/export_logs.sh --help
```

## Package.json Scripts Added

```json
{
  "start:metrics": "node dist/metrics/health.js",
  "start:webhook-with-metrics": "node dist/webhook_with_metrics.js", 
  "export:logs": "./scripts/export_logs.sh",
  "dev:metrics": "ts-node -P tsconfig.node.json src/metrics/health.ts",
  "dev:webhook-with-metrics": "ts-node -P tsconfig.node.json src/webhook_with_metrics.ts"
}
```

## Safety & Non-Intrusive Design

- All new features are opt-in and don't affect existing functionality
- No changes to existing listener or webhook handler
- Metrics server runs on separate port (default 3001)
- Log export works with any ndjson files, doesn't require specific format
- S3 upload is optional and gracefully handles missing credentials
- Comprehensive error handling and logging

## Testing

All features have been tested:
- Health endpoints return proper JSON responses
- Metrics expose Prometheus-compatible format
- Log exporter handles multiple input files correctly
- Compression works with gzip format
- Bash script provides proper help and error handling
- Integration example works without conflicts

This implementation supports Option 1 (manual analysis & reporting) while maintaining safety and minimal impact on existing PR7 work.