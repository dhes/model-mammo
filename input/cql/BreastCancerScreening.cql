library BreastCancerScreening version '0.0.3'

// Breast Cancer Screening
// USPSTF Grade B Recommendation
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// Population: Women aged 40-74 years
// Recommendation: Biennial screening mammography
//
// Exclusions:
// - History of bilateral mastectomy
// - Breast cancer diagnosis (managed, not screened)

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

valueset "Mammography": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1018'
valueset "History of bilateral mastectomy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1068'
valueset "Breast Cancer ICD-10": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1116.185'
valueset "Breast Cancer SNOMED": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.1444.3.102'

context Patient

define PatientName:
  Patient.name[0].given[0] + ' ' + Patient.name[0].family

define PatientId:
  Patient.id

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

// Get all qualifying mammograms, sorted by date
// Using FHIR Observation instead of ObservationClinicalResult
define QualifyingMammograms:
  [Observation: "Mammography"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentMammogram:
  Last(
    QualifyingMammograms Mammogram
      sort by FHIRHelpers.ToDateTime(effective as dateTime)
  )

define DateOfMostRecentMammogram:
  FHIRHelpers.ToDateTime(MostRecentMammogram.effective as dateTime)

define MammogramInLastTwoYears:
  Coalesce(DateOfMostRecentMammogram after (Today() - 2 years), false)

// Check for history of bilateral mastectomy (no breast tissue to screen)
// Using FHIR Condition instead of ConditionProblemsHealthConcerns
define HasBilateralMastectomy:
  exists (
    [Condition: "History of bilateral mastectomy"] C
      where C.clinicalStatus.coding[0].code = 'active'
        or C.clinicalStatus is null
  )

define HasBreastCancerDiagnosis:
  exists (
    [Condition: "Breast Cancer ICD-10"] C
      where C.clinicalStatus.coding[0].code = 'active'
        or C.clinicalStatus is null
  )
  or
  exists (
    [Condition: "Breast Cancer SNOMED"] C
      where C.clinicalStatus.coding[0].code = 'active'
        or C.clinicalStatus is null
  )

define RecommendMammogram:
  if AgeInYears in Interval[40, 74]
    and Gender = 'female'
    and MammogramInLastTwoYears = false
    and HasBilateralMastectomy = false
    and HasBreastCancerDiagnosis = false
  then true
  else false
