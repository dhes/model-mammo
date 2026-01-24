/**
 * FHIR Service - wraps fhirclient for both standalone and SMART launch modes
 *
 * Usage:
 *   Standalone: FhirService.initStandalone('http://localhost:8080/fhir')
 *   SMART:      FhirService.initFromLaunch() (call from index.html after redirect)
 */
import FHIR from 'fhirclient'

class FhirService {
  constructor() {
    this.client = null
    this.mode = null // 'standalone' or 'smart'
  }

  /**
   * Initialize in standalone mode (no auth, direct FHIR server access)
   * Use for local development against open HAPI server
   */
  async initStandalone(fhirBaseUrl) {
    this.client = FHIR.client(fhirBaseUrl)
    this.mode = 'standalone'
    console.log(`[FhirService] Standalone mode: ${fhirBaseUrl}`)
    return this
  }

  /**
   * Initialize from SMART launch (OAuth2 flow)
   * Call this after redirect from launch.html
   */
  async initFromLaunch() {
    try {
      console.log('[FhirService] Attempting SMART launch...')
      console.log('[FhirService] URL params:', window.location.search)
      this.client = await FHIR.oauth2.ready()
      this.mode = 'smart'
      console.log('[FhirService] SMART launch successful!')
      console.log('[FhirService] Server URL:', this.client.state.serverUrl)
      console.log('[FhirService] Patient ID:', this.client.patient?.id)
      // Debug: log the granted scopes and token info
      console.log('[FhirService] Granted scopes:', this.client.state.scope)
      console.log('[FhirService] Token response:', this.client.state.tokenResponse)
      console.log('[FhirService] Full state:', JSON.stringify(this.client.state, null, 2))
      return this
    } catch (err) {
      console.warn('[FhirService] SMART launch failed:', err.message)
      console.warn('[FhirService] Full error:', err)
      throw err
    }
  }

  /**
   * Auto-detect mode based on URL parameters
   * - If ?iss= present: standalone mode with that server
   * - If SMART launch context exists: SMART mode
   * - Otherwise: standalone with default HAPI
   */
  async initAuto(defaultFhirPath = '/fhir') {
    const params = new URLSearchParams(window.location.search)
    const iss = params.get('iss')

    // Check for standalone ISS parameter (must be absolute URL)
    if (iss && !params.get('code')) {
      return this.initStandalone(iss)
    }

    // Try SMART launch (will succeed if we have auth context)
    try {
      return await this.initFromLaunch()
    } catch (err) {
      // Fall back to standalone with default URL
      // Convert relative path to absolute URL (fhirclient requires http(s)://)
      const defaultFhirUrl = defaultFhirPath.startsWith('http')
        ? defaultFhirPath
        : `${window.location.origin}${defaultFhirPath}`
      return this.initStandalone(defaultFhirUrl)
    }
  }

  /**
   * Get the current patient (from SMART launch context)
   * Returns null in standalone mode
   */
  async getPatientFromContext() {
    if (this.mode !== 'smart' || !this.client) return null

    try {
      // Debug: check what scopes we have
      const grantedScopes = this.client.state.scope || ''
      console.log('[FhirService] Checking patient context with scopes:', grantedScopes)

      // Check if we have patient scope
      const hasPatientScope = grantedScopes.includes('patient/Patient')
      console.log('[FhirService] Has patient/Patient scope:', hasPatientScope)

      const patient = await this.client.patient.read()
      return patient
    } catch (err) {
      console.warn('[FhirService] Failed to read patient:', err.message)
      // Try to get more error details
      if (err.response) {
        console.warn('[FhirService] Response status:', err.response.status)
        console.warn('[FhirService] Response headers:', err.response.headers)
        try {
          const body = await err.response.text()
          console.warn('[FhirService] Response body:', body)
        } catch (e) {
          // Ignore
        }
      }

      // Fallback: Try to construct minimal patient from token context
      // Epic and some EHRs include patient info in token response
      const patientId = this.client.patient?.id
      if (patientId) {
        console.log('[FhirService] Attempting fallback with patient ID from context:', patientId)
        // Return a minimal patient object so the app can still try to fetch other data
        return {
          resourceType: 'Patient',
          id: patientId,
          // Mark that we couldn't fetch full demographics
          _fallback: true
        }
      }
      return null
    }
  }

  /**
   * Fetch patients by tag (for standalone patient picker)
   */
  async fetchPatientsByTag(tagSystem, tagCodes) {
    const allPatients = new Map()

    for (const code of tagCodes) {
      try {
        const bundle = await this.client.request(
          `Patient?_tag=${encodeURIComponent(tagSystem + '|' + code)}&_count=100`
        )
        const patients = bundle.entry?.map(e => e.resource) || []
        patients.forEach(p => allPatients.set(p.id, p))
      } catch (err) {
        console.warn(`[FhirService] Error fetching patients with tag ${code}:`, err.message)
      }
    }

    return Array.from(allPatients.values())
  }

  /**
   * Fetch a single patient by ID
   */
  async fetchPatient(patientId) {
    return this.client.request(`Patient/${patientId}`)
  }

  /**
   * Fetch resources related to a patient
   *
   * Note: Epic requires 'category' or 'code' for Observation queries.
   * We query Observations by category to ensure compatibility.
   */
  async fetchPatientResources(patientId, resourceTypes = ['Observation', 'Condition', 'Procedure']) {
    const resources = []

    for (const type of resourceTypes) {
      try {
        if (type === 'Observation') {
          // Epic requires category or code for Observation queries
          // Using full system|code format for explicitness (short-form also works)
          const categories = [
            'http://terminology.hl7.org/CodeSystem/observation-category|vital-signs',
            'http://terminology.hl7.org/CodeSystem/observation-category|social-history',
            'http://terminology.hl7.org/CodeSystem/observation-category|laboratory',
            'http://terminology.hl7.org/CodeSystem/observation-category|survey',
          ]
          for (const category of categories) {
            try {
              const bundle = await this.client.request(
                `Observation?patient=${patientId}&category=${encodeURIComponent(category)}&_count=100`
              )
              const entries = bundle.entry?.map(e => e.resource) || []
              resources.push(...entries)
              const shortName = category.split('|')[1]
              console.log(`[FhirService] Fetched ${entries.length} ${shortName} observations`)
            } catch (err) {
              // Category might not exist or not be supported - continue
              const shortName = category.split('|')[1]
              console.warn(`[FhirService] Error fetching Observation/${shortName}:`, err.message)
            }
          }
        } else if (type === 'Condition') {
          // Using full system|code format for explicitness (short-form also works)
          const categories = [
            'http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item',
            'http://terminology.hl7.org/CodeSystem/condition-category|encounter-diagnosis',
          ]
          for (const category of categories) {
            try {
              const bundle = await this.client.request(
                `Condition?patient=${patientId}&category=${encodeURIComponent(category)}&_count=100`
              )
              const entries = bundle.entry?.map(e => e.resource) || []
              resources.push(...entries)
              const shortName = category.split('|')[1]
              console.log(`[FhirService] Fetched ${entries.length} ${shortName} conditions`)
            } catch (err) {
              const shortName = category.split('|')[1]
              console.warn(`[FhirService] Error fetching Condition/${shortName}:`, err.message)
            }
          }
        } else {
          // Other resource types (Procedure, etc.) can be queried directly
          const bundle = await this.client.request(
            `${type}?patient=${patientId}&_count=100`
          )
          const entries = bundle.entry?.map(e => e.resource) || []
          resources.push(...entries)
          console.log(`[FhirService] Fetched ${entries.length} ${type} resources`)
        }
      } catch (err) {
        console.warn(`[FhirService] Error fetching ${type}:`, err.message)
      }
    }

    return resources
  }

  /**
   * Build a FHIR bundle for CQL execution
   */
  async buildPatientBundle(patientId) {
    const patient = await this.fetchPatient(patientId)
    const relatedResources = await this.fetchPatientResources(patientId)

    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: patient },
        ...relatedResources.map(r => ({ resource: r }))
      ]
    }
  }

  /**
   * Get FHIR server base URL
   */
  getServerUrl() {
    return this.client?.state?.serverUrl || 'unknown'
  }

  /**
   * Check if initialized
   */
  isReady() {
    return this.client !== null
  }
}

// Export singleton instance
export const fhirService = new FhirService()
