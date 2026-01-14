library FolicAcidSupplementation version '0.0.1'

// Folic Acid Supplementation to Prevent Neural Tube Defects
// USPSTF Grade A Recommendation
//
// Population: Persons who plan to or could become pregnant
// Recommendation: Take daily supplement containing 0.4 to 0.8 mg (400-800 mcg) folic acid
//
// Per ACOG: "All women of reproductive age (15-45 years) should take folic acid supplementation.
// For average-risk women, supplementation with 400 micrograms per day is adequate."
//
// High-risk populations needing 4mg daily:
// - Prior pregnancy with NTD
// - Personal/family history of NTD
// - Partner with NTD or NTD-affected child
// - Anticonvulsant medications (valproic acid, carbamazepine, etc.)
// - MTHFR mutations
// - Bariatric surgery

using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

// ============================================================================
// Age Eligibility (per ACOG: 15-45 years)
// ============================================================================

define IsReproductiveAge:
  AgeInYears >= 15 and AgeInYears <= 45

define IsFemale:
  Gender = 'female'

define IsEligible:
  IsFemale and IsReproductiveAge

// ============================================================================
// Risk Assessment
// ============================================================================

// High risk for neural tube defects - abstracted flag
// In a full implementation, this would be derived from:
// - Conditions: prior NTD pregnancy, MTHFR mutations
// - Medications: anticonvulsants (valproic acid, carbamazepine, phenytoin)
// - Procedures: bariatric surgery
// - Family history: NTD in partner or prior children
//
// For this POC, high-risk detection is not implemented.
// All eligible patients receive the 400mcg recommendation.
// A production system would add logic to identify high-risk patients
// who need 4mg supplementation.

define HighRiskForNTD:
  false

// ============================================================================
// Recommendations
// ============================================================================

// Average-risk women 15-45: 400mcg daily
define RecommendFolicAcid400Mcg:
  IsEligible and not HighRiskForNTD

// High-risk women 15-45: 4mg daily
define RecommendFolicAcid4Mg:
  IsEligible and HighRiskForNTD

// Any folic acid recommendation
define RecommendFolicAcid:
  RecommendFolicAcid400Mcg or RecommendFolicAcid4Mg

// ============================================================================
// Recommendation Text (for display)
// ============================================================================

define RecommendationText:
  case
    when RecommendFolicAcid4Mg then 'Take 4mg folic acid daily (high-risk)'
    when RecommendFolicAcid400Mcg then 'Take 400mcg folic acid daily'
    when not IsFemale then null
    when AgeInYears < 15 then null
    when AgeInYears > 45 then null
    else null
  end

// ============================================================================
// Exclusion Reason (for display)
// ============================================================================

define ExclusionReason:
  case
    when not IsFemale then 'Male patient'
    when AgeInYears < 15 then 'Patient is under 15 years old'
    when AgeInYears > 45 then 'Patient is over 45 years old'
    else null
  end
