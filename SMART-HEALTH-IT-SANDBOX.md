# SMART Health IT Sandbox Analysis

Analysis performed 2026-01-28. This documents the public R4 FHIR sandbox at `https://r4.smarthealthit.org` for future reference when planning test strategies.

## Server Details

| Aspect | Details |
|--------|---------|
| FHIR Base URL | `https://r4.smarthealthit.org` |
| Server Software | Smile CDR (2019.08.PRE) |
| FHIR Version | 4.0.0 (R4) |
| Auth | None required (open server) |
| Write Access | Yes — PUT and POST accepted |
| SMART Launcher | [launch.smarthealthit.org](https://launch.smarthealthit.org) |

Other endpoints: R3 at `https://r3.smarthealthit.org`, R2 at `https://r2.smarthealthit.org`.

## Patient Population (676 total, as of 2026-01-28)

### Sources

| Source | Count | Tag | ID Pattern | Persistent? |
|--------|-------|-----|------------|-------------|
| Synthea v2.4.0 | 627 | `synthea-5-2019` | UUID (e.g., `06895d41-...`) | Yes |
| Other developers | ~49 | none | `patient-dcw-*`, `cmuh-patient-*`, numeric IDs | No (re-uploaded daily) |

The Synthea patients were first loaded in **June 2019** and have survived multiple server maintenance events (re-loads observed in April 2021, November 2023). The same person seeds and population seed are used consistently.

### Data Reset Behavior

**The sandbox resets regularly, likely daily.** Evidence:

- Custom patients we uploaded were deleted within ~48 hours
- All non-Synthea patients observed had `lastUpdated` timestamps from the current day
- Other developers (the `patient-dcw-*` group using TV character names, the `cmuh-patient-*` group with Chinese names) clearly re-upload their data after each reset, suggesting this is a known behavior
- Synthea-tagged patients survive resets; user-uploaded data does not

**Implication:** The sandbox is not suitable for persistent custom test data. Use it for:
- Testing against the stable Synthea population
- Quick smoke tests with ephemeral uploaded data
- Re-upload scripts that run before each test session

## USCDI Compliance of Synthea Patients

All 627 Synthea patients have **100% coverage** on USCDI v1 demographic elements:

| USCDI Element | Present | Implementation |
|---------------|---------|----------------|
| Name | Yes | `.name` with `use: official`, prefix |
| Gender | Yes | `.gender` (FHIR code) |
| Date of Birth | Yes | `.birthDate` |
| Race | Yes | `us-core-race` extension (OMB category + text) |
| Ethnicity | Yes | `us-core-ethnicity` extension (OMB category + text) |
| Birth Sex | Yes | `us-core-birthsex` extension |
| Address | Yes | Full address with geolocation extension (lat/lon) |
| Phone | Yes | `.telecom` (home phone) |
| Language | Yes | `.communication` (en-US, es, ru-RU observed) |
| MRN | Yes | `.identifier` typed `MR`, system `http://hospital.smarthealthit.org` |
| SSN | Yes | `.identifier` typed `SS` |

Additional fields present: Driver's License, Passport Number, marital status, mother's maiden name, birth place, disability-adjusted life years (DALY), quality-adjusted life years (QALY).

Non-Synthea patients are minimal — typically just name, gender, and birthDate with no extensions.

## Clinical Data Inventory

### Aggregate Counts

| Resource Type | Total Count | Notes |
|---------------|-------------|-------|
| Observations (vital-signs) | 30,512 | BP, weight, height, BMI, pain |
| Observations (laboratory) | 67,250 | Metabolic panels, lipids, CBCs |
| Observations (survey) | ~6,000 | Tobacco status, PHQ-9 |
| Procedures | 15,116 | Mostly medication documentation, some clinical |
| Conditions | 4,725 | Active and resolved |
| Encounters | — | Checkups, ER visits, symptom encounters |
| MedicationRequests | — | Present per patient |

### Relevance to Our 13 USPSTF Guidelines

| Data Type | LOINC/SNOMED | Count | Guideline | Usefulness |
|-----------|-------------|-------|-----------|------------|
| Tobacco status | 72166-2 | 5,923 | Tobacco Cessation | **Strong** — values include Never/Former/Current |
| BP panels | 8480-6 (component) | 6,267 | Hypertension Screening | **Strong** — systolic + diastolic components |
| Body weight | 29463-7 | 5,939 | PrEP (weight ≥35kg check) | **Strong** |
| BMI | 39156-5 | 5,469 | Various | **Strong** |
| Colonoscopy | 73761001 | 405 | Colorectal Cancer Screening | **Good** — but all ≥5 years old |
| Mammography | 71651007, 77343006 | 0 | Breast Cancer Screening | **None** |
| Pap test | 10524-7 | 0 | Cervical Cancer Screening | **None** |
| HPV test | 21440-3 | 0 | Cervical Cancer Screening | **None** |
| HIV test | 75622-1 | 0 | HIV Screening | **None** |
| FOBT/FIT | 29771-3 | 0 | Colorectal Cancer Screening | **None** |
| Pregnancy conditions | 77386006 | 0 | HIV-Preg, Rh(D), Syphilis-Preg | **None** |

### Frozen Dates — Critical Limitation

All clinical data dates are frozen at the time of the Synthea generation run. The most recent clinical date across the entire dataset is **2021-03-31**.

This means:
- Tobacco screenings are ~5 years old → past any recency window
- Blood pressure readings are ~5 years old → past annual/4-year intervals
- Colonoscopies are 5-15 years old → past the 10-year interval
- Every Synthea patient with prior screening data will appear **overdue**

**Practical impact:** Synthea patients are useful for testing "needs screening" recommendation pathways (which is valid), but cannot test "already screened / not due" pathways. For "already screened" testing, we need to upload our own clinical data with recent dates.

## Testing Approaches

### Using Existing Synthea Patients

Launch our smart-app against the sandbox to test demographic eligibility filtering:

```
https://enhanced.hopena.info/launch-patient.html?iss=https://r4.smarthealthit.org
```

Good Synthea candidates for our guidelines:

| Guideline | Patient Selection Criteria | Expected Result |
|-----------|---------------------------|-----------------|
| Breast Cancer Screening | Female, age 40-74, alive | Recommend (no mammogram data) |
| Tobacco Cessation | Any adult 18+ | Varies by tobacco status (data exists) |
| Hypertension Screening | Any adult 18+ | Recommend (BP data is stale) |
| Colorectal Cancer | Age 46-75 | Recommend (colonoscopy data is stale) |

### Uploading Custom Test Patients

Custom patients will be wiped on the next reset. Two strategies:

1. **Ephemeral testing** — Upload, test, accept the data will be gone tomorrow
2. **Re-upload script** — Automate re-upload before each test session (like other sandbox users do)

### ThunderClient Collection

A ThunderClient collection for exploring the sandbox is at:
`thunder-tests/collections/tc_col_smarthealthit-sandbox.json`

Organized into folders: Server Info, Patients, Our Test Patients, Clinical Data, Write Operations.

## Representative Synthea Patient: Tamiko Leffler

A useful reference patient for manual testing:

| Field | Value |
|-------|-------|
| ID | `8364ff74-d904-442b-b984-f9d640531639` |
| Name | Tamiko Leffler |
| Gender | Female |
| Birth Date | 1964-06-22 (age ~61) |
| Status | Alive |
| Observations | 174 (119 lab, 46 vital-signs, 9 survey) |
| Conditions | 7 (osteoarthritis, prediabetes, obesity, resolved infections) |
| Procedures | 8 (medication documentation, wound suture, throat culture) |
| Tobacco Status | Never smoker (9 observations) |
| Most Recent Data | 2021-01-25 |

Tamiko is a good candidate because she's a living female in the screening age range for breast cancer (40-74), cervical cancer (21-65), colorectal cancer (46-75), and several other guidelines.
