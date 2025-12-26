import { useState, useEffect } from 'react'

function App() {
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [cdsResult, setCdsResult] = useState(null)
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
    }
  }, [selectedPatientId])

  async function fetchPatients() {
    try {
      const response = await fetch(
        '/fhir/Patient?_tag=http://example.org/test-lifecycle%7Cbcs-test&_count=100'
      )
      const bundle = await response.json()
      const patientList = bundle.entry?.map(e => e.resource) || []
      // Sort by ID for consistent ordering
      patientList.sort((a, b) => a.id.localeCompare(b.id))
      setPatients(patientList)
    } catch (err) {
      setError('Failed to fetch patients: ' + err.message)
    }
  }

  async function evaluateCds(patientId) {
    setLoading(true)
    setError(null)
    setCdsResult(null)

    try {
      // Fetch patient details
      const patientResponse = await fetch(`/fhir/Patient/${patientId}`)
      const patient = await patientResponse.json()
      setSelectedPatient(patient)

      // Evaluate CDS
      const cdsResponse = await fetch(
        `/fhir/Library/BreastCancerScreening/$evaluate?subject=Patient/${patientId}`
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
    const birth = new Date(patient.birthDate)
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

  const recommendMammogram = cdsResult ? getParameterValue(cdsResult, 'RecommendMammogram') : null

  return (
    <div className="app">
      <header className="header">
        <h1>Breast Cancer Screening CDS</h1>
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

        {cdsResult && !loading && (
          <section className={`cds-card ${recommendMammogram ? 'recommend' : 'no-recommend'}`}>
            <h2>CDS Recommendation</h2>
            <div className="recommendation">
              {recommendMammogram ? (
                <>
                  <span className="icon">✓</span>
                  <span className="text">Mammogram Recommended</span>
                </>
              ) : (
                <>
                  <span className="icon">—</span>
                  <span className="text">No Mammogram Recommended</span>
                </>
              )}
            </div>

            <details className="cds-details">
              <summary>View Decision Factors</summary>
              <dl>
                <dt>Gender</dt>
                <dd>{getParameterValue(cdsResult, 'Gender') || 'N/A'}</dd>
                <dt>Age in Years</dt>
                <dd>{getParameterValue(cdsResult, 'AgeInYears') ?? 'N/A'}</dd>
                <dt>Mammogram in Last Two Years</dt>
                <dd>{String(getParameterValue(cdsResult, 'MammogramInLastTwoYears') ?? 'N/A')}</dd>
                <dt>Has Bilateral Mastectomy</dt>
                <dd>{String(getParameterValue(cdsResult, 'HasBilateralMastectomy') ?? 'N/A')}</dd>
                <dt>Has Breast Cancer Diagnosis</dt>
                <dd>{String(getParameterValue(cdsResult, 'HasBreastCancerDiagnosis') ?? 'N/A')}</dd>
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
