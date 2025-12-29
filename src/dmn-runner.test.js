import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadDMN, evaluateDecision } from './dmn-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = resolve(__dirname, '../tests/dmn');

// DMN file mappings
const dmnFiles = {
  // Root tests/dmn/*.json use BreastCancerScreening.dmn
  root: resolve(__dirname, '../input/dmn/BreastCancerScreening.dmn'),
  // tests/dmn/tobacco/*.json use TobaccoScreening.dmn
  tobacco: resolve(__dirname, '../input/dmn/TobaccoScreening.dmn'),
};

describe('Breast Cancer Screening Decision Table', () => {
  beforeAll(() => {
    loadDMN(dmnFiles.root);
  });

  const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(testsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.root);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('Tobacco Screening Decision Table', () => {
  const tobaccoTestsDir = resolve(testsDir, 'tobacco');

  beforeAll(() => {
    loadDMN(dmnFiles.tobacco);
  });

  // Skip if tobacco tests directory doesn't exist
  if (!existsSync(tobaccoTestsDir)) {
    it.skip('No tobacco tests found', () => {});
    return;
  }

  const testFiles = readdirSync(tobaccoTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(tobaccoTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.tobacco);

      expect(result).toEqual(testData.expected);
    });
  });
});
