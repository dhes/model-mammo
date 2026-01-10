#!/usr/bin/env node
/**
 * Convert FHIR ValueSet resources to cql-execution format
 *
 * Input:  input/valuesets/*.json (FHIR ValueSet resources from VSAC)
 * Output: mock-emr/src/valuesets.js (importable code service data)
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT_DIR = join(__dirname, '../../input/valuesets')
const OUTPUT_FILE = join(__dirname, '../../smart-app/src/valuesets.js')

async function main() {
  const files = await readdir(INPUT_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  console.log(`Processing ${jsonFiles.length} ValueSet files...`)

  const valueSets = {}

  for (const file of jsonFiles) {
    const content = await readFile(join(INPUT_DIR, file), 'utf-8')
    let vs

    try {
      vs = JSON.parse(content)
    } catch (e) {
      console.log(`  ✗ ${file}: invalid JSON`)
      continue
    }

    if (vs.resourceType !== 'ValueSet') {
      console.log(`  ✗ ${file}: not a ValueSet`)
      continue
    }

    // Extract the OID from the URL
    // Format: http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1...
    const oid = vs.url?.split('/').pop() || vs.id
    const name = vs.name || vs.title || file

    // Extract codes from expansion
    const codes = []
    const expansion = vs.expansion?.contains || []

    for (const item of expansion) {
      if (item.code && item.system) {
        codes.push({
          code: item.code,
          system: item.system,
          display: item.display || '',
        })
      }
    }

    if (codes.length === 0) {
      console.log(`  ⚠ ${file}: no codes in expansion (try $expand endpoint)`)
      continue
    }

    // Key by the full VSAC URL (what CQL uses)
    const vsacUrl = `http://cts.nlm.nih.gov/fhir/ValueSet/${oid}`
    valueSets[vsacUrl] = {
      oid,
      name,
      codes,
    }

    console.log(`  ✓ ${name}: ${codes.length} codes`)
  }

  // Generate JavaScript module
  const output = `// Auto-generated from VSAC ValueSets
// Do not edit manually - regenerate with: node tools/vsac-download/convert-valuesets.js

export const valueSets = ${JSON.stringify(valueSets, null, 2)};

/**
 * Code service for cql-execution
 * Usage: new Executor(library, codeService)
 *
 * cql-execution calls findValueSet(oid, version) and expects an object with:
 * - codes: array of {code, system, display}
 * - hasMatch(code): function that checks if a code is in the ValueSet
 */
export const codeService = {
  findValueSet: (oid, version) => {
    // Handle both OID and full URL lookups
    const vs = valueSets[oid] ||
               Object.values(valueSets).find(v => v.oid === oid);

    const codes = vs ? vs.codes : [];

    return {
      oid: vs?.oid || oid,
      version,
      codes,
      // cql-execution calls hasMatch(code) to check membership
      hasMatch: (code) => {
        if (!code) return false;
        // code can be a Code object with code/system properties
        const codeValue = code.code || code;
        const system = code.system;
        return codes.some(c =>
          c.code === codeValue && (!system || c.system === system)
        );
      },
    };
  },
};
`

  await writeFile(OUTPUT_FILE, output)
  console.log(`\nGenerated: ${OUTPUT_FILE}`)
  console.log(`Total: ${Object.keys(valueSets).length} ValueSets`)
}

main().catch(console.error)
