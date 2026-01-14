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

**The SME readability question:**

The diagram above shows "SMEs can review this" at L2. This is aspirational but nuanced in practice.

| Artifact | SME-readable? | Machine-executable? | Ambiguous? |
|----------|---------------|---------------------|------------|
| USPSTF narrative | ✓ | ✗ | ✓ |
| WHO L2 spreadsheet | ✓ (mostly) | ✗ (needs interpretation) | Somewhat |
| Our DMN | Limited | ✓ | ✗ |
| CQL | ✗ | ✓ | ✗ |

**Why final DMN tables diverge from narrative:**

1. **Ambiguity resolution** — Every decision ("biennial means interval elapsed," "could become pregnant means age 15-45") moves us away from narrative language
2. **Operationalization** — We invent inputs (`HIVTestedThisPregnancy`, `GestationalAgeInWeeks`) that aren't in guidelines because guidelines say *what* but not *how to know*
3. **Edge cases** — We add rules for males, too young, too old, already tested. Guidelines assume clinical context; our tables must be complete
4. **Formal structure** — Typed columns, explicit outputs, no merged cells

**The "bridge" is the process, not the artifact:**

DMN decision tables are not intended to be directly readable by SMEs in the same way narrative guidelines are. The bridge is the *process* — starting from narrative, iterating with SME input, documenting decisions — not the artifact itself.

**SME validation happens through:**

1. **Test cases** — Input/expected pairs that SMEs can verify ("Yes, if it's her first visit and status unknown, we should test")
2. **Annotations** — Rule annotations linking back to guideline language
3. **CLAUDE.md documentation** — Explaining each operationalization decision with rationale
4. **Glossary mappings** — `GestationalAgeInWeeks >= 29` → "third trimester"

**The value of DMN isn't SME readability of the final table.** The value is:
- **Testable** — `npm test` validates logic before CQL
- **Unambiguous** — FEEL has strict semantics
- **Translatable** — Maps cleanly to CQL
- **Auditable** — Every rule explicit, every edge case visible

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

All test scripts support three modes: **prefix** (recommended), **single case**, or **all**.

```bash
# By prefix (recommended for iterative development)
npm run test:generate -- onp      # Generate all onp-* cases
npm run test:deploy -- onp        # Deploy all onp-* cases to HAPI
npm run test:evaluate -- onp      # Run $evaluate for onp-* cases
npm run test:teardown -- onp      # Delete onp-test tagged resources

# Single case (exact case ID)
npm run test:generate -- onp-recommend-newborn
npm run test:deploy -- onp-recommend-newborn
npm run test:evaluate -- onp-recommend-newborn
npm run test:teardown -- onp-recommend-newborn

# All cases
npm run test:generate -- --all
npm run test:deploy -- --all
npm run test:evaluate -- --all
npm run test:teardown -- --all

# Full cycle (all cases)
npm run test:cycle
```

**Why prefix filtering matters:**

Every `PUT` to HAPI creates a new `_history` entry, even if content is unchanged. Redeploying all test cases when working on one guideline:
- Bloats the database with unnecessary version entries
- Slows down searches
- Obscures meaningful audit trails

Use prefix filtering to touch only the resources you're actively developing.

**Supported prefixes:** `bcs`, `tob`, `ccs`, `crc`, `fol`, `onp`

**Environment variables:**
- `HAPI_BASE_URL` (default: `http://localhost:8080/fhir`)

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

### Trigger vs Context: WHO L2 vs Our DMN Approach

**The problem:** When should a decision table be evaluated?

WHO's Digital Adaptation Kits (e.g., SMART-ANC) and our DMN approach answer this differently.

**WHO L2 Spreadsheet approach — Explicit Trigger:**

```
Decision ID: ANC.DT.08 HIV testing
Trigger: ANC.B9. Conduct laboratory tests and imaging
```

WHO embeds decision tables in a workflow. The "Trigger" row references a specific activity (`ANC.B9`) in their BPMN-style care pathway. The decision table fires when the clinician reaches that step.

**Our DMN approach — Context, no trigger:**

Our DMN files declare *what* to evaluate but not *when*. The calling system (EHR, CDS hook) decides the trigger.

| Approach | Trigger | Context | Who decides "when"? |
|----------|---------|---------|---------------------|
| WHO L2 | Explicit (`ANC.B9`) | Implicit (within pathway) | The workflow |
| Our DMN | None | Explicit (in description) | The calling system |

**Implications:**

| Dimension | WHO L2 | Our DMN |
|-----------|--------|---------|
| Workflow coupling | High — assumes specific pathway | Low — trigger-agnostic |
| State assumptions | Workflow tracks state (contact #, gestational age) | Stateless — only knows EHR state at this moment |
| Flexibility | Fits WHO's specific pathway | Fits any CDS integration |
| Input design | Can use `ANC contact number = 1` | Uses `IsFirstPrenatalVisit`, `GestationalAgeInWeeks` |

**Example: HIV screening in pregnancy**

WHO can use `"Gestational age" ≥ 29 weeks` as an input because their workflow fires `ANC.B9` at known points — they know when it's the third trimester.

After refactoring to align with WHO, our `HIVScreeningPregnancy.dmn` now also uses `GestationalAgeInWeeks >= 29` directly. This works because we assume `encounter-start` trigger — the calling system provides current gestational age at each encounter, and the DMN evaluates whether to test *now*.

**WHO L2 structural differences:**

WHO's L2 spreadsheets differ structurally from OMG DMN:

| Aspect | WHO L2 Spreadsheet | OMG DMN (Camunda) |
|--------|-------------------|-------------------|
| Input definition | Embedded in each cell: `"ANC contact number" = 1` | Separated: column header defines variable, cell contains test |
| Wildcards | Cell merging | Empty cell or `-` |
| Output | Expression: `"HIV test required" = TRUE` | Typed value in output column |
| Formalism | Pseudo-FEEL, human-readable | Strict FEEL, machine-parseable |

WHO optimizes for **SME readability** — clinicians can read `"Gestational age" ≥ 29 weeks` without knowing FEEL. The trade-off is less formal rigor: no schema, no type checking, no guaranteed machine-parseability.

**Our design choice:**

We chose trigger-agnostic DMN because:

1. **Broader applicability**: Works with any EHR or CDS hook, not just WHO's pathway
2. **Stateless evaluation**: No assumptions about what the calling system tracks
3. **CQL translation**: Maps cleanly to FHIR CDS without workflow dependencies

The cost is that temporal logic (like "third trimester") must be handled via flags and the calling system, rather than assumed from workflow position.

**Default trigger model:**

While our DMN files don't embed triggers, we assume a default trigger for FHIR PlanDefinition integration:

```yaml
trigger:
  type: named-event
  name: "encounter-start"
```

This means: evaluate the decision table when a patient encounter begins — when the patient is in front of the clinician and screening decisions are actionable.

This aligns with:
- CDS Hooks `patient-view` / `encounter-start`
- Clinical reality: screening decisions are made when the patient presents

**Trigger overrides for specific use cases:**

| Use case | Trigger type | Named event / data |
|----------|--------------|-------------------|
| Screening (default) | `named-event` | `encounter-start` |
| Order-time decisions | `named-event` | `order-sign` |
| Result-triggered | `data-added` | Observation resource |
| Periodic quality checks | `periodic` | Timing schedule |

Individual PlanDefinitions can override the default when wrapping our CQL libraries.

### FHIR PlanDefinition Type Selection

**The FHIR PlanDefinition.type options:**

| Type | FHIR Definition | Fit for Our Work |
|------|-----------------|------------------|
| **order-set** | Pre-defined group of orders for a condition/stage | Poor — implies bundled orders, not decision logic |
| **clinical-protocol** | Progression of clinical activities with preconditions and triggers | Moderate — captures "when" but implies multi-step workflow |
| **eca-rule** | Event-Condition-Action rule | **Best fit** — exactly our pattern |
| **workflow-definition** | Multi-system event flow with steps and constraints | Poor — implies orchestration complexity we don't have |

**Why `eca-rule` fits best:**

Our DMN models follow the ECA pattern precisely:

```
Event:     encounter-start (named-event trigger)
Condition: DMN decision table (HIVStatus, GestationalAgeInWeeks, etc.)
Action:    PerformHIVTest = true → create ServiceRequest
```

The `eca-rule` type signals:
1. **Stateless evaluation** — no progression tracking needed
2. **Single decision point** — one trigger, one evaluation, one action
3. **Reactive logic** — fires when event occurs, not polling

**When other types would apply:**

| Type | Use case |
|------|----------|
| `clinical-protocol` | Full ANC pathway (first visit → second trimester → third trimester → delivery) as a progression with state |
| `order-set` | Bundled related orders (e.g., "prenatal panel" with HIV + HBsAg + rubella together) |
| `workflow-definition` | Handoffs between systems (lab → provider → patient notification) |

**Implication for our models:**

Each DMN decision table maps to one `eca-rule` PlanDefinition. The pregnancy HIV model with `IsFirstPrenatalVisit` and `GestationalAgeInWeeks` evaluates fresh at each encounter rather than tracking state — this is exactly what ECA rules do.

The WHO L2 spreadsheet's "Trigger: ANC.B9" annotation maps directly to `PlanDefinition.action.trigger.type = named-event`.

### Assumed Implementation Context

These DMN models assume an execution environment with:

1. **Structured patient data** — Queryable clinical history available at decision time
2. **Event-driven evaluation** — Decisions triggered by clinical events (encounter start, birth, etc.)
3. **Alert surfacing** — Positive recommendations presented as actionable reminders
4. **Closed-loop capture** — Practitioner actions recorded in structured form, available to future evaluations

In current US practice, this typically means FHIR/CQL (data + logic), CDS Hooks or PlanDefinition (triggers), and QI-Core profiles (structured capture). But the L2 models are technology-agnostic — the same DMN could target HL7v2/Arden Syntax or proprietary EMR logic.

**Key separation:** L2 specifies the decision; L3/L4 specifies the plumbing.

**Current artifacts:**

*Tobacco Cessation:*
- `TobaccoCessationAdultSingleDecisionTable.dmn` — single-table approach (adult screening + intervention)
- `TobaccoCessationAdult.dmn` — combined DMN with Status and Interventions decisions
- `TobaccoCessationAdult.bpmn` — process model showing eligibility → recording → intervention flow

*Cervical Cancer Screening:*
- `CervicalCancerScreening.dmn` — uses COLLECT hit policy for OR semantics (ages 30-65 get three screening options)

*Colorectal Cancer Screening:*
- `ColorectalCancerScreening.dmn` — uses COLLECT hit policy for 7 screening strategies; age 46-75 per CMS130; sDNA-FIT 2-year interval per CMS130

*Folic Acid Supplementation:*
- `FolicAcidSupplementation.dmn` — risk-stratified dosing (400mcg vs 4mg); age 15-45 per ACOG

*HIV Screening:*
- `HIVScreeningAge.dmn` — age-based model: universal 15-65, risk-based outside that range
- `HIVScreeningPregnancy.dmn` — pregnancy-specific model with third-trimester repeat flag

*Hypertension Screening:*
- `HypertensionScreeningAdult.dmn` — screening-only model; age-stratified intervals (annual for 40+ and at-risk, 3-5 years for low-risk 18-39)

*Ophthalmia Neonatorum Prophylaxis:*
- `OphthalmiaNeonatorumProphylaxis.dmn` — universal newborn prophylaxis; persistent reminder until documented

*HIV Pre-Exposure Prophylaxis:*
- `HIVPreexposureProphylaxis.dmn` — eligibility + indication model; 8 inputs, FIRST hit policy for early exclusion

*Rh(D) Incompatibility Screening:*
- `RhdIncompatibility.dmn` — Grade A only (first prenatal visit); persistent reminder pattern

*Syphilis Screening:*
- `SyphilisScreening.dmn` — composite table (pregnancy + non-pregnancy); 7 rules

### Folic Acid Supplementation: Operationalizing "Could Become Pregnant"

**The USPSTF language:**

> "The USPSTF recommends that all persons planning to or who could become pregnant take a daily supplement containing 0.4 to 0.8 mg (400 to 800 mcg) of folic acid."

**The operationalization challenge:** "Could become pregnant" is clinically fuzzy — it's not just biological capability but involves patient intent, circumstances, and clinical judgment.

**ACOG's concrete approach:**

> "All women of reproductive age (15–45 years) should take folic acid supplementation."

This transforms a fuzzy eligibility criterion into an age-based rule.

**Decision: Age 15-45 per ACOG**

| Source | Population | Basis |
|--------|------------|-------|
| USPSTF | "Could become pregnant" | Intent + capability (fuzzy) |
| ACOG | Women 15-45 years | Age-based proxy (concrete) |

**Rationale:**

1. **Operationally clear**: Age is available in EHR; pregnancy intent often isn't
2. **Conservative**: Captures essentially all who *could* become pregnant
3. **Citable authority**: ACOG is authoritative for reproductive health
4. **NTD prevention timing**: Folic acid must be present *before* conception — waiting for stated intent is too late

### Folic Acid: Dose Range and Risk Stratification

**USPSTF dose range:** 0.4 to 0.8 mg (400-800 mcg) — unhelpfully broad for implementation.

**ACOG clarification:**

> "For average-risk women, supplementation with 400 micrograms per day is adequate."

**High-risk population (4mg dose):**

USPSTF and ACOG identify high-risk groups needing higher doses:

| Risk Factor | Source |
|-------------|--------|
| Prior pregnancy with NTD | USPSTF, ACOG |
| Personal/family history of NTD | USPSTF |
| Partner with NTD or NTD-affected child | ACOG |
| Anticonvulsant medications | ACOG |
| MTHFR mutations | ACOG |
| Bariatric surgery | ACOG |

**Decision: Abstract to `HighRiskForNTD` boolean**

Rather than enumerate specific risk factors in the DMN (which would require extensive clinical data), we use an abstracted flag:

```
HighRiskForNTD = true  →  TakeDailyFolate4Mg
HighRiskForNTD = false →  TakeDailyFolate400Mcg
```

This creates a "clinical judgment basket" — the specific criteria feeding into `HighRiskForNTD` are determined at the CQL/implementation layer based on available data:

- If EHR has structured prior-NTD data: use it
- If medication list includes anticonvulsants: flag as high-risk
- If genetic data shows MTHFR: flag as high-risk
- Otherwise: default to average-risk

**Why this pattern:**

1. **DMN stays simple**: Two clean outputs, one risk input
2. **Risk assessment flexibility**: Different implementations can expand/contract the high-risk criteria based on available data
3. **SME clarity**: The table clearly shows the two pathways (400mcg vs 4mg) without drowning in criteria details
4. **Matches USPSTF structure**: USPSTF distinguishes "average risk" vs "increased risk" — the DMN mirrors this

### HIV Screening: Two-Model Approach

**The USPSTF recommendation (Grade A) has two distinct populations:**

| Population | Recommendation |
|------------|----------------|
| Adolescents & adults 15-65 | Universal screening |
| Outside 15-65 | Screen if risk factors present |
| Pregnant persons (all ages) | Screen at first prenatal visit |

**Decision: Separate age-based and pregnancy-specific models**

Rather than a single unified model, we use two DMN files:

| Model | Inputs | Outputs |
|-------|--------|---------|
| `HIVScreeningAge.dmn` | AgeInYears, HasHIVRiskFactors, HasHIVTest | RecommendHIVTesting |
| `HIVScreeningPregnancy.dmn` | HIVStatus, HasHIVRiskFactors, IsFirstPrenatalVisit, GestationalAgeInWeeks | PerformHIVTest |

**Rationale for separation:**

1. **Different inputs**: Age model uses lifetime `HasHIVTest`; pregnancy model uses encounter-specific inputs
2. **Different populations**: Age-based (15-65) vs pregnancy (all ages)
3. **Cleaner integration**: Calling system invokes the appropriate model based on pregnancy status
4. **Pregnancy trumps age**: A pregnant 14-year-old or 70-year-old gets screened via the pregnancy model

### HIV Screening Pregnancy: WHO-Aligned Refactoring

**The evolution:**

Initial approach used a `RepeatThirdTrimester` flag — evaluate at first visit, flag for later. This conflated "first visit decision" with "any-visit status check."

**Refactored approach (WHO-aligned):**

The pregnancy model now evaluates "should we test NOW?" at any encounter:

| HIVStatus | HasHIVRiskFactors | IsFirstPrenatalVisit | GestationalAgeInWeeks | PerformHIVTest |
|-----------|-------------------|----------------------|----------------------|----------------|
| "positive" | - | - | - | false |
| "negative","unknown" | - | true | - | true |
| "negative","unknown" | false | false | ≥29 | false |
| "negative","unknown" | true | false | ≥29 | true |
| "negative","unknown" | - | false | <29 | false |

**Key design choices:**

1. **`HIVStatus` enum** — Aligns with WHO's `"HIV status" = "HIV positive"` exclusion
2. **`IsFirstPrenatalVisit`** — Mirrors WHO's `"ANC contact number" = 1`
3. **`GestationalAgeInWeeks`** — Direct WHO alignment; called system provides current value at each encounter
4. **Single output** — "Test now?" not "test now and schedule later"

**Why this works with our trigger model:**

Assuming `encounter-start` trigger, the calling system provides current gestational age at each encounter. The DMN evaluates whether to test *at this encounter*, not what to schedule for later.

**Alternative considered and rejected:** Flag-based approach with `RepeatThirdTrimester` output — required the calling system to track flags and check them later. The WHO-aligned approach is simpler: each encounter is a fresh evaluation.

### HIV Screening: Risk Factor Abstraction

Same pattern as folic acid: `HasHIVRiskFactors` is a clinical judgment basket.

**Risk factors per USPSTF:**
- Male-to-male sexual contact (67% of new diagnoses)
- Injection drug use
- Unprotected sex with multiple partners of unknown status
- Transactional sex
- STIs or partners with STIs
- Partners living with HIV
- High-prevalence settings (STI clinics, correctional facilities, homeless shelters)

**Why abstract:**

1. Many factors involve sensitive information or clinical judgment
2. Data availability varies by implementation
3. DMN stays focused on the decision logic, not data collection

### HIV Screening: Frequency Not Specified

**USPSTF explicitly states:** "insufficient evidence to determine appropriate or optimal time intervals" for repeat screening.

**CDC recommends:** Annual screening for at-risk individuals.

**Decision:** The `HasHIVTest` input abstracts recency — the calling system defines what "recent" means:
- For eCQM alignment: test within measurement period
- For clinical CDS: configurable (annual, per-encounter, etc.)

This matches our "configurable frequency" pattern from tobacco screening.

### Hypertension Screening: Screening vs Management Scope

**The problem:** CMS22 eCQM measures both screening AND follow-up actions. How do we scope the DMN?

**CMS22 structure:**

| BP Reading | Required Follow-up |
|------------|-------------------|
| Normal (<120/<80) | None |
| Elevated (120-129/<80) | Rescreen 6 months + lifestyle interventions |
| Stage 1 HTN first reading (≥130 OR ≥80) | Rescreen 4 weeks + lifestyle (or referral) |
| Stage 1 HTN second reading (130-139/80-89) | Lab/ECG + lifestyle + rescreen 6 months |
| Stage 2 HTN second reading (≥140 OR ≥90) | Lab/ECG + lifestyle + pharmacotherapy + rescreen 4 weeks |

**Decision: Screening-only scope**

The `HypertensionScreeningAdult.dmn` answers only: "Should we measure BP at this encounter?"

Follow-up logic (what to do after measuring) would be a separate decision table. This separation:

1. **Matches clinical workflow**: Screening is a pre-measurement decision; follow-up is post-measurement
2. **Keeps each table focused**: One question per table
3. **Aligns with our ECA pattern**: Event (encounter) → Condition (DMN) → Action (measure or not)

### Hypertension Screening: Age-Stratified Intervals

**USPSTF specifies three populations:**

| Population | Interval | DMN Implementation |
|------------|----------|-------------------|
| Adults 40+ years | Annual | Check `OBPMBInTheLastYear` |
| Adults 18-39 at increased risk | Annual | Check `OBPMBInTheLastYear` |
| Adults 18-39 low-risk with prior normal | Every 3-5 years | Check `OBPMBInTheLast4Years` |

**The 3-5 year ambiguity:**

USPSTF says "every 3 to 5 years" without specifying exactly.

**Decision: 4 years as operational midpoint**

Using 4 years:
- More conservative than 5 years (biased toward screening)
- More practical than 3 years (reduces unnecessary visits)
- Matches common clinical workflows (round numbers)

### Hypertension Screening: Risk Factor Abstraction

**USPSTF defines "increased risk" as:**
- Age 40+ (captured separately in table)
- Black persons
- High-normal blood pressure (120-129/<80)
- Overweight or obese

**Decision: Abstract to `AtIncreasedRisk` boolean**

Same pattern as `HasHIVRiskFactors` and `HighRiskForNTD`:

1. DMN uses a single boolean input
2. CQL/implementation layer computes the flag based on available data
3. Allows flexibility across implementations with varying data availability

**Note:** "High-normal BP" creates a circular dependency — you need to measure BP to know if they have high-normal BP. In practice:
- Prior BP readings inform current risk status
- First-visit patients default to screening (no prior BP to assess)

### Hypertension Screening: Two Interval Inputs Pattern

**The design challenge:**

Two different intervals apply to different populations:
- Annual (1 year) for 40+ and at-risk 18-39
- 3-5 years (4 years) for low-risk 18-39

**Initial approach had impossible states:**

Using two boolean inputs (`OBPMBInTheLastYear`, `OBPMBInTheLast4Years`) created logically impossible combinations:
- `OBPMBInTheLastYear=true` AND `OBPMBInTheLast4Years=false` — impossible (if you have a BP in last year, you have one in last 4 years)

**Solution: Wildcards for irrelevant intervals**

Each population only cares about ONE interval:

| Population | Cares about 1yr? | Cares about 4yr? |
|------------|-----------------|------------------|
| 40+ | Yes | No (wildcard) |
| 18-39 at-risk | Yes | No (wildcard) |
| 18-39 low-risk | No (wildcard) | Yes |

By using `-` (wildcard) for the interval that doesn't apply, we:
1. Eliminate impossible state combinations
2. Make the table logic clearer
3. Signal which interval applies to which population

### Ophthalmia Neonatorum Prophylaxis: Universal with Persistent Reminder

**The simplest guideline:**

USPSTF Grade A: "The USPSTF recommends prophylactic ocular topical medication for all newborns to prevent gonococcal ophthalmia neonatorum."

- Universal recommendation (all newborns)
- No exclusions
- One-time action at birth

**Design question: Input or no input?**

| Option | Logic | Trade-off |
|--------|-------|-----------|
| No input | Always return `true` | Maximally simple; "once" enforced by trigger |
| With input | Check if already done | Persistent reminder until documented |

**Decision: Keep the input (persistent reminder pattern)**

Clinical reality in delivery settings:
- Routine delivery: medication given and recorded promptly
- Complicated delivery: chaos, possible oversight, unit transfers
- The alert should **keep firing** until someone documents administration

This matches a "to-do list" pattern:
```
OcularProphylaxisAdministered = false → AdministerOcularProphylaxis = true  (keep reminding)
OcularProphylaxisAdministered = true  → AdministerOcularProphylaxis = false (task complete)
```

**Trigger model:**

Unlike periodic screenings (encounter-start), this fires:
1. At birth (initial trigger)
2. On each chart access until documented (persistent reminder)

This ensures the NICU nurse asking "did you give the drops?" gets an answer from the system.

**No eCQM or WHO SMART correlate:**

This guideline has no MADiE eCQM implementation. WHO provides narrative guidance (Recommendations on Newborn Health, 2017) but no SMART decision table. The DMN is derived directly from USPSTF.

**Medication variation:**

| Source | Approved agents |
|--------|-----------------|
| USPSTF/FDA | 0.5% erythromycin (only US option) |
| WHO | tetracycline 1%, erythromycin 0.5%, povidone iodine 2.5%, silver nitrate 1%, chloramphenicol 1% |

The input `OcularProphylaxisAdministered` abstracts over these options — any documented prophylaxis clears the alert.

### HIV Pre-Exposure Prophylaxis (PrEP): Eligibility + Indication Pattern

**The USPSTF recommendation (Grade A):**

> "The USPSTF recommends that clinicians prescribe preexposure prophylaxis (PrEP) using effective antiretroviral therapy to persons who are at increased risk of HIV acquisition."

**Population:** "Adults and adolescents weighing at least 35 kg (77 lb)"

**Structural complexity:**

Unlike simple screening recommendations, PrEP requires:
1. **Eligibility criteria** — Can this person safely receive PrEP?
2. **Indication criteria** — Should this person receive PrEP?

Both must be satisfied for a prescription.

### PrEP: Operationalizing "Adolescents"

**The ambiguity:** USPSTF specifies "adolescents" without an explicit lower age bound.

**Options considered:**

| Age | Rationale |
|-----|-----------|
| None | Let weight (35kg) be the only threshold |
| 12 | Aligns with CMS138 tobacco screening adolescent threshold |
| 13 | Common legal threshold for adolescent consent |
| 15 | Aligns with HIV screening age-based threshold |
| 18 | Adults only |

**Decision: 13 years**

Rationale:
1. Commonly recognized as adolescent threshold for consent/legal purposes
2. Conservative — aligns with when adolescents may begin sexual activity
3. The 35kg weight threshold provides additional physiological gating
4. Matches WHO SMART-HIV approach (references "adolescents" broadly)

### PrEP: Weight Threshold per FDA

**The requirement:** "weighing at least 35 kg (77 lb)"

This is an FDA pharmacokinetic threshold, not a clinical guideline judgment. The DMN enforces it directly as `WeightInKilo >= 35`.

### PrEP: WHO-Informed Exclusion Criteria

**Beyond USPSTF:** The WHO and CDC provide implementation guidance that informs eligibility criteria:

| Criterion | Source | Rationale |
|-----------|--------|-----------|
| HIV-negative | USPSTF/WHO | PrEP is prophylaxis; HIV+ persons need treatment |
| Creatinine clearance ≥60 mL/min | WHO | TDF-containing PrEP requires adequate kidney function |
| No acute HIV symptoms | WHO/CDC | May indicate acute HIV infection (window period) — defer, test further |
| No probable recent exposure (72h) | WHO | Recent exposure → PEP pathway, not PrEP |
| No contraindications | Clinical | Allergy or drug interactions with TDF/FTC/etc. |

These become the first 7 exclusion rules in the table (FIRST hit policy).

### PrEP: HasPrEPIndication Abstraction

**The complexity:** USPSTF defines "increased risk" through multiple factors:

- Sexual partner with HIV (especially if not virally suppressed)
- Bacterial STI in past 6 months (syphilis, gonorrhea, chlamydia)
- Inconsistent/no condom use with partners of unknown HIV status
- Shares injection drug equipment
- Drug-injecting partner with HIV
- Key populations: MSM, transgender women, persons who inject drugs, transactional sex

**Decision: Abstract to `HasPrEPIndication` boolean**

Same pattern as `HasHIVRiskFactors`, `HighRiskForNTD`, and `AtIncreasedRisk`:

1. **DMN stays focused**: One boolean captures "patient has risk factors warranting PrEP"
2. **L3 computes the details**: CQL evaluates STI history, partner status, key populations
3. **Flexibility**: Different implementations can use available data
4. **Clinical judgment preserved**: Clinician can override based on conversation

The list of risk factors is documented in the DMN description for traceability, but the decision logic uses the abstracted flag.

### PrEP: FIRST Hit Policy for Early Exclusion

**Design choice:** Use `hitPolicy="FIRST"` with exclusions ordered first.

**Rule order:**

1. Age < 13 → false (exclude)
2. Weight < 35 → false (exclude)
3. HIV+ → false (exclude)
4. Renal insufficient → false (exclude)
5. Acute HIV symptoms → false (exclude)
6. Recent exposure → false (exclude — use PEP pathway)
7. Contraindications → false (exclude)
8. No indication → false (eligible but no risk factors)
9. All criteria met → true (prescribe)

**Why FIRST:**

1. **Short-circuit evaluation**: Stop at first matching exclusion
2. **Clear precedence**: Exclusions take priority over indication
3. **SME clarity**: Read top-to-bottom as "first check age, then weight, then..."
4. **Matches clinical workflow**: Rule out ineligible patients first

### PrEP: No eCQM Correlate

Unlike tobacco (CMS138) or colorectal (CMS130), there is no MADiE eCQM for PrEP. The WHO SMART-HIV repository contains `HIVC7DTLogic.cql` with related decision logic, which informed the eligibility criteria structure.

**Sources:**
- https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prevention-of-human-immunodeficiency-virus-hiv-infection-pre-exposure-prophylaxis
- WHO SMART-HIV: HIVC7DTLogic.cql

### Rh(D) Incompatibility Screening: Grade A Only

**The USPSTF recommendations:**

| Grade | Population | Recommendation |
|-------|------------|----------------|
| A | All pregnant women, first visit | Rh(D) blood typing and antibody testing |
| B | Unsensitized Rh(D)-negative women, 24-28 weeks | Repeat antibody testing |

**Decision: Model Grade A only**

The `RhdIncompatibility.dmn` covers only the Grade A (first prenatal visit) recommendation.

**Rationale:**
1. **Clear boundary**: Grade A is universal; Grade B requires knowing Rh status from the first test
2. **Separate concerns**: Grade B depends on Grade A results — better modeled as a separate decision
3. **Scope clarity**: Keeps each DMN focused on one recommendation

Grade B would require additional inputs (`RhDNegative`, `Sensitized`, `GestationalAgeInWeeks`) and could be a future extension.

### Rh(D) Incompatibility: Persistent Reminder Pattern

Same pattern as Ophthalmia Neonatorum Prophylaxis:

```
RhDAndAntibodyScreenDone = false → PerformRhDAndAntibodyTests = true  (keep reminding)
RhDAndAntibodyScreenDone = true  → PerformRhDAndAntibodyTests = false (task complete)
```

**Trigger context:** Prenatal care encounters (begins first prenatal visit, ends at delivery).

**Why this works:** Unlike periodic screening (e.g., mammography every 2 years), Rh(D) testing is a one-time action per pregnancy. The alert fires on every prenatal encounter until testing is documented.

### Rh(D) Incompatibility: No eCQM or WHO Correlate

| Source | Status |
|--------|--------|
| MADiE eCQM | None found (searched 2026-01-05) |
| WHO ANC | Discusses Rh incompatibility but doesn't expressly recommend first-visit testing |
| ACOG | Assumes universal first-visit testing (paywalled) |

The DMN is derived directly from USPSTF Grade A recommendation.

**Source:** https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/rh-d-incompatibility-screening

### Syphilis Screening: Composite Table Design

**Two USPSTF Grade A recommendations combined:**

| Population | Recommendation | Risk-based? |
|------------|----------------|-------------|
| Non-pregnant adolescents/adults | Screen if at increased risk | Yes |
| Pregnant persons | Universal early screening | No |

**Design decision: Single composite table**

Rather than two separate DMN files, we combine both recommendations into one 7-rule table.

**Rationale:**
1. **L4 completeness**: Implementation needs all rules regardless of how they're presented
2. **Mutual exclusivity**: Pregnant and non-pregnant pathways don't overlap
3. **Shared exclusions**: Symptomatic patients excluded from both (need diagnostic testing)

**Trade-off:** SMEs may find a two-table format easier to review. A future refactor could split into `SyphilisScreeningPregnancy.dmn` and `SyphilisScreeningNonPregnancy.dmn`.

### Syphilis Screening: AdolescentOrAdult Consolidation

**The problem:** Initial draft had separate `Adolescent` and `Adult` boolean columns, creating:
- Impossible states (both true, or both false)
- Redundant rules (paired adolescent/adult versions of each rule)
- 10 rules instead of 7

**Solution:** Consolidate to single `AdolescentOrAdult` boolean.

This mirrors USPSTF language ("adolescents and adults") and eliminates the impossible state problem. The calling system determines the threshold (typically 12-15 years) for what constitutes "adolescent."

**Child exclusion:** Rule 3 explicitly handles `AdolescentOrAdult=false` (children) → no screening, since USPSTF specifies "adolescents and adults."

### Syphilis Screening: Symptomatic Exclusion

**USPSTF specifies "asymptomatic" for both populations.**

Symptomatic patients (chancre, rash, etc.) need diagnostic testing, not screening. Rule 7 catches all symptomatic cases (pregnant or not) with a single rule:

```
Asymptomatic=false → PerformSyphilisTesting=false
```

This is a clean catch-all that applies regardless of other inputs.

### Syphilis Screening: No Repeat Screening in Pregnancy (Grade A)

The Grade A recommendation covers only the initial screening. USPSTF does not make a definitive recommendation on repeat screening (insufficient evidence).

**CDC/ACOG recommend repeat screening at 28 weeks and delivery for high-risk pregnant persons**, but this is not modeled in the current DMN (would require additional inputs for risk status during pregnancy and gestational age).

### Syphilis Screening: No eCQM Correlate

| Source | Status |
|--------|--------|
| MADiE eCQM | None found (searched 2026-01-05) |
| WHO SMART-ANC | ANCDT11.cql covers syphilis in pregnancy |

**Sources:**
- https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/syphilis-infection-nonpregnant-adults-adolescents-screening
- https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/syphilis-infection-in-pregnancy-screening

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

## Implementing a New Guideline (Step-by-Step)

When adding a new USPSTF guideline, follow this checklist:

### 1. Create CQL Library

Write the CQL file in `input/cql/<LibraryName>.cql`. Use existing libraries as templates.

### 2. Create ValueSet (if needed)

If the guideline references procedures/observations not already in `input/valuesets/`, create a new ValueSet JSON file.

### 3. Generate FHIR Library

```bash
node src/generate-library.js input/cql/<LibraryName>.cql
```

This creates `input/resources/library/Library-<LibraryName>.json`.

### 4. Compile CQL to ELM (for smart-app)

**IMPORTANT:** Run from the `tools/cql-translator` directory:

```bash
cd tools/cql-translator
mvn exec:java -q -Dexec.args="--input ../../input/cql/<LibraryName>.cql --output ../../smart-app/src/elm --format JSON"
```

This compiles CQL to ELM JSON and places it in `smart-app/src/elm/`.

**Common errors:**
- "Cannot find symbol" — missing valueset or dependency
- Profile/type mismatch — ensure QICore types match (see "QICore Profile-to-CQL Type Mapping")

### 5. Create Test Cases

Create YAML test cases in `tests/cases/` using a 3-letter prefix (e.g., `onp-` for Ophthalmia Neonatorum Prophylaxis):

```yaml
id: onp-recommend-newborn
description: "Newborn without prophylaxis - should recommend"
expected:
  AdministerOcularProphylaxis: true
  IsNewborn: true

resources:
  - resourceType: Patient
    id: onp-recommend-newborn
    meta:
      profile:
        - http://hl7.org/fhir/us/qicore/StructureDefinition/qicore-patient
      tag:
        - system: http://example.org/test-lifecycle
          code: onp-test
        - system: http://example.org/test-lifecycle
          code: onp-recommend-newborn
    gender: male
    birthDate:
      $fn: daysAgo
      days: 1
```

### 6. Update Test Infrastructure

**`src/test-runner.js`** — Add prefix-to-library mapping:

```javascript
const PREFIX_TO_LIBRARY = {
  // existing entries...
  onp: 'OphthalmiaNeonatorumProphylaxis',
};
```

**`src/test-teardown.js`** — Add tag to `COMMON_TAG_CODES`:

```javascript
const COMMON_TAG_CODES = ['bcs-test', 'tob-test', 'ccs-test', 'crc-test', 'fol-test', 'onp-test'];
```

### 7. Update mock-emr

Add guideline configuration to `mock-emr/src/App.jsx`:

```javascript
const GUIDELINE_CONFIG = {
  // existing entries...
  onp: {
    libraryId: 'OphthalmiaNeonatorumProphylaxis',
    title: 'Ophthalmia Neonatorum Prophylaxis',
    getAlerts: (result, getValue) => { /* ... */ },
    getDetails: (result, getValue) => [ /* ... */ ],
  },
};
```

### 8. Update smart-app (if using client-side CQL)

**`smart-app/src/App.jsx`:**
1. Import the ELM: `import LibraryELM from './elm/LibraryName.json'`
2. Add to `elmLibraries` object
3. Add guideline config and eligibility check

### 9. Deploy and Test

```bash
npm run test:generate -- --all    # Generate FHIR resources
npm run test:deploy -- --all      # Deploy to HAPI
npm run test:evaluate -- --all    # Run tests
```

### Prefix Convention

| Prefix | Guideline |
|--------|-----------|
| bcs | Breast Cancer Screening |
| tob | Tobacco Screening |
| ccs | Cervical Cancer Screening |
| crc | Colorectal Cancer Screening |
| fol | Folic Acid Supplementation |
| onp | Ophthalmia Neonatorum Prophylaxis |
| rhd | Rh(D) Incompatibility |
| htn | Hypertension Screening |
| hiv | HIV Screening (Age-based) |
| hvp | HIV Screening (Pregnancy) |
| syp | Syphilis Screening |
| prp | HIV Pre-Exposure Prophylaxis |

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

### HAPI Library Caching Issue

**Problem:** HAPI caches compiled CQL/ELM internally. When you update a Library resource with the same ID, HAPI may continue using the cached (old) version for `$evaluate` operations.

**Symptoms:**
- `$evaluate` returns `unknown` for outputs that should work
- New CQL expressions (e.g., helper definitions) are missing from output
- Old behavior persists despite successful PUT of updated Library

**Diagnosis:** If an expression defined in your CQL doesn't appear in `$evaluate` output, HAPI is likely using a cached older version.

**Workaround:** Delete and expunge the Library before re-uploading:

```bash
# 1. Delete the Library
curl -X DELETE "http://localhost:8080/fhir/Library/TobaccoScreening"

# 2. Expunge all versions (clears the cache)
curl -X POST "http://localhost:8080/fhir/Library/TobaccoScreening/$expunge" \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Parameters",
    "parameter": [
      {"name": "expungeDeletedResources", "valueBoolean": true},
      {"name": "expungePreviousVersions", "valueBoolean": true}
    ]
  }'

# 3. Re-upload the Library
curl -X PUT "http://localhost:8080/fhir/Library/TobaccoScreening" \
  -H "Content-Type: application/fhir+json" \
  -T input/resources/library/Library-TobaccoScreening.json
```

**Root cause:** Likely related to re-using the same Library ID across versions. Stricter version control (e.g., `TobaccoScreening-0.0.2`) might avoid this, but expunge is the reliable workaround.

**Severe caching:** In some cases, the cache is keyed by the CQL library NAME (not just the FHIR resource ID). If DELETE + expunge doesn't work, try:
1. Change the `library Name version 'X.Y.Z'` declaration in the CQL file
2. Regenerate and deploy with a completely new library name
3. Once verified, rename back to the original name (with new version)

**Note:** This affects development iteration. Production deployments with proper versioning may not encounter this issue.

### QICore Profile-to-CQL Type Mapping

**Critical:** The QICore profile on your FHIR resource must match the CQL retrieve type. Mismatches cause silent failures — the query returns empty results.

| QICore Profile | CQL Retrieve Type | Use Case |
|----------------|-------------------|----------|
| `qicore-observation-lab` | `LaboratoryResultObservation` | Lab tests (Pap, HPV, glucose, etc.) |
| `qicore-simple-observation` | `SimpleObservation` | Simple clinical observations |
| `qicore-observation-clinical-result` | `ObservationClinicalResult` | Clinical test results |
| `qicore-procedure` | `Procedure` | Procedures (mammogram, colonoscopy) |
| `qicore-condition-problems-health-concerns` | `ConditionProblemsHealthConcerns` | Diagnoses, conditions |

**How to get it right:**

1. **Check CMS eCQM test cases first.** If CMS124 (Cervical Cancer Screening) uses `qicore-observation-lab` for Pap tests, use that profile and `LaboratoryResultObservation` in CQL.

2. **Match profile to type.** If your YAML test case declares `profile: qicore-observation-lab`, your CQL must use `[LaboratoryResultObservation: "ValueSet"]`, not `[SimpleObservation: ...]`.

3. **Symptoms of mismatch:**
   - `$evaluate` returns `null` or empty for observation-based outputs
   - Patient-level outputs (age, gender) work fine
   - Observation/Procedure outputs fail

**Example (correct):**

```yaml
# Test case YAML
- resourceType: Observation
  meta:
    profile:
      - http://hl7.org/fhir/us/qicore/StructureDefinition/qicore-observation-lab
  code:
    coding:
      - system: http://loinc.org
        code: "10524-7"  # Pap test
```

```cql
// CQL - LaboratoryResultObservation matches qicore-observation-lab
define QualifyingCervicalCytology:
  [LaboratoryResultObservation: "Pap Test"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }
```

**Lesson learned:** When observation retrieves fail, check profile alignment before trying workarounds like direct codes or different observation types.

### CQL Library Includes: Always Use Aliases

**Critical:** When including CQL libraries, **always use an alias** with the `called` keyword. Without an alias, the included library's definitions merge directly into your namespace and can conflict with other included libraries.

**Correct:**
```cql
include FHIRHelpers version '4.4.000' called FHIRHelpers
include QICoreCommon version '4.0.000' called QC
include Status version '1.13.000' called Status
```

**Wrong (causes namespace conflicts):**
```cql
include Status version '1.13.000'   // No alias!
```

**Symptoms of missing alias:**
- HAPI `$evaluate` returns: "Could not resolve model with namespace http://hl7.org/fhir"
- Error mentions: "An operand identifier references is hiding another identifier of the same name"
- Libraries that don't use the conflicting include work fine; libraries that use it fail

**Why this happens:** Libraries like `Status` and `QICoreCommon` define fluent functions (`.isActive()`, `.toInterval()`, etc.) with common names. When included without an alias, these definitions enter the local namespace and can shadow or conflict with definitions from other includes.

**Lesson learned:** Always follow the eCQM convention — every `include` should have a `called <alias>` clause.

## Two Web Apps: Server-Side vs Client-Side CQL

This project includes two React/Vite applications demonstrating different CQL execution approaches:

| | mock-emr | smart-app |
|---|----------|-----------|
| Location | `/mock-emr` | `/smart-app` |
| Port | 3000 | 3001 |
| CQL execution | HAPI `$evaluate` (server-side) | `cql-execution` (browser) |
| ELM required? | No (HAPI compiles CQL) | Yes (`src/elm/*.json`) |
| ValueSets required? | No (HAPI resolves from Library) | Yes (`src/valuesets.js`) |
| Data source | HAPI @ localhost:8080 | HAPI @ localhost:8080 |

Both apps use the same test patients in HAPI — useful for comparing server-side vs client-side CQL behavior.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    HAPI FHIR Server                         │
│                   localhost:8080                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Patients   │  │ Observations│  │  Libraries  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         │ FHIR queries                       │ $evaluate
         ▼                                    ▼
┌─────────────────┐                 ┌─────────────────┐
│   smart-app     │                 │    mock-emr     │
│   (port 3001)   │                 │   (port 3000)   │
│                 │                 │                 │
│  ┌───────────┐  │                 │  CQL runs on    │
│  │cql-exec   │  │                 │  HAPI server    │
│  │(browser)  │  │                 │                 │
│  └───────────┘  │                 │                 │
│  ┌───────────┐  │                 │                 │
│  │ ELM JSON  │  │                 │                 │
│  └───────────┘  │                 │                 │
│  ┌───────────┐  │                 │                 │
│  │ ValueSets │  │                 │                 │
│  └───────────┘  │                 │                 │
└─────────────────┘                 └─────────────────┘
```

### Client-Side CQL Setup (smart-app)

**1. Compile CQL to ELM:**

```bash
cd tools/cql-translator
mvn exec:java -q -Dexec.args="--input ../../input/cql/MyLibrary.cql --output ../../smart-app/src/elm/ --format JSON"
```

The Maven project uses `cql-to-elm-cli` (v3.29.0) from the cqframework. Dependencies are downloaded to `~/.m2/repository/` (not committed to repo).

**2. Download ValueSets from VSAC:**

```bash
cd tools/vsac-download
VSAC_API_KEY=your-key ./download-valuesets.sh
```

Get your API key from: https://uts.nlm.nih.gov/uts/profile

ValueSets are saved to `input/valuesets/` as FHIR ValueSet resources.

**3. Convert ValueSets to cql-execution format:**

```bash
node tools/vsac-download/convert-valuesets.js
```

Generates `smart-app/src/valuesets.js` with:
- All ValueSet codes indexed by OID
- A `codeService` object with `findValueSet(oid, version)` method
- The `hasMatch(code)` method required by cql-execution for retrieve operations

**codeService interface requirement:**

The `cql-execution` library expects `findValueSet()` to return an object with:
- `codes`: array of `{code, system, display}`
- `hasMatch(code)`: function that checks if a code is in the ValueSet

```javascript
// Generated codeService structure
export const codeService = {
  findValueSet: (oid, version) => ({
    oid,
    version,
    codes: [...],
    hasMatch: (code) => {
      // Check if code.code + code.system matches any entry
    },
  }),
};
```

Without `hasMatch()`, CQL retrieves like `[Procedure: "Mammography"]` will fail with "codes.hasMatch is not a function".

### ValueSet OID Maintenance

ValueSet OIDs can change or be retired. If a ValueSet download fails:

1. Check MADiE for the current eCQM OID
2. Search VSAC directly: https://vsac.nlm.nih.gov
3. Update both:
   - `tools/vsac-download/download-valuesets.sh`
   - The CQL valueset declaration

**Example fix (Congenital Absence of Cervix):**

Original OID `2.16.840.1.113883.3.464.1003.198.12.1027` was not found.
Correct OID is `2.16.840.1.113883.3.464.1003.111.12.1016`.

Updated in:
- `download-valuesets.sh` (line 20)
- `CervicalCancerScreening.cql` (valueset declaration)
- Recompiled ELM after CQL change

### SMART on FHIR Launch

The smart-app supports two launch modes:

| Mode | Entry Point | Auth | Patient Context | FHIR Server |
|------|-------------|------|-----------------|-------------|
| **Standalone** | `http://localhost:3001/` | None | Dropdown (test patients) | HAPI via proxy |
| **SMART Launch** | `launch.html` (from EHR) | OAuth2 | From EHR context | EHR's FHIR API |

**Key files:**

- `src/fhir-service.js` — wraps `fhirclient` library, auto-detects launch mode
- `public/launch.html` — SMART launch entry point, initiates OAuth2 flow

**SMART launch flow:**

```
EHR (or SMART Launcher)
    │
    │ redirect with ?iss=...&launch=...
    ▼
launch.html
    │
    │ FHIR.oauth2.authorize() → stores state, redirects to auth server
    ▼
Auth Server (EHR's OAuth2 endpoint)
    │
    │ user authenticates, redirect with ?code=...&state=...
    ▼
index.html (React app)
    │
    │ FHIR.oauth2.ready() → exchanges code for token
    │ fhirService.getPatientFromContext() → gets patient ID
    ▼
App displays CDS for patient
```

**Testing with SMART Launcher (launch.smarthealthit.org):**

1. Go to https://launch.smarthealthit.org
2. Configure:
   - Launch Type: **Provider EHR Launch**
   - FHIR Version: **R4**
   - Patient: Click the picker icon, select any patient
   - App Launch URL: `http://localhost:3001/launch.html`
   - Client Registration tab: **Public**, **Loose** validation
3. Click **Launch**
4. Go through the simulated login (any password works)
5. App should show "SMART Launch" badge and patient from context

**Critical configuration in launch.html:**

```javascript
FHIR.oauth2.authorize({
  clientId: 'uspstf-cds-app',  // REQUIRED: non-empty string
  scope: 'launch openid fhirUser patient/*.read',
  redirectUri: window.location.origin + '/',
});
```

- `clientId` must be non-empty — fhirclient throws "Missing state.clientId" otherwise
- For SMART Launcher testing, any clientId works with "Loose" validation
- For real EHRs (Epic, Cerner), use the clientId from app registration

**Patient selection: Tags vs Eligibility**

| Mode | How guideline is selected |
|------|---------------------------|
| Test patients (HAPI) | By tag: `bcs-test`, `ccs-test`, `tob-test` |
| Real patients (SMART) | By eligibility: age, gender |

The app falls back to eligibility-based selection for patients without test tags:
- Female, 40-74 → Breast Cancer Screening
- (Can extend for other guidelines)

**Profile matching: Server-side vs Client-side**

| Aspect | HAPI `$evaluate` | Client-side `cql-execution` |
|--------|------------------|----------------------------|
| Profile enforcement | Strict — requires `meta.profile` | Lenient — matches by resource type |
| QICore mapping | Must match exactly | Maps QICore types to base FHIR |
| Real-world data | May miss unprofiled data | Finds data regardless of profile |

Client-side execution is more forgiving for real EHR data that may not be QICore-profiled. This is advantageous for point-of-care CDS.

## Target Market and Strategic Context

### Value Proposition

**Enterprise-grade Clinical Decision Support for independent primary care practices.**

Large health systems using Epic or Cerner have built-in CDS (Best Practice Alerts, health maintenance reminders). Independent primary care practices (IPCPs) on lighter-weight EHRs often lack real-time, guideline-driven CDS — they may only have retrospective quality reporting through payer partnerships (NCQA/HEDIS measures).

This project fills that gap: USPSTF guideline-driven recommendations delivered at point of care via SMART on FHIR.

### Target EHRs

| EHR | Market Segment | SMART on FHIR | Notes |
|-----|----------------|---------------|-------|
| **Elation** | IPCPs | ✓ FHIR R4 + SMART | Clinical-first design, strong in family medicine |
| **athenahealth** | Independent/mid-size | ✓ FHIR R4 + SMART | Large marketplace, 100% TEFCA connected |
| **eClinicalWorks** | Independent/mid-size | ✓ FHIR R4 + SMART | Free API access, ONC certified |

All three serve independent practices, support SMART on FHIR, and lack the enterprise CDS that Epic/Cerner customers receive.

### Deployment Pathway

1. **Technical integration** — SMART on FHIR app works with any compliant EHR
2. **App registration** — Register with each EHR's developer program/marketplace
3. **Practice adoption** — Individual practices enable the app

The SMART on FHIR standard means one codebase works across EHRs. The challenge shifts from technical integration to visibility and adoption.

### Adoption Timeline

Evidence-based CDS adoption has been slow despite decades of guideline development. Barriers include:
- Physician culture (guidelines taught but not systematically implemented)
- Alert fatigue from poorly designed CDS
- Workflow disruption from external apps
- Lack of CDS in smaller EHRs

Expected trajectory: **"Gradually, then suddenly."** Regulatory pressure (ONC, CMS quality measures), payer incentives, and generational change in physicians will eventually tip the market. Timeline uncertain — possibly decades.

### Being Ready

Positioning for eventual market acceleration:
- **Technical foundation** — Working SMART on FHIR app with multiple guidelines
- **Open source** — Visible, forkable, builds credibility
- **Documented methodology** — DMN→CQL→FHIR pipeline is citable/publishable
- **Real deployments** — Even one or two pilots prove it works in practice

### Remaining Challenges

| Challenge | Nature | Status |
|-----------|--------|--------|
| Clinical validation | Has the logic been validated against real cases? | Needed |
| Regulatory clarity | FDA CDS guidance — likely qualifies for enforcement discretion | Needs confirmation |
| Liability framework | Who's responsible for wrong recommendations? | Open source disclaimers help; framing matters |
| Physician adoption | Cultural, not technical | The hardest problem |

### Publication Strategy

**Paper angles:**

1. **Methodology** — "A Reproducible Pipeline from USPSTF Guidelines to SMART on FHIR CDS Using DMN and CQL"
2. **Implementation** — "USPSTF Grade A Guidelines as a SMART on FHIR Application for Independent Primary Care"
3. **Gap analysis** — "Enterprise CDS for Practices Without Enterprise EHRs"

**Target journals:**

| Journal | Fit | Notes |
|---------|-----|-------|
| JAMIA | High | Premier informatics journal; methodology + implementation |
| Applied Clinical Informatics | High | Practical focus, CDS implementations welcome |
| JMIR Medical Informatics | Good | Open access, faster review, good visibility |
| BMC Medical Informatics | Good | Open access, broad readership |
| AMIA Annual Symposium | Good | Conference paper, peer-reviewed, establishes priority |

**Recommended approach:** Submit to AMIA Annual Symposium first (shorter format, establishes priority), then expand to a full JAMIA paper with implementation details and evaluation.

## Notes

- `mammo.bpmn` exists but is not actively used — BPMN adds unnecessary complexity for stateless decision evaluation
- The custom DMN evaluator (`src/dmn-runner.js`) is scaffolding for the POC; production execution will use CQL
- DMN files live in `input/dmn/` to parallel `input/cql/` organization
