library OphthalmiaNeonatorumProphylaxis version '0.0.1'

// Ocular Prophylaxis for Gonococcal Ophthalmia Neonatorum
// USPSTF Grade A Recommendation
//
// Population: All newborns
// Recommendation: Prophylactic ocular topical medication (0.5% erythromycin)
// Timing: Shortly after birth — infection can cause severe damage within 24 hours
//
// This is a persistent reminder pattern: the alert fires until prophylaxis is documented.
// Ensures prophylaxis is not forgotten in complicated deliveries or unit transfers.

using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers

codesystem "SNOMED": 'http://snomed.info/sct'

// Erythromycin ophthalmic ointment prophylaxis
// Note: 63192-0 (LOINC) is sometimes used for documentation, but SNOMED procedure code is more appropriate
valueset "Ocular Prophylaxis Procedures": 'http://example.org/fhir/ValueSet/ocular-prophylaxis-procedures'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInDays:
  AgeInDays()

define AgeInYears:
  AgeInYears()

// ============================================================================
// Newborn Eligibility (age <= 28 days = neonatal period)
// ============================================================================

define IsNewborn:
  AgeInDays <= 28

// ============================================================================
// Prophylaxis Status
// ============================================================================

// Check for documented ocular prophylaxis procedure
// In practice, this would be coded as a procedure with erythromycin administration
define OcularProphylaxisProcedures:
  [Procedure: "Ocular Prophylaxis Procedures"] P
    where P.status in { 'completed' }

define OcularProphylaxisAdministered:
  exists(OcularProphylaxisProcedures)

// ============================================================================
// Recommendation
// ============================================================================

// Recommend prophylaxis for newborns who haven't received it
define AdministerOcularProphylaxis:
  IsNewborn and not OcularProphylaxisAdministered

// ============================================================================
// Display Information
// ============================================================================

define RecommendationText:
  case
    when AdministerOcularProphylaxis then 'Administer 0.5% erythromycin ophthalmic ointment'
    when not IsNewborn then null
    else null
  end

define ExclusionReason:
  case
    when not IsNewborn then 'Patient is not a newborn (> 28 days old)'
    when OcularProphylaxisAdministered then 'Prophylaxis already administered'
    else null
  end
