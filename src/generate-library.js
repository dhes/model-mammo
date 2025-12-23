#!/usr/bin/env node
/**
 * Generates a FHIR Library resource from a CQL file.
 *
 * Usage: node src/generate-library.js input/cql/BreastCancerScreening.cql
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';

const cqlPath = process.argv[2];
if (!cqlPath) {
  console.error('Usage: node src/generate-library.js <cql-file>');
  process.exit(1);
}

const cqlContent = readFileSync(resolve(cqlPath), 'utf-8');

// Parse library name and version from first line
// e.g., "library BreastCancerScreening version '0.0.1'"
const libraryMatch = cqlContent.match(/^library\s+(\w+)\s+version\s+'([^']+)'/m);
if (!libraryMatch) {
  console.error('Could not parse library name and version from CQL');
  process.exit(1);
}
const [, libraryName, libraryVersion] = libraryMatch;

// Parse dependencies (include statements)
// e.g., "include FHIRHelpers version '4.4.000' called FHIRHelpers"
const includeRegex = /^include\s+(\w+)\s+version\s+'([^']+)'(?:\s+called\s+\w+)?/gm;
const dependencies = [];
let match;
while ((match = includeRegex.exec(cqlContent)) !== null) {
  dependencies.push({ name: match[1], version: match[2] });
}

// Parse valueset references
const valuesetRegex = /^valueset\s+"([^"]+)":\s+'([^']+)'/gm;
const valuesets = [];
while ((match = valuesetRegex.exec(cqlContent)) !== null) {
  valuesets.push({ name: match[1], url: match[2] });
}

// Base64 encode the CQL
const cqlBase64 = Buffer.from(cqlContent, 'utf-8').toString('base64');

// Build the Library resource
const library = {
  resourceType: 'Library',
  id: libraryName,
  url: `http://example.org/fhir/Library/${libraryName}`,
  version: libraryVersion,
  name: libraryName,
  title: libraryName.replace(/([A-Z])/g, ' $1').trim(), // "BreastCancerScreening" -> "Breast Cancer Screening"
  status: 'draft',
  type: {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/library-type',
        code: 'logic-library',
        display: 'Logic Library'
      }
    ]
  },
  date: new Date().toISOString().split('T')[0],
  description: `CQL Library for ${libraryName}`,
  relatedArtifact: [
    ...dependencies.map(dep => ({
      type: 'depends-on',
      display: dep.name,
      resource: `http://fhir.org/guides/cqf/common/Library/${dep.name}|${dep.version}`
    })),
    ...valuesets.map(vs => ({
      type: 'depends-on',
      display: vs.name,
      resource: vs.url
    }))
  ],
  content: [
    {
      contentType: 'text/cql',
      data: cqlBase64
    }
  ]
};

// Output
const outputPath = resolve(dirname(cqlPath), '..', 'resources', 'library', `Library-${libraryName}.json`);
const outputDir = dirname(outputPath);

// Create output directory if needed
import { mkdirSync } from 'fs';
try {
  mkdirSync(outputDir, { recursive: true });
} catch (e) {
  // ignore if exists
}

writeFileSync(outputPath, JSON.stringify(library, null, 2));
console.log(`Generated: ${outputPath}`);
console.log(`  Library: ${libraryName} v${libraryVersion}`);
console.log(`  Dependencies: ${dependencies.map(d => d.name).join(', ') || 'none'}`);
console.log(`  Valuesets: ${valuesets.map(v => v.name).join(', ') || 'none'}`);
