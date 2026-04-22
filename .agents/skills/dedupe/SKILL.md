---
name: dedupe
description: Find up to 3 likely duplicate GitHub issues for a given issue. Use when the user wants to find duplicates, deduplicate issues, or check if an issue has already been reported.
---

# Find Duplicate GitHub Issues

Find up to 3 likely duplicate issues for a given GitHub issue.

## Steps

1. **Check eligibility**: View the GitHub issue and determine if it (a) is closed, (b) does not need to be deduped (e.g. because it is broad product feedback without a specific solution, or positive feedback), or (c) already has a duplicates comment. If so, do not proceed.

2. **Summarize the issue**: Read the full issue and produce a concise summary of the problem.

3. **Search for duplicates**: Run 5 parallel searches using `gh search issues` with diverse keywords and search approaches derived from the summary.

4. **Filter false positives**: Review all search results against the original issue. Discard anything that is not a genuine duplicate. If no duplicates remain, stop here.

5. **Comment on the issue**: Post a comment listing up to three duplicates in this exact format:

```
Found N possible duplicate issues:

1. <link to issue>
2. <link to issue>
3. <link to issue>

This issue will be automatically closed as a duplicate in 3 days.

- If your issue is a duplicate, please close it and 👍 the existing issue instead
- To prevent auto-closure, add a comment or 👎 this comment
```

## Notes

- Use `gh` for all GitHub interactions (not web fetch or other tools)
- Do not use file edit tools or other unrelated tools
- Only comment if at least one likely duplicate is found
