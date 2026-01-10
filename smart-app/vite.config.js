import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Different port from mock-emr (3000)
    proxy: {
      // Proxy to local HAPI for development/testing
      // In production SMART app, this would point to EHR's FHIR server
      '/fhir': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // Allow importing JSON files (for ELM)
  json: {
    stringify: false,
  },
  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@elm': '/src/elm',
      '@valuesets': '/src/valuesets',
    },
  },
})
