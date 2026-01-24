library HIVScreeningAge version '0.0.2'

// HIV Screening (Age-Based)
// USPSTF Grade A Recommendation
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// Population:
// - Ages 15-65: Universal screening (screen all, once)
// - Ages <15 or >65: Screen if risk factors present
//
// Risk factors include:
// - Injection drug use
// - Men who have sex with men (MSM)
// - Multiple sexual partners
// - Exchange of sex for money/drugs
// - STI diagnosis
// - Partner with HIV or unknown status
//
// Frequency: USPSTF states "insufficient evidence to determine optimal
// screening interval." This model checks for any prior HIV test.
//
// Note: Pregnant persons are covered by HIVScreeningPregnancy, not this model.
//
// Source: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/human-immunodeficiency-virus-hiv-infection-screening

using FHIR version '4.0.1'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'

// HIV test codes
code "HIV 1+2 Ab": '75622-1' from "LOINC" display 'HIV 1 and 2 tests - Meaningful Use set'
code "HIV 1+2 Ag+Ab": '56888-1' from "LOINC" display 'HIV 1+2 Ab+HIV1 p24 Ag [Presence] in Serum or Plasma by Immunoassay'
code "HIV 1 Ab Rapid": '68961-2' from "LOINC" display 'HIV 1 Ab [Presence] in Serum, Plasma or Blood by Rapid immunoassay'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

// ============================================================================
// Age Categories
// ============================================================================

define IsUniversalScreeningAge:
  AgeInYears >= 15 and AgeInYears <= 65

define IsUnderScreeningAge:
  AgeInYears < 15

define IsOverScreeningAge:
  AgeInYears > 65

// ============================================================================
// HIV Test History
// ============================================================================

define HIVTests:
  ([Observation: "HIV 1+2 Ab"]
    union [Observation: "HIV 1+2 Ag+Ab"]
    union [Observation: "HIV 1 Ab Rapid"]) Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define HasHIVTest:
  exists(HIVTests)

// ============================================================================
// Risk Assessment
// ============================================================================

// Risk factors per USPSTF - simplified to flag
// In production, would check for:
// - STI conditions in history
// - Injection drug use (substance use condition)
// - High-risk sexual behavior documentation

define HasHIVRiskFactors:
  false  // Simplified: assume no risk factors

// ============================================================================
// Screening Recommendation Logic
// ============================================================================

// Ages 15-65: Universal screening (once)
define UniversalScreeningNeeded:
  IsUniversalScreeningAge and not HasHIVTest

// Ages <15 with risk factors: Screen
define YoungWithRiskNeeded:
  IsUnderScreeningAge and HasHIVRiskFactors and not HasHIVTest

// Ages >65 with risk factors: Screen
define OlderWithRiskNeeded:
  IsOverScreeningAge and HasHIVRiskFactors and not HasHIVTest

// ============================================================================
// Main Output
// ============================================================================

define RecommendHIVTesting:
  UniversalScreeningNeeded
    or YoungWithRiskNeeded
    or OlderWithRiskNeeded

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when UniversalScreeningNeeded then 'Order HIV screening test (recommended for ages 15-65)'
    when YoungWithRiskNeeded then 'Order HIV screening test (risk factors present)'
    when OlderWithRiskNeeded then 'Order HIV screening test (risk factors present)'
    else null
  end

define ExclusionReason:
  case
    when HasHIVTest then 'HIV test already performed'
    when IsUnderScreeningAge and not HasHIVRiskFactors then 'Under 15 without risk factors'
    when IsOverScreeningAge and not HasHIVRiskFactors then 'Over 65 without risk factors'
    else null
  end
