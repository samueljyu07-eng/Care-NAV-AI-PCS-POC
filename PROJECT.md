# CareNav AI: PCS POC

## Purpose
A web app demo that helps people with post-concussion syndrome (PCS) navigate care.
A user fills in an intake form and receives three care pathways shown as a tree
diagram. Each step of a pathway slides open to show practitioners they can choose
from. This is a proof of concept for a demo, not a production medical product.

## Tech stack
- Next.js with TypeScript and Tailwind CSS
- React Flow for the tree diagram
- Claude API for generating pathways (called from a Next.js API route, added later)
- All data is synthetic. No real patient data is ever stored or sent.

## Current status
- Done: static intake form (city, concerns, primary symptoms checkboxes, past
  attempts) and an empty /results page.
- Next: placeholder practitioner data, sample pathway data, tree diagram UI.

## Intake data shape
{
  "address": "Kelowna, BC",
  "concerns": "free text",
  "primary_symptoms": ["headache", "dizziness"],
  "past_attempts": "free text"
}

## Pathway data shape
{
  "red_flag": false,
  "symptom_domains": ["vestibular", "ocular"],
  "rule_out_checklist": [
    { "item": "string", "why_it_matters": "string", "raise_with": "GP" }
  ],
  "pathways": [
    {
      "name": "string",
      "summary": "string",
      "supported_by": ["source name"],
      "steps": [
        { "order": 1, "title": "string", "practitioner_type": "vestibular_physio", "rationale": "string" }
      ]
    }
  ],
  "disclaimer": "string"
}

## Practitioner data shape
{
  "id": "p001",
  "name": "string",
  "practitioner_type": "vestibular_physio",
  "city": "Kelowna",
  "clinic": "string",
  "about": "2-3 sentences",
  "details": { "availability": "string", "languages": ["English"], "accepting_new_patients": true }
}

## Rules (always follow)
1. The app never diagnoses, prescribes, or promises outcomes.
2. Every results screen shows a medical disclaimer: outputs are navigation
   roadmaps to take to a GP, not medical advice.
3. Rule-out items are phrased as questions to raise with a doctor.
4. Red-flag screening uses hard-coded rules defined by a clinician, never the AI.
   The red-flag list is pending clinician review.
5. Practitioners are never ranked by payment. Relevance only.
6. Use only fictional names and clinics in placeholder data.

## Working style
- The developer has no coding experience. Explain what each file and change does
  in plain language.
- Make small changes and tell me how to test each one in the browser.
- Prefer simple solutions over clever ones.
