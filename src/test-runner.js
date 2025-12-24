#!/usr/bin/env node
/**
 * Runs CQL $evaluate against deployed test cases and compares to expected results.
 *
 * Usage: node src/test-runner.js bcs-recommend-57yo-female
 *        node src/test-runner.js --all
 *
 * Environment:
 *   HAPI_BASE_URL (default: http://localhost:8080/fhir)
 *   LIBRARY_ID (default: BreastCancerScreening)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const HAPI_BASE_URL = process.env.HAPI_BASE_URL || 'http://localhost:8080/fhir';
const LIBRARY_ID = process.env.LIBRARY_ID || 'BreastCancerScreening';
const generatedDir = resolve(process.cwd(), 'tests/generated');

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
  const url = `${HAPI_BASE_URL}/Library/${LIBRARY_ID}/$evaluate?subject=Patient/${patientId}`;

  console.log(`Testing: ${caseId}`);
  console.log(`  ${metadata.description}`);
  console.log(`  Patient: ${patientId}`);

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
  console.error('       node src/test-runner.js --all');
  console.error(`\nHAPI server: ${HAPI_BASE_URL}`);
  console.error(`Library: ${LIBRARY_ID}`);
  process.exit(1);
}

console.log(`HAPI server: ${HAPI_BASE_URL}`);
console.log(`Library: ${LIBRARY_ID}\n`);

let casesToRun = [];

if (args[0] === '--all') {
  casesToRun = readdirSync(generatedDir)
    .filter(f => existsSync(resolve(generatedDir, f, '_metadata.json')));
} else {
  casesToRun = [args[0]];
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
