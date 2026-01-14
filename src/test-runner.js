#!/usr/bin/env node
/**
 * Runs CQL $evaluate against deployed test cases and compares to expected results.
 * Automatically selects the correct library based on test case prefix (bcs-, tob-, ccs-, crc-).
 *
 * Usage: node src/test-runner.js bcs-recommend-57yo-female
 *        node src/test-runner.js --all
 *
 * Environment:
 *   HAPI_BASE_URL (default: http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const HAPI_BASE_URL = process.env.HAPI_BASE_URL || 'http://localhost:8080/fhir';
const generatedDir = resolve(process.cwd(), 'tests/generated');

// Map test case prefixes to CQL libraries
const PREFIX_TO_LIBRARY = {
  bcs: 'BreastCancerScreening',
  tob: 'TobaccoScreening',
  ccs: 'CervicalCancerScreening',
  crc: 'ColorectalCancerScreening',
  fol: 'FolicAcidSupplementation',
  onp: 'OphthalmiaNeonatorumProphylaxis',
  hbv: 'HepatitisBScreeningPregnancy',
};

/**
 * Determine library ID from case ID prefix
 */
function getLibraryForCase(caseId) {
  const prefix = caseId.split('-')[0];
  return PREFIX_TO_LIBRARY[prefix] || null;
}

/**
 * Extract parameter values from FHIR Parameters response
 */
function parseParameters(parameters) {
  const result = {};
  for (const param of parameters.parameter || []) {
    const name = param.name;
    // Handle different value types
    if ('valueBoolean' in param) result[name] = param.valueBoolean;
    else if ('valueInteger' in param) result[name] = param.valueInteger;
    else if ('valueString' in param) result[name] = param.valueString;
    else if ('valueDecimal' in param) result[name] = param.valueDecimal;
    else if ('valueDate' in param) result[name] = param.valueDate;
    else if ('valueDateTime' in param) result[name] = param.valueDateTime;
    else if ('resource' in param) result[name] = '[Resource]';
    else if ('_valueBoolean' in param) {
      // data-absent-reason
      const ext = param._valueBoolean?.extension?.[0];
      if (ext?.url?.includes('data-absent-reason')) {
        result[name] = null;
      } else if (ext?.url?.includes('cqf-isEmptyList')) {
        result[name] = [];
      }
    }
  }
  return result;
}

/**
 * Compare actual vs expected, return differences
 */
function compareResults(actual, expected) {
  const failures = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (actualValue !== expectedValue) {
      failures.push({ key, expected: expectedValue, actual: actualValue });
    }
  }
  return failures;
}

/**
 * Run $evaluate for a test case
 */
async function runTestCase(caseId) {
  const caseDir = resolve(generatedDir, caseId);
  const metadataPath = resolve(caseDir, '_metadata.json');

  if (!existsSync(metadataPath)) {
    throw new Error(`Test case not found: ${caseId}. Run 'npm run test:generate' first.`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  // Find the Patient resource
  const patientRes = metadata.resources.find(r => r.type === 'Patient');
  if (!patientRes) {
    throw new Error(`No Patient resource in test case: ${caseId}`);
  }

  const patientId = patientRes.id;
  const libraryId = getLibraryForCase(caseId);

  if (!libraryId) {
    throw new Error(`Unknown test case prefix: ${caseId}. Add mapping to PREFIX_TO_LIBRARY.`);
  }

  const url = `${HAPI_BASE_URL}/Library/${libraryId}/$evaluate?subject=Patient/${patientId}`;

  console.log(`Testing: ${caseId}`);
  console.log(`  ${metadata.description}`);
  console.log(`  Library: ${libraryId}, Patient: ${patientId}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/fhir+json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`$evaluate failed: ${response.status} ${error}`);
  }

  const parameters = await response.json();
  const actual = parseParameters(parameters);
  const failures = compareResults(actual, metadata.expected);

  if (failures.length === 0) {
    console.log(`  ✓ PASS`);
    return { caseId, passed: true, actual };
  } else {
    console.log(`  ✗ FAIL`);
    for (const f of failures) {
      console.log(`    ${f.key}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
    }
    return { caseId, passed: false, failures, actual };
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node src/test-runner.js <case-id>');
  console.error('       node src/test-runner.js <prefix>   (e.g., onp, bcs, crc)');
  console.error('       node src/test-runner.js --all');
  console.error(`\nHAPI server: ${HAPI_BASE_URL}`);
  console.error(`Prefixes: ${Object.keys(PREFIX_TO_LIBRARY).join(', ')}`);
  process.exit(1);
}

console.log(`HAPI server: ${HAPI_BASE_URL}`);
console.log(`Libraries: ${Object.values(PREFIX_TO_LIBRARY).join(', ')}\n`);

let casesToRun = [];

if (args[0] === '--all') {
  // Run all generated cases
  casesToRun = readdirSync(generatedDir)
    .filter(f => existsSync(resolve(generatedDir, f, '_metadata.json')));
} else {
  // Could be a case ID or a prefix - check if exact match exists first
  const allCases = readdirSync(generatedDir)
    .filter(f => existsSync(resolve(generatedDir, f, '_metadata.json')));

  if (allCases.includes(args[0])) {
    // Exact case ID match
    casesToRun = [args[0]];
  } else {
    // Treat as prefix - find all cases starting with prefix-
    const prefix = args[0];
    const matchingCases = allCases.filter(f => f.startsWith(`${prefix}-`));

    if (matchingCases.length === 0) {
      console.error(`No generated test cases found for prefix '${prefix}' or case ID '${args[0]}'`);
      console.error(`Looking for: ${generatedDir}/${prefix}-*`);
      console.error(`\nHave you run 'npm run test:deploy -- ${prefix}' first?`);
      process.exit(1);
    }

    console.log(`Found ${matchingCases.length} test case(s) with prefix '${prefix}':\n`);
    casesToRun = matchingCases;
  }
}

let passed = 0;
let failed = 0;

for (const caseId of casesToRun) {
  try {
    const result = await runTestCase(caseId);
    if (result.passed) passed++;
    else failed++;
    console.log('');
  } catch (err) {
    console.error(`Error running ${caseId}: ${err.message}`);
    failed++;
  }
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
