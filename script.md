Here's the reconstructed 10-slide script. The audience is Iowa Family Medicine / Implementation Science researchers.                                               
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 1 — Title                                                                                                                                                    
                                                                                                                                                                     
  A Customizable, Point-of-Care Clinical Reminder System                                                                                                             
  13 USPSTF Preventive Screening Guidelines as a SMART on FHIR Application                                                                                           
                                                                                                                                                                     
  Dan Heslinga, MD                                                                                                                                                   
  Hopena Health                                                                                                                                                      
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 2 — The Problem                                                                                                                                              
                                                                                                                                                                     
  Independent primary care practices on lighter-weight EHRs often lack real-time, guideline-driven clinical decision support. Large health systems on Epic or Cerner 
  have built-in reminders. Everyone else gets retrospective quality reports — after the patient has left.                                                            
                                                                                                                                                                     
  What if the reminders fired while the patient was still in the room?                                                                                               
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 3 — Clinical Vignette                                                                                                                                        
                                                                                                                                                                     
  Maria is a 28-year-old woman presenting for her first prenatal visit. She has no significant past medical history. No prior screening results are on file.         
                                                                                                                                                                     
  What preventive services should be addressed at this visit?                                                                                                        
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 4 — Pause                                                                                                                                                    
                                                                                                                                                                     
  Take a moment. How many USPSTF-recommended screenings or interventions apply to Maria right now?                                                                   
                                                                                                                                                                     
  (Scroll down when you're ready.)                                                                                                                                   
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 5 — Maria's Results                                                                                                                                          
                                                                                                                                                                     
  [Embedded video clip: ~30 seconds. SmartHealthIT launch → Maria's 10 guidelines appear. Slow scroll through the list.]                                             
                                                                                                                                                                     
  The app identified 10 applicable USPSTF guidelines for Maria — including 5 pregnancy-specific screenings that would not appear for a non-pregnant patient.         
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 6 — Inside a Recommendation                                                                                                                                  
                                                                                                                                                                     
  [Embedded video clip: ~15 seconds. Click to expand one panel — Syphilis Screening — showing the decision factors.]                                                 
                                                                                                                                                                     
  Each recommendation shows the clinical reasoning: what data was evaluated, what triggered the recommendation, and why. Every factor traces to a specific USPSTF    
  statement.                                                                                                                                                         
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 7 — Portability                                                                                                                                              
                                                                                                                                                                     
  The same application — identical code, no modifications — runs against any FHIR-compliant EHR. Here it is launched from an Epic provider session.                  
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 8 — Anna Cadence (Epic)                                                                                                                                      
                                                                                                                                                                     
  [Embedded video clip: ~20 seconds. Epic provider launch → Anna Cadence, 42F pregnant → 11 guidelines. Brief scroll.]                                               
                                                                                                                                                                     
  Anna is 42 — she gets everything Maria gets, plus Breast Cancer Screening (USPSTF recommends mammography ages 40-74). The app adapted automatically based on age   
  and clinical data from Epic's FHIR API.                                                                                                                            
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 9 — How It Works                                                                                                                                             
                                                                                                                                                                     
  - 13 USPSTF guidelines translated from narrative recommendations to executable logic                                                                               
  - CQL (Clinical Quality Language) — the HL7 standard used by CMS quality measures                                                                                  
  - SMART on FHIR — runs inside any compliant EHR without custom integration                                                                                         
  - Client-side execution — no patient data leaves the browser (~500ms)                                                                                              
  - Open source — methodology and code available for review                                                                                                          
                                                                                                                                                                     
  ---                                                                                                                                                                
  Slide 10 — Next Steps                                                                                                                                              
                                                                                                                                                                     
  This system is technically ready for pilot deployment. What's needed is a clinical home — a practice willing to run it alongside their workflow and evaluate its   
  impact on screening rates.                                                                                                                                         
                                                                                                                                                                     
  If this aligns with your research interests, I'd welcome a conversation.                                                                                           
                                                                                                                                                                     
  dan@hopena.info | hopena.info                                                                                                                                      
                                                                                                                                                                     
  ---                                                                                                                                                                
  Three video clips total, maybe 65 seconds of recording. The rest is static text the viewer reads at their own pace. Thoughts?                                      
                                                                                                                                      