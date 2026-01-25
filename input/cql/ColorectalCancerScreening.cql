library ColorectalCancerScreening version '0.0.2'

// Colorectal Cancer: Screening
// Implements USPSTF Grade A Recommendation (ages 50-75) and Grade B (ages 45-49)
// Per CMS130, ages 46-75 are included in the measure
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// Seven screening strategies with different intervals:
// - HSgFOBT or FIT: every 1 year
// - sDNA-FIT (Cologuard): every 2 years (per CMS130)
// - CT Colonography: every 5 years
// - Flexible Sigmoidoscopy: every 5 years
// - Flexible Sigmoidoscopy + annual FIT: flex sig every 10 years + FIT every year
// - Colonoscopy: every 10 years

using FHIR version '4.0.1'

include FHIRHelpers version '4.4.000' called FHIRHelpers

// ValueSets from CMS130
valueset "Fecal Occult Blood Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1011'
valueset "Stool DNA with FIT Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1039'
valueset "Colonoscopy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1020'
valueset "Flexible Sigmoidoscopy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1010'
valueset "CT Colonography": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1038'

// Exclusion ValueSets
valueset "Total Colectomy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1019'
valueset "Malignant Neoplasm of Colon": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1001'

context Patient

// ============================================================================
// Basic Patient Information
// ============================================================================

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

// ============================================================================
// Age Eligibility (per CMS130: 46-75)
// ============================================================================

define IsEligibleAge:
  AgeInYears >= 46 and AgeInYears <= 75

// ============================================================================
// Exclusions
// ============================================================================

// Patient has had total colectomy
define HasTotalColectomy:
  exists(
    [Procedure: "Total Colectomy"] P
      where P.status = 'completed'
  )

// Patient has colorectal cancer diagnosis
// Using FHIR Condition instead of ConditionProblemsHealthConcerns
define HasColorectalCancer:
  exists(
    [Condition: "Malignant Neoplasm of Colon"] C
      where C.clinicalStatus.coding[0].code = 'active'
        or C.clinicalStatus is null
  )

// Combined exclusion check
define IsExcluded:
  HasTotalColectomy or HasColorectalCancer

// ============================================================================
// Screening History - Check for recent procedures/tests
// ============================================================================

// FOBT or FIT in last 1 year (includes both HSgFOBT and FIT)
// Using "after" operator so exactly 1 year ago = due (interval model)
define HasFOBTInLastYear:
  exists(
    [Observation: "Fecal Occult Blood Test"] Obs
      where Obs.status in { 'final', 'amended', 'corrected' }
        and (Obs.effective as dateTime) > Today() - 1 year
  )

// sDNA-FIT (Cologuard) in last 2 years
// Using "after" operator so exactly 2 years ago = due
define HasDNAFITInLastTwoYears:
  exists(
    [Observation: "Stool DNA with FIT Test"] Obs
      where Obs.status in { 'final', 'amended', 'corrected' }
        and (Obs.effective as dateTime) > Today() - 2 years
  )

// CT Colonography in last 5 years
define HasCTColonographyInLastFiveYears:
  exists(
    [Procedure: "CT Colonography"] P
      where P.status = 'completed'
        and (P.performed as dateTime) > Today() - 5 years
  )

// Flexible Sigmoidoscopy in last 5 years
define HasFlexSigInLastFiveYears:
  exists(
    [Procedure: "Flexible Sigmoidoscopy"] P
      where P.status = 'completed'
        and (P.performed as dateTime) > Today() - 5 years
  )

// Flexible Sigmoidoscopy in last 10 years (for combo strategy)
define HasFlexSigInLastTenYears:
  exists(
    [Procedure: "Flexible Sigmoidoscopy"] P
      where P.status = 'completed'
        and (P.performed as dateTime) > Today() - 10 years
  )

// Colonoscopy in last 10 years
// Using ">" (after) so exactly 10 years ago = due (interval model per CLAUDE.md)
define HasColonoscopyInLastTenYears:
  exists(
    [Procedure: "Colonoscopy"] P
      where P.status = 'completed'
        and (P.performed as dateTime) > Today() - 10 years
  )

// ============================================================================
// Screening Status
// ============================================================================

// Is patient up-to-date on ANY screening strategy?
// Any one of these satisfies the screening requirement
define IsUpToDateOnScreening:
  HasFOBTInLastYear
    or HasDNAFITInLastTwoYears
    or HasCTColonographyInLastFiveYears
    or HasFlexSigInLastFiveYears
    or HasColonoscopyInLastTenYears
    // Combo strategy: flex sig in 10 years + FIT in 1 year
    or (HasFlexSigInLastTenYears and HasFOBTInLastYear)

// ============================================================================
// Primary Output: Is Colorectal Screening Due?
// ============================================================================

define ColorectalScreeningDue:
  IsEligibleAge
    and not IsExcluded
    and not IsUpToDateOnScreening

// ============================================================================
// Exclusion Reason (for display)
// ============================================================================

define ExclusionReason:
  case
    when AgeInYears < 46 then 'Patient is under 46 years old'
    when AgeInYears > 75 then 'Patient is over 75 years old'
    when HasTotalColectomy then 'Patient has had total colectomy'
    when HasColorectalCancer then 'Patient has colorectal cancer diagnosis'
    else null
  end

// ============================================================================
// Screening Options Description
// ============================================================================

define ScreeningOptions:
  if ColorectalScreeningDue then
    'Options: (1) FOBT/FIT annually, (2) sDNA-FIT every 2 years, (3) CT Colonography every 5 years, (4) Flexible Sigmoidoscopy every 5 years, (5) Flex Sig every 10 years + annual FIT, (6) Colonoscopy every 10 years'
  else if IsUpToDateOnScreening then
    'Up to date on colorectal cancer screening'
  else
    null

// ============================================================================
// Individual Strategy Status (for detailed display)
// ============================================================================

// These indicate whether each specific test is due (not done within interval)

define FOBTDue:
  ColorectalScreeningDue and not HasFOBTInLastYear

define DNAFITDue:
  ColorectalScreeningDue and not HasDNAFITInLastTwoYears

define CTColonographyDue:
  ColorectalScreeningDue and not HasCTColonographyInLastFiveYears

define FlexibleSigmoidoscopyDue:
  ColorectalScreeningDue and not HasFlexSigInLastFiveYears

define ColonoscopyDue:
  ColorectalScreeningDue and not HasColonoscopyInLastTenYears
