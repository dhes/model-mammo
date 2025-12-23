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
- `tests/` - JSON test cases for validating DMN decision rules
- `src/dmn-runner.js` - Custom DMN evaluator (parses XML, evaluates S-FEEL expressions)
- `src/dmn-runner.test.js` - Vitest test runner
- `src/generate-library.js` - Generates FHIR Library resource from CQL
- `input/cql/` - CQL source files
- `input/resources/library/` - Generated FHIR Library resources
- `input/tests/` - FHIR test bundles (Patient, Observation, etc.)

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
npm test                 # Run all tests once
npm run test:watch       # Watch mode for development
npm run generate:library # Generate FHIR Library from CQL
```

## Testing

Test cases in `tests/` are JSON files with input/expected pairs:

```json
{
  "input": { "Gender": "female", "AgeInYears": 57, "MammogramInLastTwoYears": false },
  "expected": { "RecommendMammogram": true }
}
```

**Test cases:**
- `true.json` - positive case (female, 57, no prior)
- `just-old-enough.json` - minimum age boundary (female, 40)
- `just-young-enough.json` - maximum age boundary (female, 74)
- `too-young.json` - below minimum (female, 39)
- `too-old.json` - above maximum (female, 75)
- `male.json` - gender exclusion case

The test harness (`src/dmn-runner.js`) parses the DMN XML directly and evaluates the decision table using a custom FEEL expression parser.

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
