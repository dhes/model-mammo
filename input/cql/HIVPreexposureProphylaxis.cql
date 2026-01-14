library HIVPreexposureProphylaxis version '0.0.1'

// HIV Pre-Exposure Prophylaxis (PrEP)
// USPSTF Grade A Recommendation
//
// Population: Adults and adolescents weighing at least 35 kg (77 lb)
// Recommendation: Prescribe PrEP to persons at increased risk of HIV acquisition
//
// Eligibility Criteria (all must be met):
// - Age >= 13 years (operationalized adolescent threshold)
// - Weight >= 35 kg (FDA pharmacokinetic threshold)
// - HIV-negative status (documented)
// - Adequate renal function (creatinine clearance >= 60 mL/min per WHO)
// - No symptoms of acute HIV infection
// - No probable recent HIV exposure (recent exposure -> PEP, not PrEP)
// - No contraindications to PrEP medications
//
// Risk Indication factors (HasPrEPIndication):
// - Sexual partner with HIV (especially if not virally suppressed)
// - Bacterial STI in past 6 months (syphilis, gonorrhea, chlamydia)
// - Inconsistent/no condom use with partners of unknown HIV status
// - Shares injection drug equipment
// - Drug-injecting partner with HIV
// - Key populations: MSM, transgender women, persons who inject drugs
//
// Medications:
// - Oral TDF/FTC (tenofovir disoproxil fumarate/emtricitabine)
// - Oral TAF/FTC (tenofovir alafenamide/emtricitabine)
// - Injectable cabotegravir (long-acting, every 8 weeks)
//
// Source: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/prevention-of-human-immunodeficiency-virus-hiv-infection-pre-exposure-prophylaxis

using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// HIV tests - simplified to common HIV antibody tests
valueset "HIV Tests": 'http://example.org/fhir/ValueSet/hiv-tests'

// Sexually transmitted infections indicating PrEP indication
valueset "Sexually Transmitted Infections": 'http://example.org/fhir/ValueSet/sexually-transmitted-infections'

// Body weight code for vital signs observation
code "Body Weight": '29463-7' from "LOINC" display 'Body weight'

// Negative result codes
code "Negative SNOMED": '260385009' from "SNOMED" display 'Negative'
code "Negative LOINC": 'LA6577-6' from "LOINC" display 'Negative'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

// ============================================================================
// Age Eligibility (>= 13 years per operationalized adolescent threshold)
// ============================================================================

define MeetsAgeRequirement:
  AgeInYears >= 13

// ============================================================================
// Weight Eligibility (>= 35 kg per FDA threshold)
// ============================================================================

// For POC, look for recent weight observation
// In production, would filter to most recent observation
define WeightObservations:
  [SimpleObservation: "Body Weight"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentWeight:
  First(WeightObservations Obs sort by effective desc)

define WeightQuantity:
  MostRecentWeight.value as Quantity

define WeightInKilo:
  case
    when MostRecentWeight is null then null
    when WeightQuantity.unit = 'kg' then WeightQuantity.value
    when WeightQuantity.unit = '[lb_av]' then WeightQuantity.value * 0.453592
    else WeightQuantity.value // assume kg
  end

define MeetsWeightRequirement:
  WeightInKilo is not null and WeightInKilo >= 35

// ============================================================================
// HIV Status (must be HIV-negative)
// ============================================================================

// Check for documented negative HIV test
define HIVTests:
  [LaboratoryResultObservation: "HIV Tests"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define NegativeHIVTests:
  HIVTests Obs
    where Obs.value ~ "Negative SNOMED"
      or Obs.value ~ "Negative LOINC"

define HIVNegative:
  exists(NegativeHIVTests)

// ============================================================================
// Clinical Eligibility Flags (simplified for POC)
// ============================================================================

// For this POC, we simplify the following as assumed "eligible":
// - CreatinineClearanceAdequate: In production, would check eGFR/CrCl >= 60
// - NoAcuteHIVSymptoms: In production, would check for acute retroviral syndrome symptoms
// - NoProbableRecentExposure: In production, would check for recent exposure documentation
// - NoContraindications: In production, would check allergies to TDF/FTC

// These are abstracted flags - in a full implementation, each would be
// derived from appropriate clinical data. For testing, we assume the
// patient passes these eligibility criteria unless we create test cases
// that specifically fail them.

define CreatinineClearanceAdequate:
  true  // Simplified: assume adequate unless documented otherwise

define NoAcuteHIVSymptoms:
  true  // Simplified: assume no symptoms unless documented otherwise

define NoProbableRecentExposure:
  true  // Simplified: assume no recent exposure (would use PEP pathway)

define NoContraindications:
  true  // Simplified: assume no contraindications unless documented

// ============================================================================
// PrEP Indication (risk factors)
// ============================================================================

// Check for recent STI (syphilis, gonorrhea, chlamydia) in past 6 months
// This is one of the key indicators for PrEP
define RecentSTIConditions:
  [ConditionProblemsHealthConcerns: "Sexually Transmitted Infections"] C
    where (C.onset as DateTime) >= Today() - 6 months
      or C.recordedDate >= Today() - 6 months

define HasRecentSTI:
  exists(RecentSTIConditions)

// For POC, we use recent STI as the primary computable indicator
// In production, would also check:
// - Partner with HIV
// - Injection drug use
// - Multiple partners of unknown status
// - MSM, transgender women, persons who inject drugs

define HasPrEPIndication:
  HasRecentSTI

// ============================================================================
// Overall Eligibility
// ============================================================================

define IsEligible:
  MeetsAgeRequirement
    and MeetsWeightRequirement
    and HIVNegative
    and CreatinineClearanceAdequate
    and NoAcuteHIVSymptoms
    and NoProbableRecentExposure
    and NoContraindications

// ============================================================================
// Recommendation
// ============================================================================

define PrescribePrEP:
  IsEligible and HasPrEPIndication

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when PrescribePrEP then 'Consider prescribing HIV pre-exposure prophylaxis (PrEP)'
    when IsEligible and not HasPrEPIndication then 'Patient is eligible for PrEP but no current indication identified'
    else null
  end

define ExclusionReason:
  case
    when not MeetsAgeRequirement then 'Patient is under 13 years old'
    when WeightInKilo is null then 'No weight documented'
    when not MeetsWeightRequirement then 'Patient weighs less than 35 kg'
    when not HIVNegative then 'No documented negative HIV test'
    when not CreatinineClearanceAdequate then 'Inadequate renal function'
    when not NoAcuteHIVSymptoms then 'Acute HIV symptoms present - requires further testing'
    when not NoProbableRecentExposure then 'Recent HIV exposure - consider PEP instead'
    when not NoContraindications then 'Contraindications to PrEP medications'
    else null
  end
