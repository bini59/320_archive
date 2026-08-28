---
name: gh-issue
description: Pull and refine a GitHub issue for bini59/320_archive, then hand it off for planning. Use when the user wants to start work from an issue, pull an issue, says "이슈 가져와" or "가져와", or names an issue number or URL.
---

# GitHub Issue Intake

Pull an issue, clarify its scope, and prepare it for planning. Work is tracked entirely as GitHub issues in **bini59/320_archive**.

## Steps

### 1. Pick or create the issue

- Named or linked issue: `gh issue view <number> --repo bini59/320_archive --comments`.
- Browsing: `gh issue list --repo bini59/320_archive --assignee @me --state open`; if needed, omit `--assignee` to list every open issue.
- No issue yet: show the user the proposed title and body, then create it with `gh issue create --repo bini59/320_archive` only after confirmation.

### 2. Read it fully

- Read the body and every comment with `gh issue view <number> --repo bini59/320_archive --comments`.
- Summarize the request, constraints, and unresolved questions.

### 3. Refine the scope

- Do not rush to planning. Use the available grilling and domain-modeling skills to resolve deliverables, acceptance criteria, affected areas, and ambiguity.
- Use the codebase or graphify for questions the repository can answer.
- Record material conclusions on the issue using `gh issue comment <number> --repo bini59/320_archive --body "..."`.

### 4. Hand off

Delegate to the `plan` agent with the refined scope, issue link, and affected-file notes. The plan agent determines the track and creates `tmp/TODO.md`; do not plan or implement inside this skill.

## Notes

- New work starts with a GitHub issue; no external tracker is used.
- Never create an issue before showing its proposed title and body.
