#!/usr/bin/env node
/**
 * Tears down (deletes) test resources from HAPI server using lifecycle tags.
 *
 * Usage: node src/test-teardown.js bcs-recommend-57yo-female   (single case by specific tag)
 *        node src/test-teardown.js --all                       (all cases by common tag)
 *
 * Environment: HAPI_BASE_URL (default: http://localhost:8080/fhir)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const HAPI_BASE_URL = process.env.HAPI_BASE_URL || 'http://localhost:8080/fhir';
const TAG_SYSTEM = 'http://example.org/test-lifecycle';
// Common tags for each guideline - used for --all teardown
const COMMON_TAG_CODES = ['bcs-test', 'tob-test', 'ccs-test', 'crc-test', 'fol-test', 'onp-test', 'hbv-test', 'prp-test', 'htn-test', 'rhd-test', 'syp-test', 'hiv-test', 'hvp-test'];
const generatedDir = resolve(process.cwd(), 'tests/generated');

/**
 * Delete resources by tag
 */
async function deleteByTag(resourceType, tagCode) {
  // First, search for resources with this tag
  // Encode the entire system|code value together
  const tagValue = `${TAG_SYSTEM}|${tagCode}`;
  const searchUrl = `${HAPI_BASE_URL}/${resourceType}?_tag=${encodeURIComponent(tagValue)}`;

  const searchResponse = await fetch(searchUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/fhir+json' }
  });

  if (!searchResponse.ok) {
    throw new Error(`Search failed: ${searchResponse.status}`);
  }

  const bundle = await searchResponse.json();
  const entries = bundle.entry || [];

  let deleted = 0;
  for (const entry of entries) {
    const resource = entry.resource;
    const deleteUrl = `${HAPI_BASE_URL}/${resource.resourceType}/${resource.id}`;

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'Accept': 'application/fhir+json' }
    });

    if (deleteResponse.ok || deleteResponse.status === 204) {
      console.log(`  Deleted: ${resource.resourceType}/${resource.id}`);
      deleted++;
    } else {
      console.log(`  Failed to delete: ${resource.resourceType}/${resource.id} (${deleteResponse.status})`);
    }
  }

  return deleted;
}

/**
 * Tear down all resources for a test case
 */
async function teardownTestCase(caseId) {
  const caseDir = resolve(generatedDir, caseId);
  const metadataPath = resolve(caseDir, '_metadata.json');

  if (!existsSync(metadataPath)) {
    throw new Error(`Test case not found: ${caseId}`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  console.log(`Tearing down: ${caseId}`);

  // Get unique resource types from metadata
  const resourceTypes = [...new Set(metadata.resources.map(r => r.type))];

  let totalDeleted = 0;
  for (const resourceType of resourceTypes) {
    const deleted = await deleteByTag(resourceType, caseId);
    totalDeleted += deleted;
  }

  if (totalDeleted === 0) {
    console.log(`  No resources found with tag: ${caseId}`);
  }

  return { caseId, deleted: totalDeleted };
}

// Map prefixes to their common tag codes
const PREFIX_TO_TAG = {
  bcs: 'bcs-test',
  tob: 'tob-test',
  ccs: 'ccs-test',
  crc: 'crc-test',
  fol: 'fol-test',
  onp: 'onp-test',
  hbv: 'hbv-test',
  prp: 'prp-test',
  htn: 'htn-test',
  rhd: 'rhd-test',
  syp: 'syp-test',
  hiv: 'hiv-test',
  hvp: 'hvp-test',
};

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node src/test-teardown.js <case-id>');
  console.error('       node src/test-teardown.js <prefix>   (e.g., onp, bcs, crc)');
  console.error('       node src/test-teardown.js --all');
  console.error(`\nHAPI server: ${HAPI_BASE_URL}`);
  console.error(`Prefixes: ${Object.keys(PREFIX_TO_TAG).join(', ')}`);
  process.exit(1);
}

console.log(`HAPI server: ${HAPI_BASE_URL}\n`);

let totalDeleted = 0;

// Resource types that might have test data (order matters: delete dependents before Patient)
const resourceTypes = ['Observation', 'Procedure', 'Condition', 'Patient'];

if (args[0] === '--all') {
  // Use common tags to delete all test resources at once
  console.log(`Tearing down ALL test resources with tags: ${COMMON_TAG_CODES.join(', ')}\n`);

  for (const tagCode of COMMON_TAG_CODES) {
    console.log(`\n--- Tag: ${tagCode} ---`);
    for (const resourceType of resourceTypes) {
      const deleted = await deleteByTag(resourceType, tagCode);
      totalDeleted += deleted;
    }
  }
} else if (PREFIX_TO_TAG[args[0]]) {
  // Prefix - use prefix-specific common tag (e.g., onp -> onp-test)
  const prefix = args[0];
  const tagCode = PREFIX_TO_TAG[prefix];
  console.log(`Tearing down resources with tag: ${tagCode}\n`);

  for (const resourceType of resourceTypes) {
    const deleted = await deleteByTag(resourceType, tagCode);
    totalDeleted += deleted;
  }
} else {
  // Single case - use case-specific tag
  const caseId = args[0];
  try {
    const result = await teardownTestCase(caseId);
    totalDeleted += result.deleted;
  } catch (err) {
    console.error(`Error tearing down ${caseId}: ${err.message}`);
  }
}

console.log(`\nTeardown complete. ${totalDeleted} resource(s) deleted.`);
