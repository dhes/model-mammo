library SyphilisScreening version '0.0.2'

// Syphilis Screening (Composite: Pregnancy and Non-Pregnancy)
// USPSTF Grade A Recommendations (two populations):
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// 1. Non-Pregnant Population:
//    "Recommends screening for syphilis infection in persons who are at increased risk."
//    Population: Asymptomatic, nonpregnant adolescents and adults at increased risk.
//
// 2. Pregnant Population:
//    "Recommends early, universal screening for syphilis infection during pregnancy."
//    Population: All asymptomatic pregnant persons (universal, not risk-based).
//
// Risk factors (non-pregnant): MSM, HIV, prior STIs, drug use, incarceration,
// sex work, high-prevalence community.
//
// Symptomatic patients: Excluded — need diagnostic testing, not screening.
//
// Sources:
// - https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/syphilis-infection-nonpregnant-adults-adolescents-screening
// - https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/syphilis-infection-in-pregnancy-screening

using FHIR version '4.0.1'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// Syphilis test codes
code "Syphilis Serology": '22587-0' from "LOINC" display 'Treponema pallidum Ab [Presence] in Serum'
code "RPR": '20507-0' from "LOINC" display 'Reagin Ab [Presence] in Serum by RPR'
code "VDRL": '22592-0' from "LOINC" display 'Reagin Ab [Presence] in Serum by VDRL'

// Pregnancy condition
code "Pregnancy": '77386006' from "SNOMED" display 'Pregnancy (finding)'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

// Adolescent or adult (age >= 12 per common threshold)
define AdolescentOrAdult:
  AgeInYears >= 12

// ============================================================================
// Pregnancy Status
// ============================================================================

define PregnancyConditions:
  [Condition: "Pregnancy"] C
    where C.clinicalStatus.coding[0].code = 'active'
      or C.clinicalStatus is null

define Pregnant:
  exists(PregnancyConditions)

// ============================================================================
// Symptomatic Status
// ============================================================================

// For POC, assume asymptomatic unless documented otherwise
// In production, would check for syphilis symptom conditions:
// - Chancre (primary syphilis)
// - Rash, lymphadenopathy (secondary syphilis)
// - Neurological symptoms (tertiary/neurosyphilis)

define Asymptomatic:
  true  // Simplified: assume asymptomatic

// ============================================================================
// Risk Assessment (Non-Pregnant)
// ============================================================================

// "At increased risk" per USPSTF includes:
// - Men who have sex with men (MSM)
// - Persons living with HIV
// - History of STIs
// - Injection drug use
// - Commercial sex work
// - Incarceration history
// - Living in high-prevalence community
//
// For POC, simplified to flag

define AtIncreasedRisk:
  false  // Simplified: assume not at increased risk unless documented

// ============================================================================
// Pregnancy Screening Status
// ============================================================================

// Syphilis tests performed (any of the common test types)
define SyphilisTests:
  ([Observation: "Syphilis Serology"]
    union [Observation: "RPR"]
    union [Observation: "VDRL"]) Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define PregnancyScreeningDone:
  exists(SyphilisTests)

// For POC, first prenatal visit is simplified
// In production, would check encounter type or visit sequence
define FirstPrenatalVisit:
  Pregnant and not PregnancyScreeningDone

// ============================================================================
// Screening Recommendation Logic
// ============================================================================

// Non-pregnant pathway: Risk-based screening
define NonPregnantAtRiskNeedsScreening:
  not Pregnant
    and Asymptomatic
    and AdolescentOrAdult
    and AtIncreasedRisk

// Pregnant pathway: Universal screening
define PregnantNeedsScreening:
  Pregnant
    and Asymptomatic
    and not PregnancyScreeningDone

// ============================================================================
// Main Output
// ============================================================================

define PerformSyphilisTesting:
  case
    when not Asymptomatic then false  // Symptomatic → diagnostic testing
    when not AdolescentOrAdult and not Pregnant then false  // Children excluded
    when PregnantNeedsScreening then true  // Pregnant, not yet screened
    when NonPregnantAtRiskNeedsScreening then true  // Non-pregnant, at risk
    else false
  end

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when PregnantNeedsScreening then 'Order syphilis screening (prenatal care)'
    when NonPregnantAtRiskNeedsScreening then 'Order syphilis screening (at increased risk)'
    else null
  end

define ExclusionReason:
  case
    when not Asymptomatic then 'Symptomatic - order diagnostic testing instead'
    when not AdolescentOrAdult and not Pregnant then 'Patient is a child'
    when Pregnant and PregnancyScreeningDone then 'Syphilis screening already done this pregnancy'
    when not Pregnant and not AtIncreasedRisk then 'Not at increased risk for syphilis'
    else null
  end
