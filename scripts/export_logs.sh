#!/bin/bash

# Export logs helper script
# Small bash helper that runs node ./dist/metrics/logExporter.js --input logs/ --output exports/session-

set -e

# Default values
INPUT_DIR="logs"
OUTPUT_PREFIX="exports/session-"
COMPRESS=false
S3_BUCKET=""

# Parse command line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --input)
      INPUT_DIR="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PREFIX="$2"
      shift 2
      ;;
    --compress)
      COMPRESS=true
      shift
      ;;
    --s3)
      S3_BUCKET="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --input <dir>         Input directory with log files (default: logs)"
      echo "  --output <prefix>     Output file prefix (default: exports/session-)"
      echo "  --compress            Compress output to .gz"
      echo "  --s3 <bucket>         Upload to S3 bucket"
      echo "  --help, -h            Show this help"
      echo ""
      echo "Example:"
      echo "  $0 --input logs/ --output exports/session- --compress"
      echo "  $0 --input logs/ --output exports/session- --s3 my-bucket"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check if Node.js dist directory exists
if [ ! -d "dist" ]; then
  echo "Error: dist directory not found. Please run 'npm run build' first."
  exit 1
fi

if [ ! -f "dist/metrics/logExporter.js" ]; then
  echo "Error: dist/metrics/logExporter.js not found. Please run 'npm run build' first."
  exit 1
fi

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
  echo "Warning: Input directory '$INPUT_DIR' does not exist. Creating it..."
  mkdir -p "$INPUT_DIR"
fi

# Create output directory if needed
OUTPUT_DIR=$(dirname "$OUTPUT_PREFIX")
if [ ! -d "$OUTPUT_DIR" ]; then
  echo "Creating output directory: $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"
fi

# Build the command
CMD="node ./dist/metrics/logExporter.js --input \"$INPUT_DIR\" --output \"$OUTPUT_PREFIX\""

if [ "$COMPRESS" = true ]; then
  CMD="$CMD --compress"
fi

if [ -n "$S3_BUCKET" ]; then
  CMD="$CMD --s3 \"$S3_BUCKET\""
fi

# Log the command being executed
echo "Executing: $CMD"
echo ""

# Execute the command
eval $CMD

echo ""
echo "Log export completed successfully!"