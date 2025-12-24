library BreastCancerScreening version '0.0.1'

// using FHIR version '4.0.1'
using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers
// include FHIRCommon version '4.0.1' called FC
include QICoreCommon version '4.0.000' called QC
include Status version '1.13.000'

valueset "Mammography": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1018'

context Patient

define PatientName: 
  Patient.name[0].given[0] + ' ' + Patient.name[0].family

define PatientId: 
  Patient.id

define AgeInYears:
  AgeInYears()

define Gender:
  Patient.gender

// Get all qualifying mammograms, sorted by date
define QualifyingMammograms:
  ([ObservationClinicalResult: "Mammography"]).isDiagnosticStudyPerformed()

define MostRecentMammogram:
  Last(
    QualifyingMammograms Mammogram
      sort by effective.toInterval().low
  )

define DateOfMostRecentMammogram:
  MostRecentMammogram.effective.toInterval().low

define MammogramInLastTwoYears:
  Coalesce(DateOfMostRecentMammogram on or after (Today() - 2 years), false)

define RecommendMammogram:
  if AgeInYears in Interval[40, 74]
    and Gender = 'female'
    and MammogramInLastTwoYears = false
  then true
  else false

