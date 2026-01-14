library HepatitisBScreeningPregnancy version '0.0.1'

// Hepatitis B Virus Infection in Pregnant Persons: Screening
// USPSTF Grade A Recommendation (July 2019)
//
// Population: All pregnant persons
// Recommendation: Screen for hepatitis B virus (HBV) infection at first prenatal visit
// Test: HBsAg (Hepatitis B surface antigen) - sensitivity and specificity both >98%
//
// Key points:
// - Screen at first prenatal visit for each pregnancy
// - Screen even if previously vaccinated or tested negative
// - Universal screening is standard practice (26 states mandate by law)
// - Positive result requires HBV DNA viral load testing and specialty care referral
// - Infants of positive mothers receive vaccination + HBIG within 12 hours of birth
//
// This is a persistent reminder pattern: the alert fires until HBsAg screening is documented.

using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// Hepatitis B surface antigen tests
valueset "HBsAg Tests": 'http://example.org/fhir/ValueSet/hbsag-tests'

// Pregnancy condition code
code "Pregnancy": '77386006' from "SNOMED" display 'Pregnancy (finding)'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

define IsFemale:
  Gender = 'female'

// ============================================================================
// Pregnancy Status
// ============================================================================

// For this POC, pregnancy is determined by a flag input.
// In production, this would be derived from:
// - Active pregnancy conditions
// - Recent pregnancy-related encounters
// - Gestational age observations
//
// For test cases, we simulate pregnancy via the IsCurrentlyPregnant flag
// being derived from the existence of a pregnancy condition.

// Check for pregnancy condition
// Simplified: any pregnancy condition present indicates current pregnancy
// In production, would filter by clinicalStatus = active
define PregnancyConditions:
  [ConditionProblemsHealthConcerns: "Pregnancy"]

define IsCurrentlyPregnant:
  exists(PregnancyConditions)

// ============================================================================
// HBsAg Screening Status
// ============================================================================

// Check for documented HBsAg test results in this pregnancy
// In production, would filter to tests performed during current pregnancy
define HBsAgTests:
  [LaboratoryResultObservation: "HBsAg Tests"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define HBsAgScreeningPerformed:
  exists(HBsAgTests)

// ============================================================================
// Recommendation
// ============================================================================

// Recommend HBsAg screening for pregnant persons who haven't been screened
define PerformHBsAgScreening:
  IsCurrentlyPregnant and not HBsAgScreeningPerformed

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when PerformHBsAgScreening then 'Order HBsAg screening test (Hepatitis B surface antigen)'
    when not IsCurrentlyPregnant then null
    else null
  end

define ExclusionReason:
  case
    when not IsFemale then 'Male patient'
    when not IsCurrentlyPregnant then 'Patient is not currently pregnant'
    when HBsAgScreeningPerformed then 'HBsAg screening already performed this pregnancy'
    else null
  end
