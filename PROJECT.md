# CareNav AI: PCS POC

## Purpose
A web app demo that helps people with post-concussion syndrome (PCS) navigate care.
A user fills in an intake form and receives care pathways shown as a tree
diagram. Each step of a pathway slides open to show practitioners they can choose
from. This is a proof of concept for a demo, not a production medical product.

## Tech stack
- Next.js with TypeScript and Tailwind CSS
- React Flow for the tree diagram
- Claude API for generating pathways, called from the Next.js route /api/pathways
- Zod to check that Claude's pathway reply matches the pathway data shape
- Vitest for tests
- All data is synthetic. No real patient data is ever stored or sent.

## Current status
- Done: intake form, and the /results tree UI with practitioner panels. Submitting
  the form saves the answers for this visit. The results page asks /api/pathways
  for pathways. A hard-coded red-flag check runs first. If it finds an urgent
  warning, the page tells the person to get urgent care and does not build a
  pathway. Otherwise Claude builds the sections from the Primary symptoms
  checkboxes, one section for each symptom group, with no limit of three. Written
  concerns can add or change a section. If no symptoms are checked, the sections
  come from the written concerns and past attempts. Claude's reply is checked
  against the pathway data shape. If that check fails, the route tries once more,
  then shows a short error and does not show the raw reply. Each step opens
  sample practitioners whose type matches the step and whose city matches the
  intake city, ignoring letter case.
- The sample pathways in data/sample-pathways.json are still in the project.
  The results page no longer shows them for every visit.
- Next: clinician review of the hard-coded red-flag list.

## Intake data shape
{
  "address": "Kelowna, BC",
  "concerns": "free text",
  "primary_symptoms": ["Headache", "Dizziness"],
  "past_attempts": "free text",
  "timeline": "1 week"
}

primary_symptoms are the checked Primary symptoms labels. timeline is context
only. It does not create a pathway section by itself.

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

pathways has one entry for each symptom group. It is not fixed at three.

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
