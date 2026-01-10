# SMART App - Local CQL Execution

USPSTF Clinical Decision Support with client-side CQL execution.

Unlike `mock-emr/` (which uses HAPI `$evaluate`), this app runs CQL directly in the browser using the `cql-execution` library.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Browser                                         │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ React App   │──│ cql-execution│             │
│  └─────────────┘  └─────────────┘              │
│        │                 │                      │
│        │ fetch           │ evaluate             │
│        ▼                 ▼                      │
│  ┌───────────┐    ┌───────────┐                │
│  │ FHIR Data │    │ ELM + VS  │                │
│  └───────────┘    └───────────┘                │
└───────│─────────────────────────────────────────┘
        │
        ▼ (still need FHIR server for patient data)
   ┌─────────┐
   │  HAPI   │  ← For dev; in prod this would be EHR's FHIR server
   └─────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- Java 21 (for CQL compilation)
- UMLS account (for ValueSet download) - https://uts.nlm.nih.gov/uts/signup-login

### Step 1: Install dependencies

```bash
cd smart-app
npm install
```

### Step 2: Compile CQL to ELM

```bash
cd ../tools/cql-translator

# Switch to Java 21
sdk use java 21.0.6-tem

# Compile all libraries
for lib in FHIRHelpers QICoreCommon Status BreastCancerScreening TobaccoScreening CervicalCancerScreening; do
  echo "Compiling $lib..."
  mvn exec:java -q -Dexec.args="-input ../../input/cql/${lib}.cql -output /tmp/${lib}.json -format JSON"
  mv /tmp/${lib}.json ../../smart-app/src/elm/
done
```

### Step 3: Download ValueSets from VSAC

```bash
cd ../vsac-download

# Set your UMLS API key
export VSAC_API_KEY="your-api-key-here"

# Download ValueSets
./download-valuesets.sh

# Convert to JavaScript
node convert-valuesets.js
```

### Step 4: Enable ELM imports in App.jsx

Edit `src/App.jsx` and uncomment the ELM imports:

```jsx
import BreastCancerScreeningELM from './elm/BreastCancerScreening.json'
import TobaccoScreeningELM from './elm/TobaccoScreening.json'
// ... etc
```

And update the `elmLibraries` object:

```jsx
const elmLibraries = {
  BreastCancerScreening: BreastCancerScreeningELM,
  TobaccoScreening: TobaccoScreeningELM,
  // ... etc
}
```

### Step 5: Run the app

```bash
# Make sure HAPI is running (for patient data)
# In another terminal: docker-compose up -d

cd smart-app
npm run dev
```

Open http://localhost:3001 (note: port 3001, not 3000)

## Comparison with mock-emr

| Aspect | mock-emr | smart-app |
|--------|----------|-----------|
| Port | 3000 | 3001 |
| Header color | Blue | Purple |
| CQL execution | HAPI `$evaluate` | Browser (cql-execution) |
| Requires HAPI for CQL | Yes | No |
| Requires HAPI for data | Yes | Yes (dev mode) |
| Setup complexity | Low | Higher (ELM, ValueSets) |

## Next Steps: True SMART on FHIR

To make this a real SMART app that launches from an EHR:

1. Add `fhirclient` OAuth2 flow
2. Remove patient selector (EHR provides patient context)
3. Deploy as static site
4. Register with Epic App Orchard / Cerner Code / etc.

See: https://docs.smarthealthit.org/
