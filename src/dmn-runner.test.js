import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadDMN, evaluateDecision } from './dmn-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = resolve(__dirname, '../tests/dmn');

describe('Breast Cancer Screening Decision Table', () => {
  beforeAll(async () => {
    await loadDMN();
  });

  const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, async () => {
      const testPath = resolve(testsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = await evaluateDecision(testData.input);

      expect(result).toEqual(testData.expected);
    });
  });
});
