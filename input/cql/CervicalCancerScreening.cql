library CervicalCancerScreening version '1.0.2'

// Cervical Cancer Screening
// Implements USPSTF Grade A Recommendations:
// - Ages 21-29: Cervical cytology alone every 3 years
// - Ages 30-65: Cytology every 3 years, OR hrHPV every 5 years, OR cotesting every 5 years
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// Exclusions:
// - Women with hysterectomy with removal of cervix
// - Congenital or acquired absence of cervix

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

// Valuesets from CMS124 (Cervical Cancer Screening eCQM)
valueset "Pap Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1017'
valueset "HPV Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.110.12.1059'
valueset "Hysterectomy with No Residual Cervix": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1014'
valueset "Congenital or Acquired Absence of Cervix": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1016'

context Patient

define PatientName:
  Patient.name[0].given[0] + ' ' + Patient.name[0].family

define PatientId:
  Patient.id

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

// ============================================================================
// Cervical Cytology (Pap Test)
// ============================================================================

// Using FHIR Observation instead of LaboratoryResultObservation
define QualifyingCervicalCytology:
  [Observation: "Pap Test"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentCervicalCytology:
  Last(
    QualifyingCervicalCytology Obs
      sort by FHIRHelpers.ToDateTime(effective as dateTime)
  )

define DateOfMostRecentCervicalCytology:
  FHIRHelpers.ToDateTime(MostRecentCervicalCytology.effective as dateTime)

define HasCervicalCytologyInLastThreeYears:
  Coalesce(DateOfMostRecentCervicalCytology after (Today() - 3 years), false)

// ============================================================================
// High-Risk HPV Testing
// ============================================================================

define QualifyingHPVTests:
  [Observation: "HPV Test"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentHPVTest:
  Last(
    QualifyingHPVTests Obs
      sort by FHIRHelpers.ToDateTime(effective as dateTime)
  )

define DateOfMostRecentHPVTest:
  FHIRHelpers.ToDateTime(MostRecentHPVTest.effective as dateTime)

define HasHrHPVInLastFiveYears:
  Coalesce(DateOfMostRecentHPVTest after (Today() - 5 years), false)

// ============================================================================
// Absence of Cervix (Exclusion)
// ============================================================================

// Hysterectomy with no residual cervix (procedure)
define HysterectomyProcedure:
  exists (
    [Procedure: "Hysterectomy with No Residual Cervix"] P
      where P.status = 'completed'
  )

// Congenital or acquired absence of cervix (condition)
// Using FHIR Condition instead of ConditionProblemsHealthConcerns
define AbsenceOfCervixCondition:
  exists (
    [Condition: "Congenital or Acquired Absence of Cervix"] C
      where C.clinicalStatus.coding[0].code = 'active'
        or C.clinicalStatus is null
  )

define HasAbsenceOfCervix:
  HysterectomyProcedure or AbsenceOfCervixCondition

// ============================================================================
// Eligibility Checks
// ============================================================================

define IsFemale:
  Gender = 'female'

define IsInAgeRange21To29:
  AgeInYears in Interval[21, 29]

define IsInAgeRange30To65:
  AgeInYears in Interval[30, 65]

define IsEligibleForScreening:
  IsFemale
    and (IsInAgeRange21To29 or IsInAgeRange30To65)
    and not HasAbsenceOfCervix

// ============================================================================
// Screening Due Outputs
// ============================================================================

// Ages 21-29: Cytology only
define CervicalCytologyDueForYoungerWomen:
  IsInAgeRange21To29
    and IsFemale
    and not HasAbsenceOfCervix
    and not HasCervicalCytologyInLastThreeYears

// Ages 30-65: Cytology is one of three options
// Due if no recent cytology AND no recent hrHPV (neither option satisfied)
define CervicalCytologyDueForOlderWomen:
  IsInAgeRange30To65
    and IsFemale
    and not HasAbsenceOfCervix
    and not HasCervicalCytologyInLastThreeYears
    and not HasHrHPVInLastFiveYears

// OUTPUT 1: CervicalCytologyDue
// True if cervical cytology (Pap test) is due
define CervicalCytologyDue:
  CervicalCytologyDueForYoungerWomen or CervicalCytologyDueForOlderWomen

// OUTPUT 2: hrHPVDue
// True if high-risk HPV testing is due (ages 30-65 only)
// Due if no recent cytology AND no recent hrHPV
define hrHPVDue:
  IsInAgeRange30To65
    and IsFemale
    and not HasAbsenceOfCervix
    and not HasCervicalCytologyInLastThreeYears
    and not HasHrHPVInLastFiveYears

// ============================================================================
// CDS Alert Output
// ============================================================================

// OUTPUT 3: CervicalScreeningDue
// Single boolean for CDS alert - true if ANY screening is due
// Tooltip should explain: "Cytology every 3 years, hrHPV every 5 years, or cotesting every 5 years"
define CervicalScreeningDue:
  CervicalCytologyDue or hrHPVDue

// ============================================================================
// Rationale / Detail Outputs (for UI display)
// ============================================================================

define ScreeningInterval:
  case
    when IsInAgeRange21To29 then 'Cytology every 3 years'
    when IsInAgeRange30To65 then 'Cytology every 3 years, hrHPV every 5 years, or cotesting every 5 years'
    else null
  end

define ExclusionReason:
  case
    when HasAbsenceOfCervix then 'Absence of cervix (hysterectomy or congenital)'
    when not IsFemale then 'Not applicable (male)'
    when AgeInYears < 21 then 'Under 21 years'
    when AgeInYears > 65 then 'Over 65 years'
    else null
  end
