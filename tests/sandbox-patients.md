# Known Sandbox Patients

This file catalogs patients from public FHIR sandboxes used for exploratory and regression testing. Unlike HAPI test cases (which we control), these patients exist in external systems with real-world-like data.

## Purpose

1. **Regression checks** — Verify expected behavior persists across app changes
2. **Real-world validation** — Confirm ValueSets match actual coded data
3. **Edge case discovery** — Document interesting data patterns found in the wild

## How to Use

1. Launch the smart-app against the sandbox using Standalone SMART Launch
2. Navigate to: `http://localhost:3001/launch.html?iss=<FHIR Base URL>`
3. Select the patient from the picker
4. Verify the results match expected behavior

---

## SMART Health IT Launcher

**FHIR Base URL:** `http://launch.smarthealthit.org/v/r4/sim/WzIsIiIsIiIsIkFVVE8iLDAsMCwwLCIiLCIiLCIiLCIiLCIiLCIiLCIiLDAsMSwiIl0/fhir`

### Jesus Smitham
| Field | Value |
|-------|-------|
| Patient ID | `618b2992-eec7-45c9-8544-12c9f586b78c` |
| Gender | Male |
| Birth Date | 1953-01-10 |
| Age (as of 2026) | 73 years |

**Relevant Clinical Data:**
- Colonoscopy: 2018-01-08 (SNOMED `73761001`)

**Expected CDS Results:**

| Guideline | Expected | Reason |
|-----------|----------|--------|
| Colorectal Cancer Screening | NOT due | Colonoscopy within 10 years |
| Tobacco Screening | Fires | Adult 18+ |
| Breast Cancer Screening | N/A | Male patient |
| Cervical Cancer Screening | N/A | Male patient |

**Last Verified:** 2026-01-12

---

## Adding New Patients

When you find an interesting patient in a sandbox:

1. Note the sandbox FHIR Base URL
2. Record patient ID, demographics, and relevant clinical data
3. Document expected CDS results and reasoning
4. Add the verification date

### Template

```markdown
### [Patient Name]
| Field | Value |
|-------|-------|
| Patient ID | `xxx` |
| Gender | xxx |
| Birth Date | xxx |
| Age (as of 20xx) | xx years |

**Relevant Clinical Data:**
- [Procedure/Observation]: [Date] ([Code System] `code`)

**Expected CDS Results:**

| Guideline | Expected | Reason |
|-----------|----------|--------|
| Guideline Name | Due/NOT due | Explanation |

**Last Verified:** YYYY-MM-DD
```

---

## Future Sandboxes

Placeholders for when we test against other EHR sandboxes:

### Epic Sandbox
*Not yet tested*

### Athenahealth Sandbox
*Not yet tested*

### Elation Sandbox
*Not yet tested*

### eClinicalWorks Sandbox
*Not yet tested*
