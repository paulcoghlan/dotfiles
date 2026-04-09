---
allowed-tools: Read(~/notes/*), Grep(~/notes/*), Glob(~/notes/*), Write(~/notes/*), Bash(date *)
description: Create a new note in the Obsidian vault
argument-hint: <description — e.g. "daily note" or "project for raspberry pi" or "keep note about docker networking">
---

Create a new note in the Obsidian vault at ~/notes based on: $ARGUMENTS

## Folder Conventions

| Directory | When to use | Naming | Frontmatter |
|-----------|------------|--------|-------------|
| `daily/` | Daily journal, "daily note" | `YYYY-MM-DD.md` | None |
| `projects/` | Ongoing technical project | `kebab-case.md` | None |
| `crib/` | Cheat sheet, quick reference | `kebab-case.md` | None |
| `keep/` | Resource, HOWTO, idea, general | Descriptive title `.md` | YAML: title, created, modified, tags |
| `books/` | Book notes | Book title `.md` | None |
| `areas/` | Area of focus | Descriptive title `.md` | None |
| `courses/` | Learning materials | `kebab-case.md` | None |

If ambiguous, default to `keep/`.

## Process

**Step 1: Determine note type and target folder** from $ARGUMENTS.

**Step 2: Check for duplicates** — use Glob and Grep to search for existing notes on the same topic. If a close match exists, tell the user and ask if they want to update it instead.

**Step 3: Generate filename** following the naming convention for the target folder.

**Step 4: Generate content** using the appropriate template:

**daily/**:
```
# YYYY-MM-DD

## Projects
- [ ]

## Tasks

- [ ]

## Notes
```

**projects/**:
```
# Project Title

## Overview

## Setup

## Notes
```

**crib/**:
```
# Topic Name

## Examples

## Common Operations

## Reference
```

**keep/**:
```
---
title: Note Title
created: YYYY-MM-DDTHH:MM:SS+00:00
modified: YYYY-MM-DDTHH:MM:SS+00:00
tags:
  - "Tag1"
---

Content here
```

**books/**:
```
# Book Title

## Key Takeaways

## Notes
```

Use `Bash(date -u +%Y-%m-%dT%H:%M:%S+00:00)` for timestamps.

**Step 5: Add cross-references** — if related notes were found during duplicate check, add `[[existing-note]]` backlinks.

**Step 6: Create the file** with Write. Confirm the file path and a summary of what was created.

## Rules
- NEVER overwrite an existing file — always check first
- NEVER create in synced directories: www/, Readwise/, Snipd/, Clippings/
- If a daily note already exists for the target date, offer to update it instead
- Keep generated content concise — the user will add more later
- Populate the template with any specific content from $ARGUMENTS
