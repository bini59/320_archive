---
name: gh-issue
description: Pull a GitHub issue from bini59/320_archive, read its body and comments, refine its scope with the user, then hand off to the planner. Trigger when the user wants to start work from an issue, "pull an issue", "이슈 가져와", "가져와", or names an issue number or URL.
---

# GitHub Issue Intake

Pull an issue → clarify → refine the scope → planner. Work is tracked entirely as GitHub issues in **bini59/320_archive**; this skill carries one issue from picked to ready-to-plan.

## Steps

### 1. Pick or create the issue

- Named or linked issue: `gh issue view <number> --repo bini59/320_archive --comments`.
- Browsing: `gh issue list --repo bini59/320_archive --assignee @me --state open`; if needed, drop `--assignee` to list every open issue.
- No issue yet: show the user the proposed title and body, then create it with `gh issue create --repo bini59/320_archive` only after confirmation.

### 2. Read it fully

- Read the body and every comment with `gh issue view <number> --repo bini59/320_archive --comments`.
- Summarize the request, constraints, and unresolved questions.

### 3. Refine the scope

- Do not rush to planning. Use `$grill-with-docs` (grilling and domain-modeling) to resolve deliverables, acceptance criteria, affected areas, and ambiguity.
- Use the codebase or graphify for questions the repository can answer.
- Record material conclusions on the issue using `gh issue comment <number> --repo bini59/320_archive --body "..."`.

### 4. Hand off

Delegate to the `planner` with the refined scope, issue link, and affected-file notes. The planner determines the track and creates `tmp/TODO.md`; do not plan or implement inside this skill.

## Notes

- New work starts with a GitHub issue; no external tracker is used.
- Never create an issue before showing its proposed title and body.
