library TobaccoScreening version '0.0.7'

// Tobacco Cessation Interventions (Adults)
// Implements USPSTF Grade A Recommendations:
// - Non-pregnant adults: behavioral interventions + FDA-approved pharmacotherapy
// - Pregnant persons: behavioral interventions only (pharmacotherapy is Grade I)
//
// REFACTORED: Using FHIR R4 base types instead of QICore for compatibility
// with real EHR data (Epic, etc.) that doesn't use QICore profiles.
//
// v0.0.7: FHIRHelpers 4.0.1; ToDateTime workaround for HAPI v8.6.0 Kotlin engine
//   DateTimeType sort bug on Bundle-parameter data path.

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

// LOINC codes for observations
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'

// Smoking status observation code
code "Tobacco smoking status LOINC": '72166-2' from "LOINC" display 'Tobacco smoking status'
code "Pregnancy status LOINC": '82810-3' from "LOINC" display 'Pregnancy status'
code "Pregnant LOINC": 'LA15173-0' from "LOINC" display 'Pregnant'

// Tobacco User codes from valueset 2.16.840.1.113883.3.526.3.1170
code "Current every day smoker": '449868002' from "SNOMED"
code "Occasional tobacco smoker": '428041000124106' from "SNOMED"
code "Smoker": '77176002' from "SNOMED"
code "Light tobacco smoker": '428061000124105' from "SNOMED"
code "Heavy tobacco smoker": '428071000124103' from "SNOMED"

// Tobacco Non-User codes from valueset 2.16.840.1.113883.3.526.3.1189
code "Ex-smoker": '8517006' from "SNOMED"
code "Never smoked tobacco": '266919005' from "SNOMED"
code "Former smoker": '281018007' from "SNOMED"

context Patient

define PatientName:
  Patient.name[0].given[0] + ' ' + Patient.name[0].family

define PatientId:
  Patient.id

define AgeInYears:
  AgeInYears()

// Get smoking status observations, sorted by date (most recent last)
// Using FHIR Observation instead of USCoreSmokingStatusProfile
define SmokingStatusObservations:
  [Observation: "Tobacco smoking status LOINC"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentSmokingStatus:
  Last(
    SmokingStatusObservations Obs
      sort by FHIRHelpers.ToDateTime(effective as dateTime)
  )

// Helper to check if value matches any tobacco user code
define IsTobaccoUserCode:
  MostRecentSmokingStatus.value ~ "Current every day smoker"
    or MostRecentSmokingStatus.value ~ "Occasional tobacco smoker"
    or MostRecentSmokingStatus.value ~ "Smoker"
    or MostRecentSmokingStatus.value ~ "Light tobacco smoker"
    or MostRecentSmokingStatus.value ~ "Heavy tobacco smoker"

// Helper to check if value matches any tobacco non-user code
define IsTobaccoNonUserCode:
  MostRecentSmokingStatus.value ~ "Ex-smoker"
    or MostRecentSmokingStatus.value ~ "Never smoked tobacco"
    or MostRecentSmokingStatus.value ~ "Former smoker"

// Determine tobacco use status: "current", "former-or-never", or null
define TobaccoUseStatus:
  case
    when MostRecentSmokingStatus is null then null
    when IsTobaccoUserCode then 'current'
    when IsTobaccoNonUserCode then 'former-or-never'
    else null
  end

// Get pregnancy status observations
define PregnancyStatusObservations:
  [Observation: "Pregnancy status LOINC"] Obs
    where Obs.status in { 'final', 'amended', 'corrected' }

define MostRecentPregnancyStatus:
  Last(
    PregnancyStatusObservations Obs
      sort by FHIRHelpers.ToDateTime(effective as dateTime)
  )

// Is patient currently pregnant?
// True if most recent pregnancy observation value indicates pregnant
define IsPregnant:
  case
    when MostRecentPregnancyStatus is null then false
    when MostRecentPregnancyStatus.value ~ "Pregnant LOINC" then true
    else false
  end

// Is this an adult (18+ years)?
define IsAdult:
  AgeInYears >= 18

// Is the patient a current tobacco user?
// Coalesce to false when status is unknown (null)
define IsCurrentTobaccoUser:
  Coalesce(TobaccoUseStatus = 'current', false)

// OUTPUT 1: RecordTobaccoUse
// True when tobacco status is unknown and patient is an adult
// USPSTF: "ask all adults about tobacco use"
define RecordTobaccoUse:
  IsAdult and TobaccoUseStatus is null

// OUTPUT 2: AdviseToQuit
// True when patient is an adult current tobacco user
// USPSTF: "advise them to stop using tobacco"
define AdviseToQuit:
  IsAdult and IsCurrentTobaccoUser

// OUTPUT 3: OfferPharmacotherapy
// True when patient is an adult current tobacco user AND not pregnant
// USPSTF: "provide... FDA-approved pharmacotherapy for cessation to nonpregnant adults"
// Note: Pharmacotherapy for pregnant persons is Grade I (insufficient evidence)
define OfferPharmacotherapy:
  IsAdult and IsCurrentTobaccoUser and not IsPregnant

// OUTPUT 4: OfferBehavioralTherapy
// True when patient is an adult current tobacco user (regardless of pregnancy)
// USPSTF: "provide behavioral interventions" (applies to both pregnant and non-pregnant)
define OfferBehavioralTherapy:
  IsAdult and IsCurrentTobaccoUser
