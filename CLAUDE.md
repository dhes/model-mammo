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
├── input/
│   ├── dmn/                    # DMN decision tables (L2)
│   ├── cql/                    # CQL source files (L3)
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

This decision is documented in the test case `bcs-mammo-2y-exactly` which verifies that a mammogram from exactly 2 years ago triggers a recommendation.

### Screening Frequency: Guideline vs eCQM

**The issue:** USPSTF guidelines often specify *what* to do without specifying *how often*. eCQMs operationalize guidelines into measurable metrics, sometimes adding frequency requirements not in the original evidence.

**Example: Tobacco Use Screening (USPSTF Grade B)**

The USPSTF states: *"The USPSTF recommends that clinicians ask all adults about tobacco use..."*

No frequency specified. However, CMS138 (Preventive Care and Screening: Tobacco Use) requires screening "during the Measurement Period" — effectively annual:

```cql
where TobaccoUseScreening.effective.toInterval() during day of "Measurement Period"
```

This creates a gap:

| Source | Frequency | Basis |
|--------|-----------|-------|
| USPSTF guideline | Unspecified | Clinical evidence |
| CMS138 eCQM | Annual | Measurement practicality |
| Clinical practice | Varies | Local workflow |

**Decision: Configurable frequency parameter**

Rather than bake eCQM assumptions into the DMN model, we:

1. **L2 (DMN)**: Model pure eligibility criteria (e.g., `AgeInYears >= 18`)
2. **L3 (CQL)**: Add a configurable recency check (e.g., `ScreeningInInterval`)
3. **Deployment**: Configure interval per use case:
   - eCQM reporting: 1 year (Measurement Period)
   - Real-time CDS: configurable (6 months, 1 year, every encounter)

**Rationale:**

1. **Fidelity to evidence**: The DMN stays true to what USPSTF actually recommends
2. **Transparency**: eCQM frequency requirements are explicit, not invisibly embedded
3. **Flexibility**: Same model supports both quality reporting and clinical CDS
4. **Auditability**: When asked "why annual?", we can point to CMS138, not claim it's evidence-based

This pattern applies to any guideline where eCQM adds frequency constraints beyond the evidence base.

### Tobacco Screening: Pediatric Age Boundary

**The issue:** The USPSTF adult tobacco recommendation specifies 18+ years. But when should clinicians *start* asking about tobacco use?

**Two separate USPSTF recommendations exist:**

| Recommendation | Population | Intent | Grade |
|----------------|------------|--------|-------|
| Tobacco Use in Adults | 18+ years | Screen for current use → cessation interventions | B |
| Tobacco Use Prevention in Children/Adolescents | School-age | Prevent initiation → education/counseling | B |

The pediatric recommendation focuses on *prevention* (before they start), not *screening* (identify current users). Neither specifies a lower age bound for asking about tobacco use.

**Clinical reality:**
- ~90% of adult daily smokers started before age 18
- Significant tobacco/e-cigarette use exists in middle school (11-14) and high school (14-18)
- Pediatricians routinely ask about tobacco at well-child visits
- Children may experiment earlier than expected (cf. 12-year-olds puffing around a campfire in "Stand by Me")

**Decision: Model adults (18+) first, document adolescent extension**

The current `TobaccoScreening.dmn` implements the adult recommendation (18+). This keeps L2 faithful to a single, citable USPSTF recommendation.

Adolescent tobacco screening (e.g., ages 12-17) is clinically appropriate but:
1. Falls under the separate USPSTF pediatric prevention recommendation
2. Has different intent (prevent initiation vs. identify current users for cessation)
3. Lacks an evidence-based lower age threshold

**Future extension:** A second rule could be added for adolescents with a distinct annotation citing the pediatric guideline. The [12..17] range represents "ages where persons may have experimented with tobacco" — though the true lower bound is fuzzy and varies by population.

### Dual-Model Approach: USPSTF-Faithful vs eCQM-Faithful

**The problem:** USPSTF guidelines and CMS eCQMs don't always align. eCQMs operationalize guidelines for measurement, which requires resolving ambiguities and adding constraints not present in the original evidence.

**Example: Tobacco Screening Population**

| Source | Population Definition | Age Threshold |
|--------|----------------------|---------------|
| USPSTF Adults | "all adults" | 18+ |
| USPSTF Children/Adolescents | "school-aged children and adolescents" | Undefined |
| CMS138 eCQM | Combined measure | 12+ |

CMS138's `AgeInYearsAt(...) >= 12` effectively:
1. Resolves the ambiguous "school-aged" term
2. Merges the adult and adolescent guidelines into one measure
3. Defines adolescents as ages [12, 18)

**The adolescent guideline complexity:**

| Population | Recommendation | Grade |
|------------|---------------|-------|
| Adolescents who don't use tobacco | Prevent initiation (education/counseling) | B |
| Adolescents who DO use tobacco | Cessation interventions | I (insufficient evidence) |

The Grade I for adolescent cessation is significant — USPSTF found insufficient evidence to recommend cessation interventions for youth tobacco users. CMS138 sidesteps this by measuring "any intervention" without distinguishing prevention from cessation.

**Unresolved questions in USPSTF guidelines:**
- What age range is "school-aged"?
- How to handle pregnant adolescents? (Adult pregnancy rules? Adolescent rules?)
- Should adolescents be screened for tobacco use? (The guideline addresses prevention/cessation but not screening)
- How to model Grade I ("insufficient evidence") in a decision table?

**Decision: Dual-model approach**

Create two parallel L2 models:

| Model | Authoritative Source | Purpose |
|-------|---------------------|---------|
| USPSTF-faithful | Guidelines as written | SME validation, gap analysis |
| eCQM-faithful | CMS138 implementation | L3/L4 FHIR/CQL artifacts |

**Rationale:**

1. **Traceability**: Each model cites its authoritative source explicitly
2. **SME review**: USPSTF experts validate guideline fidelity; CMS experts validate eCQM alignment
3. **Gap visibility**: Differences between models surface implementation assumptions (e.g., "Why age 12?")
4. **Regulatory clarity**: Organizations know which model to use for quality reporting vs. clinical CDS
5. **Evolution tracking**: When USPSTF updates guidelines, compare against existing eCQM model

**Workflow:**

```
USPSTF Guideline (L1)
        │
        ├──→ USPSTF-faithful DMN (L2) ──→ SME review, gap analysis
        │
        └──→ eCQM-faithful DMN (L2) ──→ CQL (L3) ──→ FHIR CDS (L4)
                      │
                      └── informed by CMS138 implementation choices
```

The USPSTF-faithful model asks: "What does the guideline actually say?"
The eCQM-faithful model asks: "What did CMS decide it means for measurement?"

When these diverge, the divergence is visible and discussable — not buried in CQL.

**Example divergence: Pregnancy and Pharmacotherapy**

USPSTF explicitly distinguishes pregnant from non-pregnant adults:
- Non-pregnant smokers → behavioral interventions + pharmacotherapy
- Pregnant smokers → behavioral interventions only (pharmacotherapy is Grade I — insufficient evidence)

CMS138 omits pregnancy entirely:
```cql
define "Numerator 2":
  exists "Tobacco Cessation Counseling Given"
    or exists "Tobacco Cessation Pharmacotherapy Ordered"
    or exists "Active Pharmacotherapy for Tobacco Cessation"
```

The `or` logic means counseling alone satisfies the measure. This is permissive by design — the measure can't penalize the clinically correct choice of withholding pharmacotherapy from pregnant patients. But it also doesn't *guide* that choice.

A practitioner using CMS138 as clinical guidance (rather than just a reporting metric) might miss USPSTF's nuanced position on pregnancy.

**Three-model framework for real-time CDS:**

| Model | Source | Age | Pregnancy | Purpose |
|-------|--------|-----|-----------|---------|
| USPSTF-faithful | Guidelines as written | 18+ | Yes | SME validation |
| eCQM-faithful | CMS138 | 12+ | No | Quality reporting alignment |
| **CDS-optimized** | Best of both | 12+ | Yes | Real-time clinical reasoning |

The CDS-optimized model combines:
- CMS138's practical age threshold (12+) — operationally clear
- USPSTF's pregnancy distinction — clinically necessary
- Any other clinical nuances lost in eCQM translation

This third model is what should drive point-of-care decision support. It's neither purely USPSTF nor purely CMS138, but a thoughtful synthesis that serves the clinician.

**Key principle:** eCQMs measure *whether* you intervened. CDS guides *how* to intervene appropriately.

### COLLECT Hit Policy for OR Semantics

**The problem:** Some guidelines offer multiple acceptable options. For example, USPSTF cervical cancer screening for ages 30-65:

> "...screening every 3 years with cervical cytology alone, every 5 years with high-risk human papillomavirus (hrHPV) testing alone, or every 5 years with hrHPV testing in combination with cytology (cotesting)."

This is an OR relationship: cytology OR hrHPV OR both. How do we represent this in DMN?

**Naive approach (problematic):**

| Cytology (3y) | hrHPV (5y) | Cytology Due | hrHPV Due |
|---------------|------------|--------------|-----------|
| false | false | true | true |

When both outputs are `true`, SMEs might interpret this as "both are required" rather than "either satisfies."

**Solution: COLLECT hit policy with explicit options**

Instead of one row with `true/true`, create three rows — one for each valid option:

| Cytology (3y) | hrHPV (5y) | Cytology Due | hrHPV Due |
|---------------|------------|--------------|-----------|
| false | false | true | false |
| false | false | false | true |
| false | false | true | true |

With `hitPolicy="COLLECT"`, all three matching rows are returned as an array:

```json
[
  { "CervicalCytologyDue": true,  "hrHPVDue": false },
  { "CervicalCytologyDue": false, "hrHPVDue": true  },
  { "CervicalCytologyDue": true,  "hrHPVDue": true  }
]
```

This explicitly enumerates: "you can do cytology alone, hrHPV alone, or both (cotesting)."

**Hit policy summary:**

| Policy | Behavior | Use case |
|--------|----------|----------|
| UNIQUE | Exactly one rule matches | Simple boolean decisions |
| FIRST | First matching rule wins | Priority-ordered fallbacks |
| ANY | Multiple matches OK if outputs identical | Symmetric "either covers you" logic |
| COLLECT | Return all matching results as array | OR semantics with explicit options |

**When to use COLLECT:**

1. Guideline offers multiple acceptable interventions/tests
2. You want SMEs to see the explicit list of options
3. Downstream systems can handle array outputs

**Trade-offs:**

- Output type changes from single object to array
- CQL translation must handle array semantics
- More rows in the decision table

**Example: CervicalCancerScreening.dmn**

The cervical cancer screening table uses COLLECT to return all valid screening options for ages 30-65. For ages 21-29 (cytology only), a single result is returned. The array output makes the OR semantics unambiguous.

### Colorectal Cancer Screening: sDNA-FIT Interval and Age Range

**The sDNA-FIT interval ambiguity:**

USPSTF states: "Stool DNA-FIT every 1 to 3 years" — operationally awkward.

| Source | Interval | Basis |
|--------|----------|-------|
| USPSTF modeling (Knudsen et al.) | 1-2 years | Efficient benefit-burden balance |
| CDC/ACS/ACG narrative | 3 years | Operational/payer convention |
| **CMS130 eCQM** | **2 years** | Actual implementation |

```cql
Interval[start of "Measurement Period" - 2 years, end of "Measurement Period"]
```

**Decision: 2 years** — CMS130 already resolved the ambiguity. The eCQM sided with USPSTF modeling evidence, not the CDC/ACS/ACG narrative consensus.

**The age range question:**

| Source | Age Range | Basis |
|--------|-----------|-------|
| USPSTF Grade A | 50-75 | Strong evidence |
| USPSTF Grade B | 45-49 | Individual decision |
| ACS/ACG | 45+ | Consensus recommendation |
| **CMS130 eCQM** | **46-75** | Operational implementation |

```cql
AgeInYearsAt(date from end of "Measurement Period") in Interval[46, 75]
```

**Decision: 46-75** — CMS130 synthesized Grade A + Grade B into a single measure, effectively implementing the ACS/ACG position with a measurement-period boundary adjustment.

**Lesson: Always check MADiE.** The eCQM implementation resolves ambiguities that narrative guidelines leave open.

### Colorectal Cancer Screening: Seven Strategies and the Combo Option

USPSTF lists 7 screening strategies:

| Strategy | Interval | DMN Output Column |
|----------|----------|-------------------|
| HSgFOBT | Every year | HSgFOBT |
| FIT | Every year | FIT |
| sDNA-FIT | Every 2 years | DNA-FIT |
| CT colonography | Every 5 years | CTColonography |
| Flexible sigmoidoscopy | Every 5 years | FlexibleSigmoidoscopy |
| Flex sig + annual FIT | Flex sig 10yr, FIT 1yr | FlexibleSigmoidoscopyPlusFIT |
| Colonoscopy | Every 10 years | Colonoscopy |

**The combo strategy complexity:**

"Flexible sigmoidoscopy every 10 years + annual FIT" is a *regimen commitment*, not a single test:
- Get flex sig every 10 years (extended from 5 years)
- AND get FIT every year (during the 10 years between flex sigs)

**Modeling decision:** Include both:
- **Input side**: Rule checking `FITPerformed1Yr=true AND FlexibleSigmoidoscopyPerformed10Yr=true` (coverage check)
- **Output side**: Separate `FlexibleSigmoidoscopyPlusFIT` column (explicit strategy enumeration)

This redundancy serves SME clarity — the 7 outputs map 1:1 to USPSTF's 7 strategies.

**Coverage union principle:**

The tests form a coverage union, not exclusive tracks. If ANY test is current within its interval, screening is satisfied. Patients can mix strategies (e.g., colonoscopy 8 years ago, then switch to annual FIT). The eCQM Numerator confirms this with pure OR logic:

```cql
define "Numerator":
  exists "Fecal Occult Blood Test Performed"
    or exists "Stool DNA with FIT Test Performed"
    or exists "Flexible Sigmoidoscopy Performed"
    or exists "CT Colonography Performed"
    or exists "Colonoscopy Performed"
```

### BPMN for Process-Oriented Guidelines

Some guidelines involve workflow beyond simple decision logic:
- User input required (e.g., recording tobacco status)
- Conditional loops (e.g., re-evaluate after status recorded)
- Multiple decision points in sequence

**Two L2 representation options:**

| Approach | Artifacts | Best for |
|----------|-----------|----------|
| Single decision table | One DMN file | Stateless evaluation, simple logic |
| Process + decisions | BPMN + DMN files | Workflow with user interaction, loops |

**Example: Tobacco Screening**

The tobacco screening guideline requires:
1. Check if tobacco status is recorded
2. If not, prompt user to record it
3. Once recorded, determine interventions

This can be modeled as:
- **Single table**: All logic in one DMN, caller handles the "record status" loop
- **Process + decisions**: BPMN orchestrates flow, DMN handles decisions at each node

Both are valid L2 representations. The process model makes the workflow explicit for SME review; the single table is simpler for CQL translation.

**Current artifacts:**

*Tobacco Cessation:*
- `TobaccoCessationAdultSingleDecisionTable.dmn` — single-table approach (adult screening + intervention)
- `TobaccoCessationAdult.dmn` — combined DMN with Status and Interventions decisions
- `TobaccoCessationAdult.bpmn` — process model showing eligibility → recording → intervention flow

*Cervical Cancer Screening:*
- `CervicalCancerScreening.dmn` — uses COLLECT hit policy for OR semantics (ages 30-65 get three screening options)

*Colorectal Cancer Screening:*
- `ColorectalCancerScreening.dmn` — uses COLLECT hit policy for 7 screening strategies; age 46-75 per CMS130; sDNA-FIT 2-year interval per CMS130

## Target Stack

```
┌─────────────────────────────┐
│  input/dmn/*.dmn            │  ← SMEs validate, tests verify
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

1. Edit decision tables in Camunda Modeler (`input/dmn/*.dmn`)
2. Run `npm test` to validate DMN logic
3. Translate to CQL when decision logic is stable (`input/cql/`)
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

- `mammo.bpmn` exists but is not actively used — BPMN adds unnecessary complexity for stateless decision evaluation
- The custom DMN evaluator (`src/dmn-runner.js`) is scaffolding for the POC; production execution will use CQL
- DMN files live in `input/dmn/` to parallel `input/cql/` organization
