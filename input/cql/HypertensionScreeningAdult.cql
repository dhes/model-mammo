library HypertensionScreeningAdult version '0.0.2'

// Hypertension Screening in Adults
// USPSTF Grade A Recommendation
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// Population: Adults 18 years or older
// Recommendation: Screen with office blood pressure measurement (OBPM)
//
// Screening Intervals:
// - Adults 40+ years: Annual screening
// - Adults 18-39 at increased risk: Annual screening
// - Adults 18-39 low-risk with prior normal: Every 3-5 years (using 4 years)
//
// Risk factors for "increased risk" (USPSTF):
// - Black persons
// - High-normal blood pressure (120-129/<80)
// - Overweight or obese
//
// Scope: Screening only (should we measure BP?). Follow-up actions based on
// BP readings are covered in separate management protocols per CMS22.
//
// Source: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/hypertension-in-adults-screening

using FHIR version '4.0.1'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'

// Blood pressure panel and component codes
code "Blood Pressure Panel": '85354-9' from "LOINC" display 'Blood pressure panel with all children optional'
code "Systolic BP": '8480-6' from "LOINC" display 'Systolic blood pressure'
code "Diastolic BP": '8462-4' from "LOINC" display 'Diastolic blood pressure'

// Hypertension diagnosis codes
valueset "Hypertension": 'http://example.org/fhir/ValueSet/hypertension'

// Condition clinical status
codesystem "ConditionClinicalStatusCodes": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
code "Active": 'active' from "ConditionClinicalStatusCodes" display 'Active'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

// ============================================================================
// Hypertension Diagnosis (Exclusion)
// ============================================================================

// Patients with existing hypertension diagnosis are excluded from screening
// They are managed under treatment protocols, not screening
define HypertensionConditions:
  [Condition: "Hypertension"] C
    where C.clinicalStatus ~ "Active"
      or C.clinicalStatus is null

define DiagnosisOfHypertension:
  exists(HypertensionConditions)

// ============================================================================
// Blood Pressure Observations
// ============================================================================

// Office blood pressure measurements
// Using BP panel code - in production would also check component codes
define BloodPressureObservations:
  [Observation: "Blood Pressure Panel"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

// Also check for systolic BP observations (common alternative coding)
define SystolicBPObservations:
  [Observation: "Systolic BP"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

// Combined BP observations
define AllBPObservations:
  BloodPressureObservations union SystolicBPObservations

// BP within last year (for annual screening populations)
define BPObservationsLastYear:
  AllBPObservations Obs
    where (Obs.effective as dateTime) >= Today() - 1 year

define OBPMBInTheLastYear:
  exists(BPObservationsLastYear)

// BP within last 4 years (for low-risk 18-39 population)
define BPObservationsLast4Years:
  AllBPObservations Obs
    where (Obs.effective as dateTime) >= Today() - 4 years

define OBPMBInTheLast4Years:
  exists(BPObservationsLast4Years)

// ============================================================================
// Risk Assessment
// ============================================================================

// "At increased risk" per USPSTF includes:
// - Black persons
// - High-normal blood pressure (120-129/<80)
// - Overweight or obese
//
// For this POC, we simplify to a flag. In production, this would be derived from:
// - Patient race/ethnicity extension
// - Prior BP readings showing high-normal
// - BMI observations showing overweight/obese

define AtIncreasedRisk:
  false  // Simplified: assume not at increased risk unless documented

// ============================================================================
// Age Categories
// ============================================================================

define IsAdult:
  AgeInYears >= 18

define IsAge40Plus:
  AgeInYears >= 40

define IsAge18To39:
  AgeInYears >= 18 and AgeInYears <= 39

// ============================================================================
// Screening Recommendation Logic
// ============================================================================

// Excluded: Has hypertension diagnosis (managed, not screened)
define ExcludedHypertensionDiagnosis:
  DiagnosisOfHypertension

// Excluded: Under 18 (pediatric guidelines apply)
define ExcludedUnder18:
  AgeInYears < 18

// Age 40+: Annual screening
define NeedsAnnualScreening40Plus:
  IsAge40Plus and not DiagnosisOfHypertension and not OBPMBInTheLastYear

// Age 18-39 at increased risk: Annual screening
define NeedsAnnualScreeningAtRisk:
  IsAge18To39 and AtIncreasedRisk and not DiagnosisOfHypertension and not OBPMBInTheLastYear

// Age 18-39 low-risk: Every 3-5 years (using 4 years)
define NeedsScreeningLowRisk:
  IsAge18To39 and not AtIncreasedRisk and not DiagnosisOfHypertension and not OBPMBInTheLast4Years

// ============================================================================
// Main Output
// ============================================================================

define OfficeBloodPressureMeasurement:
  case
    when ExcludedHypertensionDiagnosis then false
    when ExcludedUnder18 then false
    when NeedsAnnualScreening40Plus then true
    when NeedsAnnualScreeningAtRisk then true
    when NeedsScreeningLowRisk then true
    else false
  end

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when NeedsAnnualScreening40Plus then 'Measure blood pressure (annual screening for adults 40+)'
    when NeedsAnnualScreeningAtRisk then 'Measure blood pressure (annual screening - increased risk)'
    when NeedsScreeningLowRisk then 'Measure blood pressure (screening due - no BP in 4 years)'
    else null
  end

define ExclusionReason:
  case
    when DiagnosisOfHypertension then 'Patient has hypertension diagnosis - managed under treatment protocol'
    when AgeInYears < 18 then 'Patient is under 18 years old'
    when IsAge40Plus and OBPMBInTheLastYear then 'BP measured within last year'
    when IsAge18To39 and AtIncreasedRisk and OBPMBInTheLastYear then 'BP measured within last year (at-risk)'
    when IsAge18To39 and not AtIncreasedRisk and OBPMBInTheLast4Years then 'BP measured within last 4 years (low-risk)'
    else null
  end
