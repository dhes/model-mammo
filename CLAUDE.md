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

```
├── mammo.dmn                   # Decision table (screening logic)
├── mammo.bpmn                  # Process model (reference only)
├── input/
│   ├── cql/                    # CQL source files
│   └── resources/library/      # Generated FHIR Library resources
├── tests/
│   ├── dmn/                    # DMN test cases (JSON input/expected)
│   ├── cases/                  # YAML test definitions for HAPI
│   └── generated/              # Generated FHIR resources from YAML
├── reference/
│   └── cms125/                 # Borrowed CMS test data (for reference)
└── src/
    ├── dmn-runner.js           # Custom DMN evaluator (S-FEEL)
    ├── dmn-runner.test.js      # Vitest test runner for DMN
    ├── generate-library.js     # Generates FHIR Library from CQL
    ├── test-generator.js       # YAML → FHIR resources
    ├── test-deployer.js        # POST resources to HAPI
    ├── test-runner.js          # Run $evaluate, compare results
    └── test-teardown.js        # DELETE resources by tag
```

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

Test cases in `tests/dmn/` are JSON files with input/expected pairs for validating DMN logic:

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

## Implementation Decisions

### "Biennial" Boundary Interpretation

The USPSTF guideline states: *"The USPSTF recommends biennial screening mammography for women aged 40 to 74 years."*

**The ambiguity:** Does "biennial" mean a mammogram from exactly 2 years ago still "covers" the patient, or is screening now due?

| Interpretation | Exactly 2 years ago | CQL expression |
|----------------|---------------------|----------------|
| Coverage model | Not due (still covered) | `on or after (Today() - 2 years)` |
| Interval model | Due (interval elapsed) | `after (Today() - 2 years)` |

**Decision: Interval model** — a mammogram from exactly 2 years ago means screening is due.

**Rationale:**

1. **Clinical safety**: For cancer screening, err toward recommending. A recommendation one day "early" has no clinical harm; a delayed recommendation does.

2. **Natural language alignment**: When a clinician says "come back in 2 years," both parties understand that when 2 years have elapsed, it's time. The interval model matches this shared mental model.

3. **Least surprise**: "Has it been 2 years? Yes. Is screening due? Yes." The coverage model requires explaining why "2 years = not quite yet."

4. **Guideline intent**: USPSTF promotes screening uptake. When ambiguous, interpret in favor of the guideline's purpose.

5. **Defensibility**: If asked "why recommend at exactly 2 years?", the answer is obvious. If asked "why wait until 2 years + 1 day?", you're defending an implementation detail that serves no clinical purpose.

This decision is documented in the test case `bcs-mammogram-just-due` which verifies that a mammogram from exactly 2 years ago triggers a recommendation.

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
