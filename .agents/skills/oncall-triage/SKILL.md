---
name: oncall-triage
description: Triage GitHub issues and label critical ones for oncall. Use when the user wants to triage bugs, find critical issues, or identify issues that need immediate oncall attention.
---

# Oncall Triage

Triage GitHub issues to identify critical ones that require immediate oncall attention and apply the "oncall" label.

## Steps

1. **Fetch recent high-engagement bugs**: Get all open bugs updated in the last 3 days with at least 50 engagements:

```bash
gh issue list --repo anthropics/claude-code --state open --label bug --limit 1000 --json number,title,updatedAt,comments,reactions | jq -r '.[] | select((.updatedAt >= (now - 259200 | strftime("%Y-%m-%dT%H:%M:%SZ"))) and ((.comments | length) + ([.reactions[].content] | length) >= 50)) | "\(.number)"'
```

2. **Create a checklist** of all issue numbers. Process every single one.

3. **Evaluate each issue**:
   - View full details: `gh issue view <number> --repo anthropics/claude-code --json title,body,labels,comments`
   - Read and understand the full content and comments to determine actual user impact
   - Ask: Is this truly blocking users from using Claude Code?
     - Look for: "crash", "stuck", "frozen", "hang", "unresponsive", "cannot use", "blocked", "broken"
     - Does it prevent core functionality? Can users work around it?
   - Be conservative. Only flag issues that truly prevent users from getting work done.

4. **Label blocking issues** that do not already have the "oncall" label:
   - `gh issue edit <number> --repo anthropics/claude-code --add-label "oncall"`

5. **Summarize results**:
   - List each issue number that received the "oncall" label
   - Include the issue title and brief reason why it qualified
   - If no issues qualified, state that clearly

## Rules

- Process ALL issues systematically
- Do not post any comments to issues
- Only add the "oncall" label, never remove it
- Use individual `gh issue view` commands instead of bash for-loops
