#!/usr/bin/env node
/**
 * Generates FHIR resources from YAML test case definitions.
 * Supports dynamic date functions like $fn: yearsAgo
 *
 * Usage: node src/test-generator.js tests/cases/bcs-recommend-57yo-female.yaml
 *        node src/test-generator.js --all  (processes all YAML in tests/cases/)
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { parse as parseYaml } from 'yaml';

const casesDir = resolve(process.cwd(), 'tests/cases');
const outputDir = resolve(process.cwd(), 'tests/generated');

/**
 * Date function handlers
 */
const dateFunctions = {
  yearsAgo: (params) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - params.years);
    // offsetDays: negative = older, positive = more recent
    // Default -1 for birthDate edge case (ensures birthday has passed)
    const offsetDays = params.offsetDays ?? -1;
    date.setDate(date.getDate() + offsetDays);
    // Format in local time (not UTC) to match server timezone
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },
  daysAgo: (params) => {
    const date = new Date();
    date.setDate(date.getDate() - params.days);
    // Format in local time (not UTC) to match server timezone
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },
  today: () => {
    const date = new Date();
    // Format in local time (not UTC) to match server timezone
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },
  monthsAgo: (params) => {
    const date = new Date();
    date.setMonth(date.getMonth() - params.months);
    // Format in local time (not UTC) to match server timezone
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};

/**
 * Recursively process an object, evaluating $fn date functions
 */
function processValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(processValue);
  }

  if (typeof value === 'object') {
    // Check if this is a $fn directive
    if (value.$fn && dateFunctions[value.$fn]) {
      return dateFunctions[value.$fn](value);
    }

    // Otherwise recurse into object
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = processValue(val);
    }
    return result;
  }

  return value;
}

/**
 * Process a single YAML test case file
 */
function processTestCase(yamlPath) {
  const yamlContent = readFileSync(yamlPath, 'utf-8');
  const testCase = parseYaml(yamlContent);

  const caseId = testCase.id;
  const caseOutputDir = resolve(outputDir, caseId);

  // Create output directory
  mkdirSync(caseOutputDir, { recursive: true });

  // Process each resource
  const generatedResources = [];
  for (const resource of testCase.resources) {
    const processed = processValue(resource);
    const resourceType = processed.resourceType;
    const resourceId = processed.id;

    // Write individual resource file
    const resourceDir = resolve(caseOutputDir, resourceType);
    mkdirSync(resourceDir, { recursive: true });
    const resourcePath = resolve(resourceDir, `${resourceId}.json`);
    writeFileSync(resourcePath, JSON.stringify(processed, null, 2));

    generatedResources.push({
      type: resourceType,
      id: resourceId,
      path: resourcePath
    });
  }

  // Write test case metadata (for test runner)
  const metadataPath = resolve(caseOutputDir, '_metadata.json');
  writeFileSync(metadataPath, JSON.stringify({
    id: testCase.id,
    description: testCase.description,
    tags: testCase.tags,
    expected: testCase.expected,
    resources: generatedResources,
    generatedAt: new Date().toISOString()
  }, null, 2));

  return {
    id: caseId,
    resources: generatedResources,
    outputDir: caseOutputDir
  };
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node src/test-generator.js <case-id>');
  console.error('       node src/test-generator.js <prefix>   (e.g., onp, bcs, crc)');
  console.error('       node src/test-generator.js --all');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

let filesToProcess = [];

if (args[0] === '--all') {
  // Process all YAML files
  filesToProcess = readdirSync(casesDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => resolve(casesDir, f));
} else if (args[0].endsWith('.yaml') || args[0].endsWith('.yml')) {
  // Full path to a YAML file
  filesToProcess = [resolve(args[0])];
} else {
  // Could be a case ID or a prefix - check if exact match exists first
  const exactPath = resolve(casesDir, `${args[0]}.yaml`);
  const allYamlFiles = readdirSync(casesDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  if (allYamlFiles.includes(`${args[0]}.yaml`)) {
    // Exact case ID match
    filesToProcess = [exactPath];
  } else {
    // Treat as prefix - find all files starting with prefix-
    const prefix = args[0];
    const matchingFiles = allYamlFiles
      .filter(f => f.startsWith(`${prefix}-`))
      .map(f => resolve(casesDir, f));

    if (matchingFiles.length === 0) {
      console.error(`No test cases found for prefix '${prefix}' or case ID '${args[0]}'`);
      console.error(`Looking for: ${casesDir}/${prefix}-*.yaml`);
      process.exit(1);
    }

    console.log(`Found ${matchingFiles.length} test case(s) with prefix '${prefix}':\n`);
    filesToProcess = matchingFiles;
  }
}

for (const yamlPath of filesToProcess) {
  const result = processTestCase(yamlPath);
  console.log(`Generated: ${result.id}`);
  for (const res of result.resources) {
    console.log(`  ${res.type}/${res.id} → ${res.path}`);
  }
}
