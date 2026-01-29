library RhdIncompatibility version '0.0.2'

// Rh(D) Incompatibility Screening (First Prenatal Visit)
// USPSTF Grade A Recommendation
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
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

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

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
  [Condition: "Pregnancy"] C
    where C.clinicalStatus.coding[0].code = 'active'
      or C.clinicalStatus is null

define IsCurrentlyPregnant:
  exists(PregnancyConditions)

// ============================================================================
// Rh(D) Blood Typing
// ============================================================================

define RhTypeTests:
  ([Observation: "Rh Type"] union [Observation: "Rh D Antigen"]) Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define RhTypingDone:
  exists(RhTypeTests)

// ============================================================================
// Antibody Screen
// ============================================================================

define AntibodyScreenTests:
  [Observation: "Antibody Screen"] Obs
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
