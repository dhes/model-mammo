library HIVScreeningPregnancy version '0.0.2'

// HIV Screening in Pregnant Persons
// USPSTF Grade A Recommendation
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// "Recommends screening for HIV infection in all pregnant persons, including
// those who present in labor or at delivery whose HIV status is unknown."
//
// Third-Trimester Repeat:
// "Third-trimester repeat screening is recommended for pregnant persons in
// areas with elevated HIV incidence and for those with risk factors."
//
// This model evaluates at each pregnancy encounter:
// - First prenatal visit: Universal screening
// - Third trimester (>=29 weeks) with risk factors: Repeat screening
//
// Source: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/human-immunodeficiency-virus-hiv-infection-screening

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// HIV test codes
code "HIV 1+2 Ab": '75622-1' from "LOINC" display 'HIV 1 and 2 tests - Meaningful Use set'
code "HIV 1+2 Ag+Ab": '56888-1' from "LOINC" display 'HIV 1+2 Ab+HIV1 p24 Ag [Presence] in Serum or Plasma by Immunoassay'

// Pregnancy and HIV status codes
code "Pregnancy": '77386006' from "SNOMED" display 'Pregnancy (finding)'
code "HIV Positive": '86406008' from "SNOMED" display 'Human immunodeficiency virus infection'

context Patient

// ============================================================================
// Pregnancy Status
// ============================================================================

define PregnancyConditions:
  [Condition: "Pregnancy"] C
    where C.clinicalStatus.coding[0].code = 'active'
      or C.clinicalStatus is null

define IsPregnant:
  exists(PregnancyConditions)

// ============================================================================
// HIV Status
// ============================================================================

// Check for known HIV positive diagnosis
define HIVPositiveConditions:
  [Condition: "HIV Positive"] C
    where C.clinicalStatus.coding[0].code = 'active'
      or C.clinicalStatus is null

define IsHIVPositive:
  exists(HIVPositiveConditions)

// HIV tests performed during this pregnancy (simplified: any HIV test)
define HIVTests:
  ([Observation: "HIV 1+2 Ab"]
    union [Observation: "HIV 1+2 Ag+Ab"]) Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define HasHIVTestThisPregnancy:
  exists(HIVTests)

// HIV Status: positive, negative, or unknown
define HIVStatus:
  case
    when IsHIVPositive then 'positive'
    when HasHIVTestThisPregnancy then 'negative'  // Simplified: assume negative if tested
    else 'unknown'
  end

// ============================================================================
// Prenatal Visit and Gestational Age
// ============================================================================

// For POC, first prenatal visit = pregnant and no HIV test yet
define IsFirstPrenatalVisit:
  IsPregnant and not HasHIVTestThisPregnancy

// Gestational age - simplified to flag
// In production, would calculate from LMP or ultrasound
// For POC, we assume not third trimester unless specified
define GestationalAgeInWeeks:
  20  // Simplified: assume second trimester

define IsThirdTrimester:
  GestationalAgeInWeeks >= 29

// ============================================================================
// Risk Assessment
// ============================================================================

define HasHIVRiskFactors:
  false  // Simplified: assume no risk factors

// ============================================================================
// Screening Recommendation Logic
// ============================================================================

// HIV positive: No test needed
define ExcludedHIVPositive:
  HIVStatus = 'positive'

// First prenatal visit: Universal screening
define FirstVisitScreeningNeeded:
  IsPregnant and not ExcludedHIVPositive and IsFirstPrenatalVisit

// Third trimester with risk factors: Repeat screening
define ThirdTrimesterRepeatNeeded:
  IsPregnant
    and not ExcludedHIVPositive
    and not IsFirstPrenatalVisit
    and IsThirdTrimester
    and HasHIVRiskFactors

// ============================================================================
// Main Output
// ============================================================================

define PerformHIVTest:
  FirstVisitScreeningNeeded or ThirdTrimesterRepeatNeeded

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when FirstVisitScreeningNeeded then 'Order HIV screening (prenatal care - first visit)'
    when ThirdTrimesterRepeatNeeded then 'Order HIV screening (third trimester repeat - risk factors)'
    else null
  end

define ExclusionReason:
  case
    when not IsPregnant then 'Patient is not pregnant'
    when ExcludedHIVPositive then 'Patient is HIV positive - managed under treatment protocol'
    when HasHIVTestThisPregnancy and not IsThirdTrimester then 'HIV screening done this pregnancy'
    when IsThirdTrimester and not HasHIVRiskFactors then 'Third trimester without risk factors - repeat not indicated'
    else null
  end
