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
