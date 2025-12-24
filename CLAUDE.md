# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Model-mammo is a breast cancer screening clinical decision model using OMG DMN. This is a proof-of-concept for scaling clinical decision support (CDS) from guidelines to point-of-care, inspired by the WHO Digital Adaptation Kits approach.

## Architectural Philosophy

**DMN as a collaboration artifact between clinical SMEs and developers.**

The traditional path from clinical guidelines to executable CDS is:
```
L1 Narrative guidelines → L2 Spreadsheets → L3 CQL code → L4 Deployed CDS
```

The problem: spreadsheets are ambiguous and untestable. CQL is opaque to clinicians.

**This project's approach:**
```
L1 Guidelines → L2 DMN (formal, testable) → L3 CQL → L4 Deployed CDS
                     ↑
            SMEs can review this
```

DMN decision tables look like spreadsheets but are:
- Formally specified (FEEL expressions)
- Testable (`npm test` validates logic before CQL is written)
- Designed for CQL translation

**"Plan forward" design principle:**

Column names and FEEL expressions are chosen to map directly to CQL:

| DMN Input | CQL Equivalent |
|-----------|----------------|
| `AgeInYears` | `AgeInYears()` function |
| `[40..74]` | `in Interval[40, 74]` |
| `MammogramInLastTwoYears` | `exists([Procedure: "Mammogram"] ...)` |

The DMN author must know CQL idioms and design tables with translation in mind.

## Project Structure

- `mammo.dmn` - Decision table defining screening recommendation logic
- `tests/` - DMN test cases (JSON input/expected pairs)
- `tests/cases/` - YAML test case definitions for HAPI testing
- `tests/generated/` - Generated FHIR resources from YAML
- `src/dmn-runner.js` - Custom DMN evaluator (parses XML, evaluates S-FEEL expressions)
- `src/dmn-runner.test.js` - Vitest test runner for DMN
- `src/generate-library.js` - Generates FHIR Library resource from CQL
- `src/test-generator.js` - Generates FHIR resources from YAML test cases
- `src/test-deployer.js` - Deploys test resources to HAPI
- `src/test-runner.js` - Runs $evaluate and compares to expected results
- `src/test-teardown.js` - Deletes test resources from HAPI by tag
- `input/cql/` - CQL source files
- `input/resources/library/` - Generated FHIR Library resources

## Technology Stack

- **Authoring Tool**: Camunda Modeler 5.41.0
- **Standards**: OMG DMN 1.3 (20191111), S-FEEL expressions
- **Test Framework**: Vitest + custom S-FEEL evaluator
- **Runtime**: Node.js (ES modules)

## Decision Logic

The DMN decision table "Breast Cancer Screening" evaluates:

**Inputs:**
- `Gender` (string): "female" or "male"
- `AgeInYears` (number): patient age
- `MammogramInLastTwoYears` (boolean): recent screening history

**Output:**
- `RecommendMammogram` (boolean)

**Rules:**
1. Female, age 40-74, no recent mammogram → recommend (TRUE)
2. Male → no recommendation (FALSE)
3. Female, age <40 → too young (FALSE)
4. Female, age >74 → too old (FALSE)

## Build & Test Commands

```bash
npm install              # Install dependencies
npm test                 # Run DMN tests (Vitest)
npm run test:watch       # Watch mode for DMN tests
npm run generate:library # Generate FHIR Library from CQL
```

## HAPI Test Lifecycle

```bash
npm run test:generate    # YAML → FHIR JSON (all cases)
npm run test:deploy      # POST to HAPI (all cases)
npm run test:evaluate    # Run $evaluate, compare results
npm run test:teardown    # DELETE from HAPI by tag
npm run test:cycle       # All four in sequence

# Single case variants
npm run test:generate:one <case-id>
npm run test:deploy:one <case-id>
npm run test:evaluate:one <case-id>
npm run test:teardown:one <case-id>
```

**Environment variables:**
- `HAPI_BASE_URL` (default: `http://localhost:8080/fhir`)
- `LIBRARY_ID` (default: `BreastCancerScreening`)

## DMN Testing

Test cases in `tests/` are JSON files with input/expected pairs for validating DMN logic:

```json
{
  "input": { "Gender": "female", "AgeInYears": 57, "MammogramInLastTwoYears": false },
  "expected": { "RecommendMammogram": true }
}
```

The test harness (`src/dmn-runner.js`) parses the DMN XML directly and evaluates the decision table using a custom S-FEEL expression parser.

## YAML Test Cases (HAPI)

Test cases in `tests/cases/` are YAML files that define QICore-compliant FHIR resources with dynamic dates:

```yaml
id: bcs-recommend-57yo-female
description: "Female, 57, no mammogram - should recommend screening"
expected:
  RecommendMammogram: true
  MammogramInLastTwoYears: false

resources:
  - resourceType: Patient
    id: bcs-recommend-57yo-female
    meta:
      profile:
        - http://hl7.org/fhir/us/qicore/StructureDefinition/qicore-patient
      tag:
        - system: http://example.org/test-lifecycle
          code: bcs-test           # common tag for bulk teardown
        - system: http://example.org/test-lifecycle
          code: bcs-recommend-57yo-female  # specific tag
    gender: female
    birthDate:
      $fn: yearsAgo
      years: 57
```

**Dynamic date functions:**
- `$fn: yearsAgo` with `years: N`
- `$fn: monthsAgo` with `months: N`
- `$fn: daysAgo` with `days: N`
- `$fn: today`

**Lifecycle tagging:**
- All test resources get tagged for cleanup
- `bcs-test` tag enables bulk teardown of all BCS test data
- Case-specific tags enable targeted teardown

## Clinical Context

Follows USPSTF/ACS guidelines for mammography screening. Age range 40-74 reflects evidence-based recommendations.

## Target Stack

```
┌─────────────────────────────┐
│  mammo.dmn (decision table) │  ← SMEs validate, tests verify
└─────────────────────────────┘
              ↓ translate
┌─────────────────────────────┐
│  CQL library                │  ← executable logic
└─────────────────────────────┘
              ↓ queries
┌─────────────────────────────┐
│  HAPI FHIR server           │  ← Patient, Procedure resources
└─────────────────────────────┘
              ↓
┌─────────────────────────────┐
│  Web app (React)            │  ← point of care UI
└─────────────────────────────┘
```

## Working with This Project

1. Edit decision table in Camunda Modeler (`mammo.dmn`)
2. Run `npm test` to validate logic
3. Translate to CQL when decision logic is stable
4. Integrate with FHIR server and web app

## CQL Deployment Approach

**Key finding: HAPI compiles CQL on-the-fly. No ELM pre-compilation needed.**

The traditional IG Publisher workflow requires:
- Java CQL-to-ELM compiler
- RefreshIG tooling
- Full IG infrastructure

This project uses a simpler path:
```
CQL source → generate-library.js → Library resource (CQL only) → HAPI
```

The `generate-library.js` script:
1. Parses library name, version, and dependencies from CQL
2. Base64 encodes the CQL source
3. Outputs a valid FHIR Library resource

This eliminates the need for Java tooling and ELM compilation in the development workflow.

## Notes

- `mammo.bpmn` exists but is not actively used—BPMN adds unnecessary complexity for stateless decision evaluation
- The custom DMN evaluator (`src/dmn-runner.js`) is scaffolding for the POC; production execution will use CQL
