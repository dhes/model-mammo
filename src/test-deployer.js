#!/usr/bin/env node
/**
 * Deploys generated FHIR test resources to HAPI server.
 *
 * Usage: node src/test-deployer.js bcs-recommend-57yo-female
 *        node src/test-deployer.js --all
 *
 * Environment: HAPI_BASE_URL (default: http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const HAPI_BASE_URL = process.env.HAPI_BASE_URL || 'http://localhost:8080/fhir';
const generatedDir = resolve(process.cwd(), 'tests/generated');

/**
 * Deploy a single resource to HAPI
 */
async function deployResource(resourcePath) {
  const resource = JSON.parse(readFileSync(resourcePath, 'utf-8'));
  const resourceType = resource.resourceType;
  const resourceId = resource.id;

  const url = `${HAPI_BASE_URL}/${resourceType}/${resourceId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    },
    body: JSON.stringify(resource)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to deploy ${resourceType}/${resourceId}: ${response.status} ${error}`);
  }

  return { resourceType, resourceId, status: response.status };
}

/**
 * Deploy all resources for a test case
 */
async function deployTestCase(caseId) {
  const caseDir = resolve(generatedDir, caseId);
  const metadataPath = resolve(caseDir, '_metadata.json');

  if (!existsSync(metadataPath)) {
    throw new Error(`Test case not found: ${caseId}. Run 'npm run test:generate' first.`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  console.log(`Deploying: ${caseId}`);
  console.log(`  Description: ${metadata.description}`);

  const results = [];
  for (const res of metadata.resources) {
    const result = await deployResource(res.path);
    console.log(`  ${result.resourceType}/${result.resourceId} → ${result.status}`);
    results.push(result);
  }

  return { caseId, resources: results };
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node src/test-deployer.js <case-id>');
  console.error('       node src/test-deployer.js <prefix>   (e.g., onp, bcs, crc)');
  console.error('       node src/test-deployer.js --all');
  console.error(`\nHAPI server: ${HAPI_BASE_URL}`);
  process.exit(1);
}

console.log(`HAPI server: ${HAPI_BASE_URL}\n`);

let casesToDeploy = [];

if (args[0] === '--all') {
  // Deploy all generated cases
  casesToDeploy = readdirSync(generatedDir)
    .filter(f => existsSync(resolve(generatedDir, f, '_metadata.json')));
} else {
  // Could be a case ID or a prefix - check if exact match exists first
  const allCases = readdirSync(generatedDir)
    .filter(f => existsSync(resolve(generatedDir, f, '_metadata.json')));

  if (allCases.includes(args[0])) {
    // Exact case ID match
    casesToDeploy = [args[0]];
  } else {
    // Treat as prefix - find all cases starting with prefix-
    const prefix = args[0];
    const matchingCases = allCases.filter(f => f.startsWith(`${prefix}-`));

    if (matchingCases.length === 0) {
      console.error(`No generated test cases found for prefix '${prefix}' or case ID '${args[0]}'`);
      console.error(`Looking for: ${generatedDir}/${prefix}-*`);
      console.error(`\nHave you run 'npm run test:generate ${prefix}' first?`);
      process.exit(1);
    }

    console.log(`Found ${matchingCases.length} test case(s) with prefix '${prefix}':\n`);
    casesToDeploy = matchingCases;
  }
}

for (const caseId of casesToDeploy) {
  try {
    await deployTestCase(caseId);
    console.log('');
  } catch (err) {
    console.error(`Error deploying ${caseId}: ${err.message}`);
    process.exit(1);
  }
}

console.log('Deploy complete.');
