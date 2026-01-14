library RhdIncompatibility version '0.0.1'

// Rh(D) Incompatibility Screening (First Prenatal Visit)
// USPSTF Grade A Recommendation
//
// Population: All pregnant women at first pregnancy-related care visit
// Recommendation: Rh(D) blood typing and antibody testing
//
// Scope: Grade A (first visit) only. Grade B (repeat at 24-28 weeks for
// unsensitized Rh(D)-negative women) is not modeled.
//
// Pattern: Persistent reminder — recommend testing until documented
// (same as Ophthalmia Neonatorum Prophylaxis)
//
// Source: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/rh-d-incompatibility-screening

using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// Rh(D) blood typing tests
code "Rh Type": '883-9' from "LOINC" display 'ABO and Rh group [Type] in Blood'
code "Rh D Antigen": '10331-7' from "LOINC" display 'Rh [Type] in Blood'

// Antibody screen tests
code "Antibody Screen": '890-4' from "LOINC" display 'Blood group antibodies Screen [Presence] in Serum or Plasma'

// Pregnancy condition
code "Pregnancy": '77386006' from "SNOMED" display 'Pregnancy (finding)'

context Patient

// ============================================================================
// Pregnancy Status
// ============================================================================

define PregnancyConditions:
  [ConditionProblemsHealthConcerns: "Pregnancy"]

define IsCurrentlyPregnant:
  exists(PregnancyConditions)

// ============================================================================
// Rh(D) Blood Typing
// ============================================================================

define RhTypeTests:
  ([SimpleObservation: "Rh Type"] union [SimpleObservation: "Rh D Antigen"]) Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define RhTypingDone:
  exists(RhTypeTests)

// ============================================================================
// Antibody Screen
// ============================================================================

define AntibodyScreenTests:
  [SimpleObservation: "Antibody Screen"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define AntibodyScreenDone:
  exists(AntibodyScreenTests)

// ============================================================================
// Combined Screening Status
// ============================================================================

// Both Rh(D) typing AND antibody screen must be done
define RhDAndAntibodyScreenDone:
  RhTypingDone and AntibodyScreenDone

// ============================================================================
// Recommendation
// ============================================================================

// Recommend testing for pregnant patients who haven't been screened
define PerformRhDAndAntibodyTests:
  IsCurrentlyPregnant and not RhDAndAntibodyScreenDone

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when PerformRhDAndAntibodyTests then 'Order Rh(D) blood typing and antibody screen'
    else null
  end

define ExclusionReason:
  case
    when not IsCurrentlyPregnant then 'Patient is not currently pregnant'
    when RhDAndAntibodyScreenDone then 'Rh(D) typing and antibody screen already performed'
    else null
  end
