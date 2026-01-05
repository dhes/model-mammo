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
  // tests/dmn/tobacco/*.json use TobaccoCessationAdultSingleDecisionTable.dmn
  tobacco: resolve(__dirname, '../input/dmn/TobaccoCessationAdultSingleDecisionTable.dmn'),
  // tests/dmn/cervical/*.json use CervicalCancerScreening.dmn
  cervical: resolve(__dirname, '../input/dmn/CervicalCancerScreening.dmn'),
  // tests/dmn/colorectal/*.json use ColorectalCancerScreening.dmn
  colorectal: resolve(__dirname, '../input/dmn/ColorectalCancerScreening.dmn'),
  // tests/dmn/folicacid/*.json use FolicAcidSupplementation.dmn
  folicacid: resolve(__dirname, '../input/dmn/FolicAcidSupplementation.dmn'),
  // tests/dmn/hiv-age/*.json use HIVScreeningAge.dmn
  'hiv-age': resolve(__dirname, '../input/dmn/HIVScreeningAge.dmn'),
  // tests/dmn/hiv-pregnancy/*.json use HIVScreeningPregnancy.dmn
  'hiv-pregnancy': resolve(__dirname, '../input/dmn/HIVScreeningPregnancy.dmn'),
  // tests/dmn/hypertension/*.json use HypertensionScreeningAdult.dmn
  hypertension: resolve(__dirname, '../input/dmn/HypertensionScreeningAdult.dmn'),
  // tests/dmn/ophthalmia/*.json use OphthalmiaNeonatorumProphylaxis.dmn
  ophthalmia: resolve(__dirname, '../input/dmn/OphthalmiaNeonatorumProphylaxis.dmn'),
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

describe('Cervical Cancer Screening Decision Table', () => {
  const cervicalTestsDir = resolve(testsDir, 'cervical');

  beforeAll(() => {
    loadDMN(dmnFiles.cervical);
  });

  // Skip if cervical tests directory doesn't exist
  if (!existsSync(cervicalTestsDir)) {
    it.skip('No cervical tests found', () => {});
    return;
  }

  const testFiles = readdirSync(cervicalTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(cervicalTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.cervical);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('Colorectal Cancer Screening Decision Table', () => {
  const colorectalTestsDir = resolve(testsDir, 'colorectal');

  beforeAll(() => {
    loadDMN(dmnFiles.colorectal);
  });

  // Skip if colorectal tests directory doesn't exist
  if (!existsSync(colorectalTestsDir)) {
    it.skip('No colorectal tests found', () => {});
    return;
  }

  const testFiles = readdirSync(colorectalTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(colorectalTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.colorectal);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('Folic Acid Supplementation Decision Table', () => {
  const folicacidTestsDir = resolve(testsDir, 'folicacid');

  beforeAll(() => {
    loadDMN(dmnFiles.folicacid);
  });

  // Skip if folicacid tests directory doesn't exist
  if (!existsSync(folicacidTestsDir)) {
    it.skip('No folic acid tests found', () => {});
    return;
  }

  const testFiles = readdirSync(folicacidTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(folicacidTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.folicacid);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('HIV Screening By Age Decision Table', () => {
  const hivAgeTestsDir = resolve(testsDir, 'hiv-age');

  beforeAll(() => {
    loadDMN(dmnFiles['hiv-age']);
  });

  // Skip if hiv-age tests directory doesn't exist
  if (!existsSync(hivAgeTestsDir)) {
    it.skip('No HIV age tests found', () => {});
    return;
  }

  const testFiles = readdirSync(hivAgeTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(hivAgeTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles['hiv-age']);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('HIV Screening Pregnancy Decision Table', () => {
  const hivPregnancyTestsDir = resolve(testsDir, 'hiv-pregnancy');

  beforeAll(() => {
    loadDMN(dmnFiles['hiv-pregnancy']);
  });

  // Skip if hiv-pregnancy tests directory doesn't exist
  if (!existsSync(hivPregnancyTestsDir)) {
    it.skip('No HIV pregnancy tests found', () => {});
    return;
  }

  const testFiles = readdirSync(hivPregnancyTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(hivPregnancyTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles['hiv-pregnancy']);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('Hypertension Screening Decision Table', () => {
  const hypertensionTestsDir = resolve(testsDir, 'hypertension');

  beforeAll(() => {
    loadDMN(dmnFiles.hypertension);
  });

  // Skip if hypertension tests directory doesn't exist
  if (!existsSync(hypertensionTestsDir)) {
    it.skip('No hypertension tests found', () => {});
    return;
  }

  const testFiles = readdirSync(hypertensionTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(hypertensionTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.hypertension);

      expect(result).toEqual(testData.expected);
    });
  });
});

describe('Ophthalmia Neonatorum Prophylaxis Decision Table', () => {
  const ophthalmiaTestsDir = resolve(testsDir, 'ophthalmia');

  beforeAll(() => {
    loadDMN(dmnFiles.ophthalmia);
  });

  // Skip if ophthalmia tests directory doesn't exist
  if (!existsSync(ophthalmiaTestsDir)) {
    it.skip('No ophthalmia tests found', () => {});
    return;
  }

  const testFiles = readdirSync(ophthalmiaTestsDir).filter(f => f.endsWith('.json'));

  testFiles.forEach(testFile => {
    const testName = testFile.replace('.json', '');

    it(`should evaluate correctly for: ${testName}`, () => {
      const testPath = resolve(ophthalmiaTestsDir, testFile);
      const testData = JSON.parse(readFileSync(testPath, 'utf-8'));

      const result = evaluateDecision(testData.input, dmnFiles.ophthalmia);

      expect(result).toEqual(testData.expected);
    });
  });
});
