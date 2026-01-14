import React, { useState, useEffect } from 'react'

// Map patient tag prefixes to their CDS library and display configuration
const GUIDELINE_CONFIG = {
  bcs: {
    libraryId: 'BreastCancerScreening',
    title: 'Breast Cancer Screening',
    getAlerts: (result, getValue) => {
      const recommend = getValue(result, 'RecommendMammogram')
      return [{
        key: 'mammogram',
        active: recommend === true,
        activeText: 'Mammogram Recommended',
        inactiveText: 'No Mammogram Recommended',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Gender', value: getValue(result, 'Gender') },
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Mammogram in Last Two Years', value: getValue(result, 'MammogramInLastTwoYears') },
      { label: 'Has Bilateral Mastectomy', value: getValue(result, 'HasBilateralMastectomy') },
      { label: 'Has Breast Cancer Diagnosis', value: getValue(result, 'HasBreastCancerDiagnosis') },
    ],
  },
  tob: {
    libraryId: 'TobaccoScreening',
    title: 'Tobacco Cessation',
    getAlerts: (result, getValue) => {
      const recordTobacco = getValue(result, 'RecordTobaccoUse')
      const adviseToQuit = getValue(result, 'AdviseToQuit')
      const offerPharmaco = getValue(result, 'OfferPharmacotherapy')
      const offerBehavioral = getValue(result, 'OfferBehavioralTherapy')

      return [
        {
          key: 'record',
          active: recordTobacco === true,
          activeText: 'Record Tobacco Use Status',
          inactiveText: null, // Don't show if false
        },
        {
          key: 'advise',
          active: adviseToQuit === true,
          activeText: 'Advise Patient to Quit',
          inactiveText: null,
        },
        {
          key: 'pharmaco',
          active: offerPharmaco === true,
          activeText: 'Offer Pharmacotherapy (FDA-approved cessation medications)',
          inactiveText: null,
        },
        {
          key: 'behavioral',
          active: offerBehavioral === true,
          activeText: 'Offer Behavioral Therapy',
          inactiveText: null,
        },
      ]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Tobacco Use Status', value: getValue(result, 'TobaccoUseStatus') },
      { label: 'Is Pregnant', value: getValue(result, 'IsPregnant') },
      { label: 'Is Current Tobacco User', value: getValue(result, 'IsCurrentTobaccoUser') },
    ],
  },
  ccs: {
    libraryId: 'CervicalCancerScreening',
    title: 'Cervical Cancer Screening',
    getAlerts: (result, getValue) => {
      const screeningDue = getValue(result, 'CervicalScreeningDue')
      const screeningInterval = getValue(result, 'ScreeningInterval')
      return [{
        key: 'screening',
        active: screeningDue === true,
        activeText: 'Cervical Screening Due',
        inactiveText: 'No Cervical Screening Due',
        tooltip: screeningInterval, // Age-appropriate options
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Gender', value: getValue(result, 'Gender') },
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Screening Options', value: getValue(result, 'ScreeningInterval') },
      { label: 'Cytology in Last 3 Years', value: getValue(result, 'HasCervicalCytologyInLastThreeYears') },
      { label: 'hrHPV in Last 5 Years', value: getValue(result, 'HasHrHPVInLastFiveYears') },
      { label: 'Absence of Cervix', value: getValue(result, 'HasAbsenceOfCervix') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  crc: {
    libraryId: 'ColorectalCancerScreening',
    title: 'Colorectal Cancer Screening',
    getAlerts: (result, getValue) => {
      const screeningDue = getValue(result, 'ColorectalScreeningDue')
      const screeningOptions = getValue(result, 'ScreeningOptions')
      return [{
        key: 'screening',
        active: screeningDue === true,
        activeText: 'Colorectal Cancer Screening Due',
        inactiveText: 'No Colorectal Screening Due',
        tooltip: screeningOptions,
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Eligible Age (46-75)', value: getValue(result, 'IsEligibleAge') },
      { label: 'Screening Options', value: getValue(result, 'ScreeningOptions') },
      { label: 'FOBT in Last Year', value: getValue(result, 'HasFOBTInLastYear') },
      { label: 'sDNA-FIT in Last 2 Years', value: getValue(result, 'HasDNAFITInLastTwoYears') },
      { label: 'CT Colonography in Last 5 Years', value: getValue(result, 'HasCTColonographyInLastFiveYears') },
      { label: 'Flex Sig in Last 5 Years', value: getValue(result, 'HasFlexSigInLastFiveYears') },
      { label: 'Colonoscopy in Last 10 Years', value: getValue(result, 'HasColonoscopyInLastTenYears') },
      { label: 'Has Total Colectomy', value: getValue(result, 'HasTotalColectomy') },
      { label: 'Has Colorectal Cancer', value: getValue(result, 'HasColorectalCancer') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  fol: {
    libraryId: 'FolicAcidSupplementation',
    title: 'Folic Acid Supplementation',
    getAlerts: (result, getValue) => {
      const recommend400 = getValue(result, 'RecommendFolicAcid400Mcg')
      const recommend4mg = getValue(result, 'RecommendFolicAcid4Mg')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'folicacid',
        active: recommend400 === true || recommend4mg === true,
        activeText: recommendationText || 'Folic Acid Supplementation Recommended',
        inactiveText: 'No Folic Acid Recommendation',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Gender', value: getValue(result, 'Gender') },
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Is Eligible (Female 15-45)', value: getValue(result, 'IsEligible') },
      { label: 'Recommend 400mcg', value: getValue(result, 'RecommendFolicAcid400Mcg') },
      { label: 'Recommend 4mg', value: getValue(result, 'RecommendFolicAcid4Mg') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  onp: {
    libraryId: 'OphthalmiaNeonatorumProphylaxis',
    title: 'Ophthalmia Neonatorum Prophylaxis',
    getAlerts: (result, getValue) => {
      const administerProphylaxis = getValue(result, 'AdministerOcularProphylaxis')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'prophylaxis',
        active: administerProphylaxis === true,
        activeText: recommendationText || 'Administer Ocular Prophylaxis',
        inactiveText: 'No Prophylaxis Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Days', value: getValue(result, 'AgeInDays') },
      { label: 'Is Newborn (<=28 days)', value: getValue(result, 'IsNewborn') },
      { label: 'Prophylaxis Administered', value: getValue(result, 'OcularProphylaxisAdministered') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  hbv: {
    libraryId: 'HepatitisBScreeningPregnancy',
    title: 'Hepatitis B Screening (Pregnancy)',
    getAlerts: (result, getValue) => {
      const performScreening = getValue(result, 'PerformHBsAgScreening')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'hbsag',
        active: performScreening === true,
        activeText: recommendationText || 'Order HBsAg Screening',
        inactiveText: 'No HBsAg Screening Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Gender', value: getValue(result, 'Gender') },
      { label: 'Is Female', value: getValue(result, 'IsFemale') },
      { label: 'Is Currently Pregnant', value: getValue(result, 'IsCurrentlyPregnant') },
      { label: 'HBsAg Screening Performed', value: getValue(result, 'HBsAgScreeningPerformed') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  prp: {
    libraryId: 'HIVPreexposureProphylaxis',
    title: 'HIV Pre-Exposure Prophylaxis (PrEP)',
    getAlerts: (result, getValue) => {
      const prescribePrEP = getValue(result, 'PrescribePrEP')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'prep',
        active: prescribePrEP === true,
        activeText: recommendationText || 'Consider Prescribing PrEP',
        inactiveText: 'PrEP Not Indicated',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Meets Age Requirement (>=13)', value: getValue(result, 'MeetsAgeRequirement') },
      { label: 'Weight (kg)', value: getValue(result, 'WeightInKilo') },
      { label: 'Meets Weight Requirement (>=35kg)', value: getValue(result, 'MeetsWeightRequirement') },
      { label: 'HIV Negative', value: getValue(result, 'HIVNegative') },
      { label: 'Is Eligible', value: getValue(result, 'IsEligible') },
      { label: 'Has PrEP Indication', value: getValue(result, 'HasPrEPIndication') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  htn: {
    libraryId: 'HypertensionScreeningAdult',
    title: 'Hypertension Screening',
    getAlerts: (result, getValue) => {
      const measureBP = getValue(result, 'OfficeBloodPressureMeasurement')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'bp',
        active: measureBP === true,
        activeText: recommendationText || 'Measure Blood Pressure',
        inactiveText: 'No BP Measurement Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Is Adult (>=18)', value: getValue(result, 'IsAdult') },
      { label: 'Is Age 40+', value: getValue(result, 'IsAge40Plus') },
      { label: 'Is Age 18-39', value: getValue(result, 'IsAge18To39') },
      { label: 'Has Hypertension Diagnosis', value: getValue(result, 'DiagnosisOfHypertension') },
      { label: 'BP in Last Year', value: getValue(result, 'OBPMBInTheLastYear') },
      { label: 'BP in Last 4 Years', value: getValue(result, 'OBPMBInTheLast4Years') },
      { label: 'At Increased Risk', value: getValue(result, 'AtIncreasedRisk') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  rhd: {
    libraryId: 'RhdIncompatibility',
    title: 'Rh(D) Incompatibility Screening',
    getAlerts: (result, getValue) => {
      const performTests = getValue(result, 'PerformRhDAndAntibodyTests')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'rhd',
        active: performTests === true,
        activeText: recommendationText || 'Order Rh(D) Typing and Antibody Screen',
        inactiveText: 'No Rh(D) Testing Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Is Currently Pregnant', value: getValue(result, 'IsCurrentlyPregnant') },
      { label: 'Rh Typing Done', value: getValue(result, 'RhTypingDone') },
      { label: 'Antibody Screen Done', value: getValue(result, 'AntibodyScreenDone') },
      { label: 'Both Tests Done', value: getValue(result, 'RhDAndAntibodyScreenDone') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  syp: {
    libraryId: 'SyphilisScreening',
    title: 'Syphilis Screening',
    getAlerts: (result, getValue) => {
      const performTesting = getValue(result, 'PerformSyphilisTesting')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'syphilis',
        active: performTesting === true,
        activeText: recommendationText || 'Order Syphilis Screening',
        inactiveText: 'No Syphilis Screening Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Is Adolescent/Adult', value: getValue(result, 'AdolescentOrAdult') },
      { label: 'Is Pregnant', value: getValue(result, 'Pregnant') },
      { label: 'Is Asymptomatic', value: getValue(result, 'Asymptomatic') },
      { label: 'At Increased Risk', value: getValue(result, 'AtIncreasedRisk') },
      { label: 'Pregnancy Screening Done', value: getValue(result, 'PregnancyScreeningDone') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  hiv: {
    libraryId: 'HIVScreeningAge',
    title: 'HIV Screening (Age-Based)',
    getAlerts: (result, getValue) => {
      const recommendTesting = getValue(result, 'RecommendHIVTesting')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'hiv',
        active: recommendTesting === true,
        activeText: recommendationText || 'Order HIV Screening',
        inactiveText: 'No HIV Screening Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Age in Years', value: getValue(result, 'AgeInYears') },
      { label: 'Is Universal Screening Age (15-65)', value: getValue(result, 'IsUniversalScreeningAge') },
      { label: 'Is Under Screening Age (<15)', value: getValue(result, 'IsUnderScreeningAge') },
      { label: 'Is Over Screening Age (>65)', value: getValue(result, 'IsOverScreeningAge') },
      { label: 'Has HIV Test', value: getValue(result, 'HasHIVTest') },
      { label: 'Has HIV Risk Factors', value: getValue(result, 'HasHIVRiskFactors') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
  hvp: {
    libraryId: 'HIVScreeningPregnancy',
    title: 'HIV Screening (Pregnancy)',
    getAlerts: (result, getValue) => {
      const performTest = getValue(result, 'PerformHIVTest')
      const recommendationText = getValue(result, 'RecommendationText')
      return [{
        key: 'hivpreg',
        active: performTest === true,
        activeText: recommendationText || 'Order HIV Screening (Prenatal)',
        inactiveText: 'No HIV Screening Needed',
      }]
    },
    getDetails: (result, getValue) => [
      { label: 'Is Pregnant', value: getValue(result, 'IsPregnant') },
      { label: 'HIV Status', value: getValue(result, 'HIVStatus') },
      { label: 'Has HIV Test This Pregnancy', value: getValue(result, 'HasHIVTestThisPregnancy') },
      { label: 'Is First Prenatal Visit', value: getValue(result, 'IsFirstPrenatalVisit') },
      { label: 'Is Third Trimester', value: getValue(result, 'IsThirdTrimester') },
      { label: 'Has HIV Risk Factors', value: getValue(result, 'HasHIVRiskFactors') },
      { label: 'Exclusion Reason', value: getValue(result, 'ExclusionReason') },
    ],
  },
}

function App() {
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [cdsResult, setCdsResult] = useState(null)
  const [currentGuideline, setCurrentGuideline] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients()
  }, [])

  // Evaluate CDS when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      evaluateCds(selectedPatientId)
    } else {
      setCdsResult(null)
      setSelectedPatient(null)
      setCurrentGuideline(null)
    }
  }, [selectedPatientId])

  async function fetchPatients() {
    try {
      // Fetch patients for each guideline type and combine
      const tagBase = 'http://example.org/test-lifecycle'
      const guidelineTags = Object.keys(GUIDELINE_CONFIG).map(prefix => `${prefix}-test`)

      const allPatients = new Map() // Use Map to dedupe by ID

      for (const tag of guidelineTags) {
        const response = await fetch(
          `/fhir/Patient?_tag=${encodeURIComponent(tagBase + '|' + tag)}&_count=100`
        )
        const bundle = await response.json()
        const patients = bundle.entry?.map(e => e.resource) || []
        patients.forEach(p => allPatients.set(p.id, p))
      }

      // Sort by ID for consistent ordering
      const patientList = Array.from(allPatients.values())
      patientList.sort((a, b) => a.id.localeCompare(b.id))
      setPatients(patientList)
    } catch (err) {
      setError('Failed to fetch patients: ' + err.message)
    }
  }

  function getGuidelineFromPatient(patient) {
    // Look at patient tags to determine which guideline applies
    const tags = patient.meta?.tag || []
    for (const tag of tags) {
      if (tag.system === 'http://example.org/test-lifecycle') {
        // Check prefix (e.g., "bcs-test" → "bcs", "tob-test" → "tob")
        const prefix = tag.code?.split('-')[0]
        if (prefix && GUIDELINE_CONFIG[prefix]) {
          return GUIDELINE_CONFIG[prefix]
        }
      }
    }
    return null
  }

  async function evaluateCds(patientId) {
    setLoading(true)
    setError(null)
    setCdsResult(null)
    setCurrentGuideline(null)

    try {
      // Fetch patient details
      const patientResponse = await fetch(`/fhir/Patient/${patientId}`)
      const patient = await patientResponse.json()
      setSelectedPatient(patient)

      // Determine which guideline to evaluate
      const guideline = getGuidelineFromPatient(patient)
      if (!guideline) {
        setError('No matching CDS guideline found for this patient')
        return
      }
      setCurrentGuideline(guideline)

      // Evaluate CDS
      const cdsResponse = await fetch(
        `/fhir/Library/${guideline.libraryId}/$evaluate?subject=Patient/${patientId}`
      )
      const result = await cdsResponse.json()
      setCdsResult(result)
    } catch (err) {
      setError('Failed to evaluate CDS: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function getPatientDisplayName(patient) {
    if (!patient) return ''
    const name = patient.name?.[0]
    if (name) {
      const given = name.given?.join(' ') || ''
      const family = name.family || ''
      return `${given} ${family}`.trim() || patient.id
    }
    return patient.id
  }

  function getPatientAge(patient) {
    if (!patient?.birthDate) return null
    const [year, month, day] = patient.birthDate.split('-').map(Number)
    const birth = new Date(year, month - 1, day)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  function getParameterValue(params, name) {
    const param = params?.parameter?.find(p => p.name === name)
    if (!param) return null
    if (param.valueBoolean !== undefined) return param.valueBoolean
    if (param.valueString !== undefined) return param.valueString
    if (param.valueInteger !== undefined) return param.valueInteger
    if (param.valueDate !== undefined) return param.valueDate
    return null
  }

  // Get alerts for current guideline
  const alerts = currentGuideline && cdsResult
    ? currentGuideline.getAlerts(cdsResult, getParameterValue)
    : []

  // Filter to only show active alerts (or show "no action" for BCS-style single alerts)
  const activeAlerts = alerts.filter(a => a.active || a.inactiveText)
  const hasPositiveRecommendation = alerts.some(a => a.active)

  return (
    <div className="app">
      <header className="header">
        <h1>USPSTF Clinical Decision Support</h1>
        <p className="subtitle">Mock EMR Demonstration</p>
      </header>

      <main className="main">
        <section className="patient-selector">
          <label htmlFor="patient-select">Select Patient:</label>
          <select
            id="patient-select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
          >
            <option value="">-- Select a patient --</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {patient.id}
              </option>
            ))}
          </select>
        </section>

        {error && (
          <div className="error-card">
            {error}
          </div>
        )}

        {loading && (
          <div className="loading">
            Evaluating CDS...
          </div>
        )}

        {selectedPatient && !loading && (
          <section className="patient-info">
            <h2>Patient Information</h2>
            <dl>
              <dt>ID</dt>
              <dd>{selectedPatient.id}</dd>
              <dt>Name</dt>
              <dd>{getPatientDisplayName(selectedPatient)}</dd>
              <dt>Gender</dt>
              <dd>{selectedPatient.gender || 'Unknown'}</dd>
              <dt>Birth Date</dt>
              <dd>{selectedPatient.birthDate || 'Unknown'}</dd>
              <dt>Age</dt>
              <dd>{getPatientAge(selectedPatient) ?? 'Unknown'} years</dd>
            </dl>
          </section>
        )}

        {cdsResult && currentGuideline && !loading && (
          <section className={`cds-card ${hasPositiveRecommendation ? 'recommend' : 'no-recommend'}`}>
            <h2>CDS Recommendation: {currentGuideline.title}</h2>

            {activeAlerts.length === 0 && (
              <div className="recommendation">
                <span className="icon">—</span>
                <span className="text">No Action Required</span>
              </div>
            )}

            {activeAlerts.map(alert => (
              <div key={alert.key} className="recommendation">
                {alert.active ? (
                  <>
                    <span className="icon">✓</span>
                    <span className="text">{alert.activeText}</span>
                  </>
                ) : (
                  <>
                    <span className="icon">—</span>
                    <span className="text">{alert.inactiveText}</span>
                  </>
                )}
              </div>
            ))}

            <details className="cds-details">
              <summary>View Decision Factors</summary>
              <dl>
                {currentGuideline.getDetails(cdsResult, getParameterValue).map(({ label, value }) => (
                  <React.Fragment key={label}>
                    <dt>{label}</dt>
                    <dd>{String(value ?? 'N/A')}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </details>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>L4 Clinical Decision Support Demonstration</p>
      </footer>
    </div>
  )
}

export default App
