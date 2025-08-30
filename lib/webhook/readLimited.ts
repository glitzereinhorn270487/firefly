export class PayloadTooLarge extends Error {
  constructor(message = 'Payload too large') {
    super(message);
    this.name = 'PayloadTooLarge';
  }
}

export async function readLimitedText(req: Request, maxBytes: number = 1_000_000): Promise<string> {
  if (!req.body) {
    return '';
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        totalBytes += value.length;
        
        if (totalBytes > maxBytes) {
          throw new PayloadTooLarge(`Request body too large: ${totalBytes} bytes > ${maxBytes} limit`);
        }
        
        chunks.push(value);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore errors when releasing lock
    }
  }

  // Combine chunks into single Uint8Array
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to string
  return new TextDecoder().decode(combined);
}