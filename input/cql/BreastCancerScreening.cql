library BreastCancerScreening version '0.0.1'

// using FHIR version '4.0.1'
using QICore version '6.0.0'

include FHIRHelpers version '4.4.000' called FHIRHelpers
// include FHIRCommon version '4.0.1' called FC
include QICoreCommon version '4.0.000' called QC
include Status version '1.13.000'

valueset "Mammography": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1018'

context Patient

define RecommendMammogram:
  if AgeInYears() in Interval[40, 74]
    and Patient.gender = 'female'
    and MammogramInLastTwoYears = false
  then true
  else false

define MammogramInLastTwoYears:
  exists ( ( ( [ObservationClinicalResult: "Mammography"] ).isDiagnosticStudyPerformed ( ) ) Mammogram
      where Mammogram.effective during Interval[Today() - 2 years, Today()]
  )