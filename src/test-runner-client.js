#!/usr/bin/env node
/**
 * Runs CQL using cql-execution (JavaScript) against deployed test cases.
 * This mirrors test-runner.js but executes CQL client-side instead of using HAPI's $evaluate.
 *
 * Purpose: Verify that the client-side CQL execution (smart-app pathway) produces
 * the same results as server-side execution (HAPI pathway).
 *
 * Usage: node src/test-runner-client.js bcs-recommend-57yo-female
 *        node src/test-runner-client.js bcs
 *        node src/test-runner-client.js --all
 *
 * Environment:
 *   HAPI_BASE_URL (default: http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// cql-execution imports
import { Library, Executor, Repository } from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

// Import valuesets codeService from smart-app
import { codeService } from '../smart-app/src/valuesets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HAPI_BASE_URL = process.env.HAPI_BASE_URL || 'http://localhost:8080/fhir';
const generatedDir = resolve(process.cwd(), 'tests/generated');
const elmDir = resolve(process.cwd(), 'smart-app/src/elm');

// Map test case prefixes to CQL libraries
const PREFIX_TO_LIBRARY = {
  bcs: 'BreastCancerScreening',
  tob: 'TobaccoScreening',
  ccs: 'CervicalCancerScreening',
  crc: 'ColorectalCancerScreening',
  fol: 'FolicAcidSupplementation',
  onp: 'OphthalmiaNeonatorumProphylaxis',
  hbv: 'HepatitisBScreeningPregnancy',
  prp: 'HIVPreexposureProphylaxis',
  htn: 'HypertensionScreeningAdult',
  rhd: 'RhdIncompatibility',
  syp: 'SyphilisScreening',
  hiv: 'HIVScreeningAge',
  hvp: 'HIVScreeningPregnancy',
};

// Cache for loaded ELM libraries
const elmCache = {};

/**
 * Load an ELM library from the smart-app/src/elm directory
 */
function loadElm(libraryId) {
  if (elmCache[libraryId]) {
    return elmCache[libraryId];
  }

  const elmPath = resolve(elmDir, `${libraryId}.json`);
  if (!existsSync(elmPath)) {
    throw new Error(`ELM file not found: ${elmPath}. Run CQL-to-ELM compilation first.`);
  }

  const elm = JSON.parse(readFileSync(elmPath, 'utf-8'));
  elmCache[libraryId] = elm;
  return elm;
}

/**
 * Load all required ELM libraries (main + dependencies like FHIRHelpers)
 */
function loadAllElm() {
  // Always load FHIRHelpers as it's a dependency for all libraries
  const libraries = ['FHIRHelpers'];

  // Load all guideline libraries
  for (const libraryId of Object.values(PREFIX_TO_LIBRARY)) {
    if (!libraries.includes(libraryId)) {
      libraries.push(libraryId);
    }
  }

  return libraries.map(loadElm);
}

/**
 * Determine library ID from case ID prefix
 */
function getLibraryForCase(caseId) {
  const prefix = caseId.split('-')[0];
  return PREFIX_TO_LIBRARY[prefix] || null;
}

/**
 * Fetch a patient's data bundle from HAPI
 */
async function fetchPatientBundle(patientId) {
  // Fetch Patient resource
  const patientResponse = await fetch(`${HAPI_BASE_URL}/Patient/${patientId}`, {
    headers: { 'Accept': 'application/fhir+json' }
  });
  if (!patientResponse.ok) {
    throw new Error(`Failed to fetch Patient/${patientId}: ${patientResponse.status}`);
  }
  const patient = await patientResponse.json();

  // Build bundle with patient and related resources
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [{ resource: patient }]
  };

  // Fetch Conditions
  const conditionsResponse = await fetch(
    `${HAPI_BASE_URL}/Condition?patient=${patientId}&_count=100`,
    { headers: { 'Accept': 'application/fhir+json' } }
  );
  if (conditionsResponse.ok) {
    const conditionsBundle = await conditionsResponse.json();
    for (const entry of conditionsBundle.entry || []) {
      bundle.entry.push({ resource: entry.resource });
    }
  }

  // Fetch Procedures
  const proceduresResponse = await fetch(
    `${HAPI_BASE_URL}/Procedure?patient=${patientId}&_count=100`,
    { headers: { 'Accept': 'application/fhir+json' } }
  );
  if (proceduresResponse.ok) {
    const proceduresBundle = await proceduresResponse.json();
    for (const entry of proceduresBundle.entry || []) {
      bundle.entry.push({ resource: entry.resource });
    }
  }

  // Fetch Observations
  const observationsResponse = await fetch(
    `${HAPI_BASE_URL}/Observation?patient=${patientId}&_count=100`,
    { headers: { 'Accept': 'application/fhir+json' } }
  );
  if (observationsResponse.ok) {
    const observationsBundle = await observationsResponse.json();
    for (const entry of observationsBundle.entry || []) {
      bundle.entry.push({ resource: entry.resource });
    }
  }

  // Fetch MedicationRequests
  const medsResponse = await fetch(
    `${HAPI_BASE_URL}/MedicationRequest?patient=${patientId}&_count=100`,
    { headers: { 'Accept': 'application/fhir+json' } }
  );
  if (medsResponse.ok) {
    const medsBundle = await medsResponse.json();
    for (const entry of medsBundle.entry || []) {
      bundle.entry.push({ resource: entry.resource });
    }
  }

  return bundle;
}

/**
 * Execute CQL using cql-execution
 */
async function executeCql(libraryId, patientBundle) {
  // Load all ELM libraries
  const allElm = loadAllElm();

  // Create repository with all libraries
  const repository = new Repository(allElm);

  // Get the main library's ELM
  const mainElm = loadElm(libraryId);

  // Create the library
  const library = new Library(mainElm, repository);

  // Create executor with code service for ValueSet lookups
  const executor = new Executor(library, codeService);

  // Create FHIR R4 patient source
  const patientSource = PatientSource.FHIRv401();
  patientSource.loadBundles([patientBundle]);

  // Execute CQL
  const results = await executor.exec(patientSource);

  // Extract patient ID
  const patientId = patientBundle.entry
    ?.find(e => e.resource?.resourceType === 'Patient')
    ?.resource?.id;

  // Return results for this patient
  if (results?.patientResults && results.patientResults[patientId]) {
    return results.patientResults[patientId];
  }

  return {};
}

/**
 * Normalize CQL execution results to primitive values.
 * cql-execution returns FHIR types (e.g., {value: "female"}) while
 * HAPI's $evaluate returns primitives directly.
 */
function normalizeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Boolean, number, string - return as-is
  if (typeof value !== 'object') {
    return value;
  }

  // Array - normalize each element
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  // FHIR type wrapper with .value property (e.g., {value: "female", ...})
  // This handles FHIR Code, String, Integer, Boolean, etc. wrapped types
  if ('value' in value) {
    return normalizeValue(value.value);
  }

  // Code type without .value (e.g., {code: "female", system: "..."})
  if ('code' in value) {
    return value.code;
  }

  // Other object - return as-is
  return value;
}

/**
 * Normalize all results from CQL execution
 */
function normalizeResults(results) {
  const normalized = {};
  for (const [key, value] of Object.entries(results)) {
    normalized[key] = normalizeValue(value);
  }
  return normalized;
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
 * Run CQL evaluation for a test case
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

  console.log(`Testing: ${caseId}`);
  console.log(`  ${metadata.description}`);
  console.log(`  Library: ${libraryId}, Patient: ${patientId}`);

  // Fetch patient data from HAPI
  const bundle = await fetchPatientBundle(patientId);

  // Execute CQL client-side
  const rawResults = await executeCql(libraryId, bundle);
  const actual = normalizeResults(rawResults);
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
  console.error('Usage: node src/test-runner-client.js <case-id>');
  console.error('       node src/test-runner-client.js <prefix>   (e.g., onp, bcs, crc)');
  console.error('       node src/test-runner-client.js --all');
  console.error(`\nHAPI server: ${HAPI_BASE_URL} (for patient data)`);
  console.error(`ELM directory: ${elmDir}`);
  console.error(`Prefixes: ${Object.keys(PREFIX_TO_LIBRARY).join(', ')}`);
  process.exit(1);
}

console.log(`CQL Execution: cql-execution (JavaScript, client-side)`);
console.log(`Patient data from: ${HAPI_BASE_URL}`);
console.log(`ELM directory: ${elmDir}\n`);

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
