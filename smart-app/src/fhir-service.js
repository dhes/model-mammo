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
      const patient = await this.client.patient.read()
      return patient
    } catch (err) {
      console.warn('[FhirService] No patient in context:', err.message)
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
          // Query each relevant category separately
          const categories = ['vital-signs', 'social-history', 'laboratory']
          for (const category of categories) {
            try {
              const bundle = await this.client.request(
                `Observation?patient=${patientId}&category=${category}&_count=100`
              )
              const entries = bundle.entry?.map(e => e.resource) || []
              resources.push(...entries)
              console.log(`[FhirService] Fetched ${entries.length} ${category} observations`)
            } catch (err) {
              // Category might not exist or not be supported - continue
              console.warn(`[FhirService] Error fetching Observation/${category}:`, err.message)
            }
          }
        } else {
          // Other resource types can be queried directly
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
