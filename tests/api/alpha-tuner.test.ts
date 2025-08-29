/**
 * Basic integration test for Alpha-Tuner API endpoints
 */
import fs from 'fs';
import path from 'path';

// Mock Next.js runtime
const mockNextResponse = {
  json: (data: any) => ({
    json: () => Promise.resolve(data),
    status: 200,
    data
  })
};

jest.mock('next/server', () => ({
  NextResponse: mockNextResponse
}));

// Import the API handler after mocking
import { GET } from '../../app/api/alpha-tuner/summary/route';

describe('Alpha-Tuner API', () => {
  const testLogsDir = path.join(__dirname, '../../logs');
  
  beforeAll(() => {
    // Ensure test logs directory and files exist
    if (!fs.existsSync(testLogsDir)) {
      fs.mkdirSync(testLogsDir, { recursive: true });
    }
    
    // Create test log file
    const testLogContent = [
      '{"timestamp": "2024-01-15T10:30:00Z", "entryTimestamp": 1705314600000, "exitTimestamp": 1705315200000, "pnlUsd": 25.50, "score": 720, "finalScore": 720}',
      '{"timestamp": "2024-01-15T11:15:00Z", "entryTimestamp": 1705317300000, "exitTimestamp": 1705318800000, "pnlUsd": -12.30, "score": 340, "finalScore": 340}',
      'invalid json line',
      '{"timestamp": "2024-01-15T11:45:00Z", "entryTimestamp": 1705319100000, "exitTimestamp": 1705320600000, "pnlUsd": 45.80, "score": 650, "finalScore": 650}'
    ].join('\n');
    
    fs.writeFileSync(path.join(testLogsDir, 'trades-test.log'), testLogContent);
  });
  
  afterAll(() => {
    // Clean up test files
    const testFile = path.join(testLogsDir, 'trades-test.log');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('GET /api/alpha-tuner/summary', () => {
    it('should return trade log summary', async () => {
      const response = await GET();
      const data = (response as any).data;
      
      expect(data).toBeDefined();
      expect(data.totalLines).toBeGreaterThan(0);
      expect(data.parsed).toBeGreaterThan(0);
      expect(data.tradeCount).toBeGreaterThan(0);
      expect(typeof data.wins).toBe('number');
      expect(typeof data.losses).toBe('number');
      expect(data.scoresHistogram).toBeDefined();
      expect(typeof data.scoresHistogram).toBe('object');
    });

    it('should handle malformed JSON lines gracefully', async () => {
      const response = await GET();
      const data = (response as any).data;
      
      // Should parse valid lines and skip invalid ones
      expect(data.parsed).toBeLessThan(data.totalLines);
    });

    it('should calculate correct statistics', async () => {
      const response = await GET();
      const data = (response as any).data;
      
      // Based on our test data: 2 wins (25.50, 45.80), 1 loss (-12.30)
      expect(data.wins).toBeGreaterThan(0);
      expect(data.losses).toBeGreaterThan(0);
      
      if (data.avgPnlUsd !== null) {
        expect(typeof data.avgPnlUsd).toBe('number');
      }
      
      if (data.avgDurationMinutes !== null) {
        expect(typeof data.avgDurationMinutes).toBe('number');
      }
      
      if (data.avgScore !== null) {
        expect(typeof data.avgScore).toBe('number');
      }
    });

    it('should have proper score histogram structure', async () => {
      const response = await GET();
      const data = (response as any).data;
      
      const expectedRanges = ['0-199', '200-399', '400-599', '600-799', '800-1000'];
      expectedRanges.forEach(range => {
        expect(data.scoresHistogram).toHaveProperty(range);
        expect(typeof data.scoresHistogram[range]).toBe('number');
      });
    });
  });
});