#!/usr/bin/env node
/**
 * Convert FHIR ValueSet resources to cql-execution format
 *
 * Input:  input/valuesets/*.json (FHIR ValueSet resources - both VSAC and custom)
 * Output: smart-app/src/valuesets.js (importable code service data)
 *
 * Handles two types of ValueSets:
 * 1. VSAC ValueSets: URL like http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1...
 * 2. Custom ValueSets: URL like http://example.org/fhir/ValueSet/hiv-tests
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

    // Use the actual URL from the ValueSet (works for both VSAC and custom)
    const url = vs.url
    if (!url) {
      console.log(`  ✗ ${file}: no URL defined`)
      continue
    }

    // Extract identifier (OID for VSAC, id for custom)
    const oid = url.split('/').pop() || vs.id
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

    // Key by the actual URL (what CQL uses in valueset declarations)
    valueSets[url] = {
      oid,
      name,
      codes,
    }

    // Identify if this is a VSAC or custom ValueSet
    const isVsac = url.includes('cts.nlm.nih.gov')
    const type = isVsac ? 'VSAC' : 'custom'
    console.log(`  ✓ ${name}: ${codes.length} codes (${type})`)
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
