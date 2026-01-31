# Smart-App Smoke Test Results

Smoke testing performed 2026-01-30 against the SMART Health IT R4 sandbox (`https://r4.smarthealthit.org`) via the SMART Launcher at `launch.smarthealthit.org`. All tests launched the deployed smart-app at `https://enhanced.hopena.info/launch.html`.

## Summary

All 13 USPSTF guidelines tested with client/server parity — client-side JavaScript `cql-execution` and server-side HAPI `$evaluate` produce identical results for every patient/guideline combination.

## Test Patients

| Patient | Source | Gender | Age | Key Characteristics |
|---------|--------|--------|-----|---------------------|
| Tamiko Leffler | Synthea (existing) | Female | 61 | Adult female in multiple screening age ranges |
| Carla Echevarria | Synthea (existing) | Female | 20 | Young female in folic acid range (15-45) |
| Baby TestNewborn | Custom (uploaded) | Male | 28 days | Boundary test: exactly 28 days old |
| Baby TestNotNewborn | Custom (uploaded) | Female | 29 days | Boundary test: 1 day past neonatal period |
| Maria TestPregnant | Custom (uploaded) | Female | 28 | Active pregnancy Condition (SNOMED 77386006) |

Synthea patients are persistent on the sandbox. Custom patients are ephemeral (wiped on sandbox reset).

## Results by Guideline

| # | Guideline | Prefix | Patient(s) | Result | Client/Server Match |
|---|-----------|--------|------------|--------|---------------------|
| 1 | Breast Cancer Screening | bcs | Tamiko (61F) | Recommend mammogram | Yes |
| 2 | Cervical Cancer Screening | ccs | Tamiko (61F), Maria (28F) | Screening due | Yes |
| 3 | Tobacco Cessation | tob | Tamiko, Carla, Maria | Varies by patient data | Yes |
| 4 | Colorectal Cancer Screening | crc | Tamiko (61F) | Screening due | Yes |
| 5 | Folic Acid Supplementation | fol | Carla (20F), Maria (28F) | Take 400mcg daily | Yes |
| 6 | Ophthalmia Neonatorum Prophylaxis | onp | Baby TestNewborn (28d) | Administer erythromycin | Yes |
| 7 | Hypertension Screening | htn | Tamiko, Carla, Maria | Measure BP | Yes |
| 8 | HIV Screening (Age-Based) | hiv | Tamiko, Carla, Maria | Order HIV screening | Yes |
| 9 | HIV Pre-Exposure Prophylaxis | prp | Tamiko, Carla, Maria | Not indicated | Yes |
| 10 | Syphilis Screening | syp | Tamiko, Carla, Maria | Varies by pregnancy | Yes |
| 11 | Hepatitis B Screening (Pregnancy) | hbv | Maria (28F, pregnant) | Order HBsAg screening | Yes |
| 12 | Rh(D) Incompatibility Screening | rhd | Maria (28F, pregnant) | Order Rh(D) typing + antibody screen | Yes |
| 13 | HIV Screening (Pregnancy) | hvp | Maria (28F, pregnant) | Order HIV screening (first visit) | Yes |

## Boundary Test: Ophthalmia Neonatorum (28 vs 29 days)

| Patient | Age in Days | IsNewborn | Recommendation | Correct? |
|---------|-------------|-----------|----------------|----------|
| Baby TestNewborn | 28 | true | Administer prophylaxis | Yes |
| Baby TestNotNewborn | 29 | false | No prophylaxis needed | Yes |

## Pregnancy Detection Enhancement

During smoke testing, the smart-app's `getApplicableGuidelines` function was enhanced to detect pregnancy from the patient bundle (active Condition with SNOMED 77386006). Previously, pregnancy guidelines were only available via test lifecycle tags. This change enables pregnancy guidelines to fire for real EHR patients.

## Performance

| Patient | Client (ms) | Server (ms) | Guidelines Evaluated |
|---------|-------------|-------------|---------------------|
| Tamiko (first run) | 468 | >6,000 | 8 |
| Tamiko (second run) | 468 | ~600 | 8 |
| Carla | 331 | 1,392 | 6 |
| Baby TestNewborn | 74 | 734 | 1 |
| Baby TestNotNewborn | 74 | 133 | 1 |
| Maria | 468 | 2,582 | 10 |

Server-side performance improves with repetition as HAPI caches compiled ELM and execution plans.

## HAPI DateTimeType Workaround

Six CQL libraries required `FHIRHelpers.ToDateTime()` wrapping around `as dateTime` expressions to work around a bug in HAPI v8.6.0's Kotlin evaluation engine. The bug affects sort and comparison operations on DateTimeType objects deserialized from Bundle parameters. All workarounds were validated during this smoke test. See CLAUDE.md for full details.

Affected libraries: TobaccoScreening, BreastCancerScreening, CervicalCancerScreening, ColorectalCancerScreening, HypertensionScreeningAdult, HIVPreexposureProphylaxis.

## SmartHealthIT Sandbox Patient IDs

For reproducing these tests (custom patients are ephemeral):

| Patient | ID |
|---------|----|
| Tamiko Leffler | `8364ff74-d904-442b-b984-f9d640531639` |
| Carla Echevarria | `d8e20eac-1721-4a71-ba98-c23d32e75105` |
| Baby TestNewborn | `onp-boundary-28-days` |
| Baby TestNotNewborn | `onp-boundary-29-days` |
| Maria TestPregnant | `test-pregnant-28yo` |
