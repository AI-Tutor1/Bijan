# Mode: stage — Pre-fill Application Form (no auto-submit)

The Bijan portal's "Approve" action invokes this mode end-to-end. It never submits — the user always clicks Submit themselves.

## Pipeline

```text
1. LOAD       → Read job + report from Supabase. Confirm score & archetype.
2. TAILOR CV  → Run `pdf` mode. Upload PDF to Supabase Storage `cvs/`. Insert row in `cv_versions`.
3. ANSWERS    → Run `apply` mode. Insert each Q&A pair into `form_answers`.
4. STAGE      → `node stage-form.mjs <job_id>`. Playwright opens form pre-filled, visible.
5. STOP       → Print "Form pre-filled. Review and click Submit yourself."
6. POST-SUBMIT → User clicks Submit in the browser, then clicks "Mark applied" in the portal. The portal updates `applications.status` to `applied` and `applied_at` to now.
```

## Critical rules

- **Never click submit, apply, send, or any equivalent.** The agent and the script are forbidden from triggering form submission.
- **Visible browser only.** Headless mode would defeat the purpose — the user must see the page to verify.
- **Highlight unfilled fields.** If a field has no matching answer, the script must add a visual indicator (red outline) and list it in the terminal output so the user knows what to fill.
- **CV upload, if present.** If the form has a file input labeled resume/cv/curriculum and the latest `cv_versions.pdf_path` exists, attach it via `setInputFiles`. Otherwise leave it for the user.
- **Idempotent on re-run.** If the user closes the browser without submitting, re-running `stage-form.mjs <job_id>` should reproduce the same pre-filled state.

## Data contract

`stage-form.mjs` reads from Supabase:

| Table | Filter | Used for |
|-------|--------|----------|
| `jobs` | `id = $1` | source_url to navigate |
| `form_answers` | `job_id = $1` | question/answer pairs |
| `cv_versions` | `job_id = $1`, latest | pdf_path for CV upload |

If `form_answers` is empty, the script should still navigate and warn: "No form_answers for this job. Run `apply` mode first." If `cv_versions` is empty, skip the file-upload step and warn similarly.

## Field-matching strategy

For each visible form field, the script collects label hints in this order: `aria-label` → associated `<label>` text → `placeholder` → `name` attribute → nearest preceding `<label>` or text node.

It compares that label (lowercased, tokenized) against each `form_answers.question` (lowercased, tokenized) using Jaccard token overlap. Threshold: ≥0.4 overlap. The best match wins; ties are skipped (highlighted instead).

## Coverage caveats

- **Greenhouse / Lever / Ashby:** native HTML inputs — high fill rate (>80%).
- **Workday / Taleo:** custom React widgets — partial fill, expect to handle some fields manually.
- **LinkedIn EasyApply:** fragile DOM, login walls, multi-step modals — best to stage manually for now and use this mode only when LinkedIn redirects to the company's ATS.
