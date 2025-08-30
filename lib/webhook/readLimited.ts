export class PayloadTooLarge extends Error {
  constructor(message = 'Payload too large') {
    super(message);
    this.name = 'PayloadTooLarge';
  }
}

export async function readLimitedText(req: Request, limit: number = 1_000_000): Promise<string> {
  if (!req.body) {
    return '';
  }
  
  const reader = req.body.getReader();
  let totalLength = 0;
  const chunks: Uint8Array[] = [];
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      totalLength += value.length;
      
      if (totalLength > limit) {
        throw new PayloadTooLarge(`Payload size ${totalLength} exceeds limit ${limit}`);
      }
      
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  
  // Combine all chunks into a single Uint8Array
  const totalBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    totalBytes.set(chunk, offset);
    offset += chunk.length;
  }
  
  // Convert to string
  return new TextDecoder().decode(totalBytes);
}