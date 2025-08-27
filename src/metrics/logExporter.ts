/**
 * Scriptable module to export structured logs for manual analysis workflow
 * Supports:
 * - Reading ndjson files from local directory
 * - Exporting to single ndjson file
 * - Optional compression to .gz
 * - Optional S3 upload if S3 env vars provided
 */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

// Optional S3 dependency - only loaded if needed
let S3: any;
try {
  // Try to import AWS SDK v3 first, then v2
  const AWS = require('@aws-sdk/client-s3');
  S3 = AWS.S3Client;
} catch {
  try {
    const AWS = require('aws-sdk');
    S3 = AWS.S3;
  } catch {
    // S3 not available - will be handled in upload function
  }
}

interface ExportOptions {
  input: string;
  output: string;
  compress?: boolean;
  uploadToS3?: boolean;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
}

/**
 * Read all .ndjson files from input directory
 */
async function readLogFiles(inputDir: string): Promise<string[]> {
  const files = await fs.promises.readdir(inputDir);
  const ndjsonFiles = files.filter(f => f.endsWith('.ndjson') || f.endsWith('.jsonl'));
  
  const allLines: string[] = [];
  
  for (const file of ndjsonFiles) {
    const filePath = path.join(inputDir, file);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    allLines.push(...lines);
  }
  
  return allLines;
}

/**
 * Write lines to output file, optionally compressing
 */
async function writeOutput(lines: string[], outputPath: string, compress: boolean = false): Promise<string> {
  const content = lines.join('\n') + '\n';
  
  if (compress) {
    const compressed = zlib.gzipSync(content);
    const gzPath = outputPath + '.gz';
    await fs.promises.writeFile(gzPath, compressed);
    return gzPath;
  } else {
    await fs.promises.writeFile(outputPath, content);
    return outputPath;
  }
}

/**
 * Upload file to S3 if configured
 */
async function uploadToS3(filePath: string, options: ExportOptions): Promise<string | null> {
  if (!S3 || !options.s3Bucket) {
    return null;
  }

  try {
    const fileName = path.basename(filePath);
    const fileContent = await fs.promises.readFile(filePath);
    
    // Try AWS SDK v3 first
    if (S3.prototype && typeof S3.prototype.send === 'function') {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3({
        region: options.s3Region || process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: options.s3AccessKey || process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: options.s3SecretKey || process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      
      const command = new PutObjectCommand({
        Bucket: options.s3Bucket,
        Key: fileName,
        Body: fileContent,
        ContentType: filePath.endsWith('.gz') ? 'application/gzip' : 'application/x-ndjson',
      });
      
      await s3Client.send(command);
    } else {
      // AWS SDK v2
      const s3 = new S3({
        region: options.s3Region || process.env.AWS_REGION || 'us-east-1',
        accessKeyId: options.s3AccessKey || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: options.s3SecretKey || process.env.AWS_SECRET_ACCESS_KEY,
      });
      
      await s3.upload({
        Bucket: options.s3Bucket,
        Key: fileName,
        Body: fileContent,
        ContentType: filePath.endsWith('.gz') ? 'application/gzip' : 'application/x-ndjson',
      }).promise();
    }
    
    return `s3://${options.s3Bucket}/${fileName}`;
  } catch (error) {
    console.error('S3 upload failed:', error);
    return null;
  }
}

/**
 * Main export function
 */
export async function exportLogs(options: ExportOptions): Promise<{
  inputFiles: number;
  totalLines: number;
  outputFile: string;
  compressed: boolean;
  s3Url?: string;
}> {
  console.log(`Reading logs from: ${options.input}`);
  
  // Ensure input directory exists
  if (!fs.existsSync(options.input)) {
    throw new Error(`Input directory does not exist: ${options.input}`);
  }
  
  // Create output directory if needed
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }
  
  // Read all log lines
  const lines = await readLogFiles(options.input);
  console.log(`Found ${lines.length} log entries`);
  
  if (lines.length === 0) {
    throw new Error('No log entries found to export');
  }
  
  // Generate output filename with timestamp if not specific file extension
  let outputPath = options.output;
  if (!path.extname(outputPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = `${options.output}${timestamp}.ndjson`;
  }
  
  // Write output
  const finalPath = await writeOutput(lines, outputPath, options.compress);
  console.log(`Exported to: ${finalPath}`);
  
  const result = {
    inputFiles: (await fs.promises.readdir(options.input)).filter(f => f.endsWith('.ndjson') || f.endsWith('.jsonl')).length,
    totalLines: lines.length,
    outputFile: finalPath,
    compressed: options.compress || false,
  } as any;
  
  // Upload to S3 if configured
  if (options.uploadToS3) {
    const s3Url = await uploadToS3(finalPath, options);
    if (s3Url) {
      console.log(`Uploaded to: ${s3Url}`);
      result.s3Url = s3Url;
    }
  }
  
  return result;
}

/**
 * CLI interface when run directly
 */
async function main() {
  const args = process.argv.slice(2);
  const options: ExportOptions = {
    input: '',
    output: '',
    compress: false,
    uploadToS3: false,
  };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--input':
        options.input = value;
        break;
      case '--output':
        options.output = value;
        break;
      case '--compress':
        options.compress = true;
        i--; // No value for this flag
        break;
      case '--s3':
        options.uploadToS3 = true;
        options.s3Bucket = value;
        break;
      case '--s3-region':
        options.s3Region = value;
        break;
      default:
        if (flag === '--compress' && value === undefined) {
          options.compress = true;
          i--; // Adjust for no value
        }
    }
  }
  
  // Check for S3 env vars
  if (!options.s3AccessKey && process.env.AWS_ACCESS_KEY_ID) {
    options.s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
  }
  if (!options.s3SecretKey && process.env.AWS_SECRET_ACCESS_KEY) {
    options.s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  }
  if (!options.s3Bucket && process.env.S3_BUCKET) {
    options.s3Bucket = process.env.S3_BUCKET;
    options.uploadToS3 = true;
  }
  
  if (!options.input || !options.output) {
    console.log('Usage: node logExporter.js --input <dir> --output <file> [--compress] [--s3 <bucket>] [--s3-region <region>]');
    console.log('');
    console.log('Options:');
    console.log('  --input <dir>        Directory containing .ndjson/.jsonl files');
    console.log('  --output <file>      Output file path (timestamp added if no extension)');
    console.log('  --compress           Compress output to .gz format');
    console.log('  --s3 <bucket>        Upload to S3 bucket');
    console.log('  --s3-region <region> S3 region (default: us-east-1)');
    console.log('');
    console.log('Environment variables:');
    console.log('  AWS_ACCESS_KEY_ID     AWS access key');
    console.log('  AWS_SECRET_ACCESS_KEY AWS secret key');
    console.log('  AWS_REGION           AWS region');
    console.log('  S3_BUCKET            Default S3 bucket');
    process.exit(1);
  }
  
  try {
    const result = await exportLogs(options);
    console.log('\nExport completed:');
    console.log(`  Input files: ${result.inputFiles}`);
    console.log(`  Total lines: ${result.totalLines}`);
    console.log(`  Output file: ${result.outputFile}`);
    console.log(`  Compressed: ${result.compressed}`);
    if (result.s3Url) {
      console.log(`  S3 URL: ${result.s3Url}`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}