---
allowed-tools: Grep(~/notes/*), Glob(~/notes/*), Read(~/notes/*)
description: Search Obsidian vault by content, filenames, or tags
argument-hint: <search query — keywords, tag name, or topic>
---

Search the Obsidian vault at ~/notes for: $ARGUMENTS

## Vault Structure

| Directory | Content |
|-----------|---------|
| `daily/` | Daily journal notes (YYYY-MM-DD.md) |
| `projects/` | Active project docs |
| `crib/` | Quick reference / cheat sheets |
| `keep/` | Saved resources, HOWTOs, ideas (YAML frontmatter with tags) |
| `books/` | Book notes |
| `areas/` | Areas of focus |
| `courses/` | Learning materials |
| `www/` | Web clippings |
| `Readwise/` | Synced book/article highlights |
| `Snipd/` | Podcast transcripts (rich YAML frontmatter) |
| `Clippings/` | Web clippings |

## Search Strategy

**Step 1: Interpret the query**

Analyze $ARGUMENTS:
- If it looks like a tag (starts with # or is a single word), also search YAML `tags:` arrays and inline `#tags`
- If it mentions a book, podcast, or article, prioritize Readwise/, Snipd/, books/
- If it looks like a date, focus on daily/ notes

**Step 2: Run parallel searches**

Run ALL of these in a single message:

1. **Filename search**: Glob for `~/notes/**/*{query}*.md`
2. **Content search**: Grep for query terms in ~/notes with output_mode "content", context of 2 lines, limit 20 results
3. **Tag search** (if relevant): Grep for YAML tags (`tags:.*query` or list items under tags) and inline `#query`

**Step 3: Present results**

Group results by vault section. For each match show:
- File path relative to ~/notes/
- 1-2 lines of match context
- For Snipd/Readwise files, include show name or author from metadata

If >10 results, summarize by section and highlight the top 5 most relevant.
If no results, suggest alternative search terms.

**Step 4: Offer to read**

Ask if the user wants to read any specific file in full.

## Rules
- Never modify any files
- Use Grep and Glob, not Bash, for searching
- Wiki-style backlinks look like [[reference]] — search for these too when relevant
