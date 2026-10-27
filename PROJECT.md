# CareNav AI: PCS POC

## Purpose
A web app demo that helps people with post-concussion syndrome (PCS) navigate care.
One visit has three pages: an intake form, nine survey questions, and a care
pathway shown with the patient's answers. Pathways appear as cards and as a tree
diagram. Each card starts closed. Its header shows the pattern name, a Guideline
tag, how closely the answers match, and a small pie chart of that match. Opening
a card shows why it may apply and the numbered steps. In the tree, Simple mode
shows each step as a small colored tile. Clicking a tile opens the step details
and the sample practitioners they can choose from. This is a proof of
concept for a demo, not a production medical product.

## Tech stack
- Next.js with TypeScript and Tailwind CSS
- React Flow for the tree diagram
- lucide-react for the pictures on the Simple-mode tiles
- Claude API for generating pathways, called from the Next.js routes /api/pathways and /api/refine
- Zod to check that Claude's pathway reply matches the pathway data shape
- Vitest for tests
- All data is synthetic. No real patient data is ever stored or sent.

## Current status
- Done: the three-page visit described below, and the pathway builder.
  A hard-coded red-flag check runs first. If it finds an urgent warning, the
  page tells the person to get urgent care and does not build a pathway.
  Otherwise Claude builds the sections from the Primary symptoms checkboxes, one
  section for each symptom group, with no limit of three. Written concerns can
  add or change a section. If no symptoms are checked, the sections come from
  the written concerns and past attempts. Claude's reply is checked against the
  pathway data shape. If that check fails, the route tries once more, then shows
  a short error and does not show the raw reply. /api/refine then rewrites the
  explanations using the survey answers. It does not change the scores. Each
  tree step opens sample practitioners whose type matches the step, whose
  city matches the intake city (ignoring letter case), and whose age band
  matches the visit. They are listed by name. Payment is never used to sort them.
- The sample pathways in data/sample-pathways.json are still in the project.
  The results page no longer shows them for every visit.
- Next: clinician review of the hard-coded red-flag list.

## Visit flow
Answers for a visit stay in this browser tab. Closing the tab clears them.
Changing the intake and submitting again clears the survey answers.

1. Intake (`/`). The form collects city, age, timeline, primary symptoms, main
   concerns, and past attempts. Under 13 is not accepted. If the red-flag check
   finds urgent wording, the app skips the questions and opens the pathway page
   with the urgent-care message. Otherwise it opens the questions page. Back
   from the questions page returns here and keeps what was typed.
2. Nine questions (`/questions`). The questions come from
   data/survey-matrix.json. Questions that match the checked symptoms come
   first. If Light sensitivity was checked, the matching answer on question 7
   starts selected. Any question can be left blank. Answer text is centered.
   Continue saves the answers and opens the pathway page. Opening the pathway
   page before Continue, on a visit that is not urgent, sends the person back
   to these questions.
3. Care pathway (`/results`). This page shows the saved intake answers, the
   medical disclaimer, and the pathways. The nine questions are not on this
   page. Back returns to the questions so an answer can be changed and the
   pathway updates. On an urgent visit, Back returns to the intake.
   While the pathway is building, a progress bar sits under the disclaimer. It
   first says "Looking at the intake…", then "Building your care pathway…".
   The bar is a timer so the wait is visible. It is not a real percent from
   the server. Cards appear only after /api/refine finishes. If that rewrite
   fails, the first pathways are still shown and the scores still stand.
   Scoring is done in code, not by the AI. A score line looks like
   "Strong · 9 of 9 · 100%": a strength word when one applies, points out of
   the category maximum, and the percent. Each pathway card starts closed. The
   header keeps the name, the Guideline tag, that score line, a small pie chart
   of the percent (black for the match, light gray for the rest), and a
   chevron. Opening the card shows the explanation, the numbered steps, and
   the sources. Cards stay white. The pathway color is a small square and the
   card edge. The same color is used in the legend and on the tree tiles.
   The tree diagram is still below the cards.
   Above the tree, Simple and Detailed switch how much each step shows.
   Simple is the default. On a narrow screen it starts in Simple. Simple shows
   an 80-pixel rounded tile, one picture inside, and the step's short label
   underneath, on at most two lines. The picture comes from data/step-icons.json.
   If a step has no picture there, the tile uses the picture for its
   practitioner type. A pathway tile uses the same shape. Under it, the match
   word and a short bar replace a score such as "2 of 5 · 40%". Lines still
   connect the tiles, with a small dot at each connection. Detailed keeps the
   wider text boxes: the full step title and the practitioner type. Clicking
   a step opens one window. On a computer it starts in the center and can be
   dragged by the title bar. Step details are on the left and "Who offers this"
   is on the right. On a phone the same content is a bottom sheet: details
   first, then who offers it. The sheet scrolls. Close it with the close
   button, the Escape key, the same step, or the dimmed area. The window shows
   what the session involves, why it may help, a safety note when one exists,
   sources, and matching sample clinicians. Choosing a clinician shows six
   demo time slots. Confirm stays off until a slot is picked. Confirming shows
   the name, clinic, and time, then "Back to pathway" closes the window and
   turns that step green for this visit only. No personal details are collected.
   Nothing is stored, and no booking API is called. While draft steps are on,
   "Draft: pending clinician review" appears once at the top of the results
   page, and a Draft badge appears in the step window. It is not repeated on
   every tile or card step.

## Intake data shape
{
  "address": "Kelowna, BC",
  "concerns": "free text",
  "primary_symptoms": ["Headache", "Dizziness"],
  "past_attempts": "free text",
  "timeline": "1 week",
  "age_band": "18+"
}

age_band is "13-17" or "18+". Under 13 is not accepted. The form shows a short message and does not continue.

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

## Care step library (updated)

Category ids: fatigue_activity, exertional_symptoms, neuroendocrine, vestibular,
oculomotor, sensory_peripheral (see data/categories.json). Steps come from
data/care-steps.csv imported to data/care-steps.json. Each step also has a
short_label of 2 to 4 words. The app reads that label for the Simple tile. If
it is missing, the tile uses the full title. Sources are in data/sources.json.
data/step-icons.json maps each step_id to a lucide icon name. A few approved
pairs share one picture: VES-01 and VES-02, OCU-01 and OCU-03, SEN-01 and
SEN-02, and OCU-04 and SEN-04. The AI only chooses steps by step_id. It never
edits step text, short labels, or icons.

- source_title and source_url can hold several values separated by " ; ".
- claim_verification values: supported, partially supported, scope-limited,
  unsupported, contradicted. Never show unsupported or contradicted steps. For
  the others, show them in an expandable "Sources and limits" section with the
  source titles, links and limitations.
- Draft steps show "Draft: pending clinician review" once at the top of the
  results page while SHOW_DRAFT_STEPS is true, plus a Draft badge in the step window.
- Each path shows 2 to 4 steps. If fewer are available for the patient's age band,
  show what exists. Never invent steps.
- The red-flag wording in every safety_note and in the red-flag screen must come
  from one shared constant.
- Mechanisms are never stated to patients. Categories with mechanism null get no
  mechanism text at all.

## Practitioner data shape
{
  "id": "p001",
  "name": "string",
  "practitioner_type": "vestibular_physio",
  "city": "Kelowna",
  "clinic": "string",
  "about": "2-3 sentences",
  "details": { "availability": "string", "languages": ["English"], "accepting_new_patients": true },
  "sees_ages": ["teen", "adult"]
}

practitioner_type may also be gp_family_physician. sees_ages lists who that placeholder can see: "teen", "adult", or both.

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
