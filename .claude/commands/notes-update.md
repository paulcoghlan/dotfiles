---
allowed-tools: Read(~/notes/*), Edit(~/notes/*), Grep(~/notes/*), Glob(~/notes/*), Bash(date *)
description: Find and update an existing note in the Obsidian vault
argument-hint: <what to update — e.g. "add docker tip to crib/docker" or "add task to today's daily">
---

Find and update an existing note in the Obsidian vault at ~/notes based on: $ARGUMENTS

## Vault Structure

| Directory | Frontmatter | Key Patterns |
|-----------|-------------|--------------|
| `daily/` | None | `# YYYY-MM-DD`, sections: ## Projects, ## Tasks, ## Notes |
| `projects/` | None | `# Title`, heading-based sections |
| `crib/` | None | `# Topic`, ## sections with code blocks |
| `keep/` | `title, created, modified, tags` | Free-form body |
| `books/` | None | `# Title`, bullet-point notes |
| `www/`, `Readwise/`, `Snipd/`, `Clippings/` | Various | **EXTERNAL — do not edit** |

## Process

**Step 1: Find the target note**

Run these searches in parallel:

1. **Filename match**: Glob for `~/notes/**/*{keyword}*.md`
2. **Content match**: Grep for topic keywords in ~/notes (exclude www/, Readwise/, Snipd/, Clippings/)

Special cases:
- "today's daily note" or "daily" → `~/notes/daily/YYYY-MM-DD.md` (use `Bash(date +%Y-%m-%d)` for today)
- "yesterday" → compute yesterday's date
- A specific project name → search `~/notes/projects/`

If multiple matches: present top 3-5 candidates (filename + brief excerpt) and ask which one.
If no match: suggest using `/notes-create` instead.

**Step 2: Read the target note**

Use Read to load the full file. Understand its structure, headings, frontmatter, and formatting style.

**Step 3: Plan the edit**

- **Adding content**: find the correct section/heading to append under
- **Adding a task**: for daily notes, add under ## Tasks
- **Adding a tag**: for keep/ files, add to YAML `tags` list; for others, add inline `#tag`
- **Adding a backlink**: add `[[Reference]]` in context

**Step 4: Apply the edit**

Use the Edit tool. Be surgical — only change what is needed.

Rules:
- Preserve existing formatting and content exactly
- Never remove content unless explicitly asked
- For keep/ files: update the `modified` field to current timestamp (`Bash(date -u +%Y-%m-%dT%H:%M:%S+00:00)`)
- Match existing bullet style (-, *, numbered)
- Include language identifiers on code blocks

**Step 5: Confirm**

Show what was changed and the relevant section after the edit.

## Rules
- NEVER edit files in: www/, Readwise/, Snipd/, Clippings/ — these are managed by external tools and will be overwritten. If asked, warn the user and suggest creating a separate note with a backlink instead.
- NEVER delete content unless explicitly asked
- Use Edit (not Write) for existing files
- If a daily note doesn't exist yet, offer to create it first using the daily template
