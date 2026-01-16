# Pilot Readiness Checklist

This document outlines preparation, monitoring, and response strategies for piloting the USPSTF CDS app at a real clinical site.

## Pre-Pilot Preparation

### 1. Enhanced Logging

Add comprehensive logging to capture data shape issues:

- [ ] Log all FHIR queries made and response status codes
- [ ] Log resource counts by type (e.g., "Fetched 12 Observations, 3 Conditions, 0 Procedures")
- [ ] Log ValueSet match failures (code present but not in expected ValueSet)
- [ ] Log profile mismatches (expected QICore, got US Core or no profile)
- [ ] Log CQL expression results for debugging (with PHI protection)

### 2. Graceful Degradation

Implement fallback behaviors when data is missing or unexpected:

- [ ] Show "Unable to evaluate" rather than false negatives when queries fail
- [ ] Display "Data quality issue" warnings when expected data patterns are absent
- [ ] Distinguish "no data found" from "query failed" in the UI
- [ ] Add a "Debug Info" panel (toggle-able) showing raw query results

### 3. Configuration Flexibility

Build in adjustments for site-specific variations:

- [ ] Configurable Observation categories to query
- [ ] Configurable code systems (SNOMED vs ICD-10 preference)
- [ ] Configurable ValueSet overrides for local codes
- [ ] Feature flags to enable/disable individual guidelines

### 4. Consent and Privacy

- [ ] Confirm IRB/privacy approval for pilot (if required)
- [ ] Ensure no PHI is logged or transmitted outside the clinical environment
- [ ] Document data access scope (read-only, specific resource types)

---

## During Pilot: What to Monitor

### Query Success Rates

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Patient fetch success | 100% | Check auth, network |
| Observation fetch success | >95% | Check category params |
| Condition fetch success | >95% | Check query syntax |
| Procedure fetch success | >95% | Check permissions |

### Data Quality Indicators

| Indicator | Expected | Investigate If |
|-----------|----------|----------------|
| Patients with 0 Observations | <20% | >50% (query issue?) |
| Patients with 0 Conditions | <30% | >60% (scope issue?) |
| Weight observations found | >80% | <50% (category issue?) |
| BP observations found | >70% | <40% (code mismatch?) |

### CQL Evaluation Patterns

| Pattern | Normal | Concerning |
|---------|--------|------------|
| "Unable to determine" results | <10% | >30% |
| All guidelines showing "excluded" | Rare | Frequent (data issue) |
| Identical results for all patients | Never | Ever (logic bug) |

---

## Common Failure Modes to Watch

### 1. Silent Query Failures

**Symptom:** Recommendations always negative despite eligible patients

**Cause:** Query returns empty due to missing parameters (like Epic's category requirement)

**Detection:** Log query responses; empty bundle with 200 OK is suspicious

**Fix:** Add required parameters, check vendor documentation

### 2. Code System Mismatches

**Symptom:** Observations exist but CQL doesn't find them

**Cause:** EHR uses local codes or different code system than ValueSet expects

**Example:**
- CQL expects LOINC `72166-2` for tobacco status
- EHR stores as local code `TOBACCO-STATUS-001`

**Detection:** Log all codes in fetched resources; compare to ValueSet contents

**Fix:** Expand ValueSets or add code translation layer

### 3. Profile Mismatches

**Symptom:** Resources fetched but CQL retrieves return empty

**Cause:** CQL queries `[LaboratoryResultObservation: ...]` but resource lacks QICore profile

**Detection:** Log `meta.profile` of all fetched resources

**Fix:**
- Client-side CQL (cql-execution) is lenient — usually not an issue
- Server-side CQL (HAPI) is strict — may need profile-agnostic queries

### 4. Date/Time Edge Cases

**Symptom:** Recent procedures not recognized as "within last 2 years"

**Cause:** Timezone handling, date-only vs datetime, measurement period boundaries

**Detection:** Log effective dates and comparison results

**Fix:** Normalize to UTC, handle date-only gracefully

### 5. Missing Reference Data

**Symptom:** Guidelines requiring specific conditions can't find them

**Cause:** Condition recorded in problem list vs encounter diagnosis, different categories

**Detection:** Query all Condition categories, compare coverage

**Fix:** Expand Condition queries to include all categories

---

## Pilot Phases

### Phase 1: Shadow Mode (1-2 weeks)

- App runs alongside normal workflow
- Clinicians do NOT act on recommendations
- All results logged for analysis
- Goal: Identify data issues, false positives/negatives

**Success criteria:**
- [ ] No query failures
- [ ] Results match manual chart review for sample patients
- [ ] No PHI leakage

### Phase 2: Advisory Mode (2-4 weeks)

- Clinicians see recommendations
- Optional: "Was this helpful?" feedback button
- Still not driving clinical action
- Goal: Assess clinical relevance, usability

**Success criteria:**
- [ ] >80% of recommendations rated "appropriate" by clinicians
- [ ] No alert fatigue complaints
- [ ] Identify any false positives

### Phase 3: Active Use (ongoing)

- Recommendations integrated into workflow
- Outcomes tracked (screening completion rates)
- Continuous monitoring and improvement

**Success criteria:**
- [ ] Measurable improvement in screening rates
- [ ] Sustained clinician engagement
- [ ] No adverse events attributable to CDS

---

## Issue Response Protocol

### Severity Levels

| Level | Definition | Response Time |
|-------|------------|---------------|
| Critical | Wrong recommendation could cause harm | Immediate disable |
| High | Frequent false negatives (missing needed care) | 24 hours |
| Medium | False positives (unnecessary alerts) | 1 week |
| Low | UI/UX issues, minor data gaps | Next release |

### Issue Template

```
Date/Time:
Patient ID (de-identified):
Guideline:
Expected Result:
Actual Result:
Raw FHIR Data (relevant snippet):
CQL Evaluation Log:
Root Cause (if known):
Recommended Fix:
```

---

## Rollback Plan

If critical issues arise:

1. **Immediate:** Disable app launch from EHR (contact site IT)
2. **Short-term:** Revert to previous known-good version
3. **Communication:** Notify all pilot participants
4. **Analysis:** Conduct root cause analysis before re-enabling

---

## Post-Pilot Checklist

- [ ] Compile all logged issues and resolutions
- [ ] Calculate accuracy metrics (sensitivity, specificity per guideline)
- [ ] Gather clinician feedback (survey or interviews)
- [ ] Document site-specific configurations needed
- [ ] Update ValueSets/code mappings based on findings
- [ ] Write case study for publication
- [ ] Plan expansion to additional sites

---

## Site-Specific Configuration Template

```yaml
site_name: "Example Health System"
ehr_vendor: "Epic"
fhir_version: "R4"

# Observation query categories (Epic requires these)
observation_categories:
  - vital-signs
  - social-history
  - laboratory

# Local code mappings (if needed)
code_mappings:
  tobacco_status:
    local_system: "urn:oid:1.2.3.4.5"
    local_codes:
      - code: "CURRENT"
        maps_to: "449868002"  # SNOMED current smoker
      - code: "FORMER"
        maps_to: "8517006"    # SNOMED former smoker

# Enabled guidelines
enabled_guidelines:
  - BreastCancerScreening
  - CervicalCancerScreening
  - TobaccoCessation
  - ColorectalCancerScreening
  # Pregnancy guidelines only if OB department
  # - HepatitisBScreeningPregnancy
  # - SyphilisScreening
```

---

## References

- [SMART on FHIR Implementation Guide](http://hl7.org/fhir/smart-app-launch/)
- [US Core Profiles](http://hl7.org/fhir/us/core/)
- [QICore Profiles](http://hl7.org/fhir/us/qicore/)
- [CDS Hooks](https://cds-hooks.org/)
- [Epic FHIR Documentation](https://fhir.epic.com/)
