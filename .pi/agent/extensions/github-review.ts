/**
 * GitHub Review extension — review PRs with CI monitoring and approval.
 *
 * Provides:
 * - `/pr-review` slash command to start a PR review (checkout, code review, CI monitoring)
 * - `/pr-approve` slash command to approve the PR under review
 * - `/pr-review-end` slash command to end the review and switch back
 *
 * Workflow:
 * 1. Checkout the PR locally
 * 2. Agent reviews the code diff against the base branch
 * 3. Extension polls CI in the background — on failure, sends details to agent to fix
 * 4. Agent presents findings with manual verification items and areas of concern
 * 5. Approve the PR from pi when satisfied
 *
 * Requires `gh` CLI to be installed and authenticated.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text, type TUI, truncateToWidth } from "@mariozechner/pi-tui";

// ============================================================================
// Types
// ============================================================================

const PR_REVIEW_STATE = "github-review-state";

interface ReviewState {
  active: boolean;
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  title: string;
  originalBranch: string;
}

interface PrInfo {
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  body: string;
  url: string;
}

interface PrListItem {
  number: number;
  title: string;
  headRefName: string;
  author: { login: string };
}

type CiStatus = "passing" | "failing" | "pending";

interface CiCheck {
  name: string;
  status: CiStatus;
  detailsUrl?: string;
}

interface CiPollState {
  timer: ReturnType<typeof setTimeout> | null;
  checks: CiCheck[];
  pollCount: number;
  notifiedFailures: Set<string>;
  resolved: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CI_POLL_INTERVAL_MS = 30_000;
const CI_POLL_INITIAL_DELAY_MS = 10_000;
const CI_MAX_POLLS = 60; // 30 minutes max
const TITLE_MAX_LEN = 50;

// ============================================================================
// Pure helpers
// ============================================================================

function parsePrReference(ref: string): number | null {
  const trimmed = ref.trim();
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num > 0 && String(num) === trimmed) return num;
  const urlMatch = trimmed.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
  return urlMatch ? Number.parseInt(urlMatch[1], 10) : null;
}

function normalizeCheckRunStatus(status: string, conclusion: string): CiStatus {
  if (status !== "COMPLETED") return "pending";
  if (conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED") return "passing";
  return "failing";
}

function normalizeStatusContextState(state: string): CiStatus {
  if (state === "SUCCESS") return "passing";
  if (state === "ERROR" || state === "FAILURE") return "failing";
  return "pending";
}

function parseCiChecks(nodes: Array<Record<string, string>>): CiCheck[] {
  return nodes.map((node) => {
    if (node.__typename === "CheckRun") {
      return {
        name: node.name || "unknown",
        status: normalizeCheckRunStatus(node.status || "", node.conclusion || ""),
        detailsUrl: node.detailsUrl,
      };
    }
    return {
      name: node.context || node.name || "unknown",
      status: normalizeStatusContextState(node.state || ""),
      detailsUrl: node.targetUrl,
    };
  });
}

function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_LEN) return title;
  return `${title.slice(0, TITLE_MAX_LEN - 3)}...`;
}

function parseReviewArgs(args: string): { prRef: string | null; focus: string | undefined } {
  const trimmed = args.trim();
  if (!trimmed) return { prRef: null, focus: undefined };

  const dashDash = trimmed.indexOf("--");
  if (dashDash >= 0) {
    const refPart = trimmed.slice(0, dashDash).trim();
    const focusPart = trimmed.slice(dashDash + 2).trim() || undefined;
    return { prRef: refPart || null, focus: focusPart };
  }

  // First token might be a PR reference, rest is focus
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx >= 0) {
    const firstToken = trimmed.slice(0, spaceIdx);
    if (parsePrReference(firstToken) !== null) {
      return { prRef: firstToken, focus: trimmed.slice(spaceIdx + 1).trim() || undefined };
    }
  } else if (parsePrReference(trimmed) !== null) {
    return { prRef: trimmed, focus: undefined };
  }

  return { prRef: null, focus: trimmed };
}

// ============================================================================
// gh CLI helpers
// ============================================================================

type Exec = ExtensionAPI["exec"];

async function fetchPrInfo(exec: Exec, prNumber: number): Promise<PrInfo | null> {
  const { stdout, code } = await exec("gh", [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "number,title,baseRefName,headRefName,body,url",
  ]);
  if (code !== 0) return null;
  try {
    const data = JSON.parse(stdout);
    return {
      number: data.number,
      title: data.title,
      baseBranch: data.baseRefName,
      headBranch: data.headRefName,
      body: data.body || "",
      url: data.url || "",
    };
  } catch {
    return null;
  }
}

async function fetchOpenPrs(exec: Exec): Promise<PrListItem[]> {
  const { stdout, code } = await exec("gh", [
    "pr",
    "list",
    "--state",
    "open",
    "--json",
    "number,title,headRefName,author",
    "--limit",
    "30",
  ]);
  if (code !== 0) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

async function fetchCiChecks(exec: Exec, prNumber: number): Promise<CiCheck[]> {
  const { stdout, code } = await exec("gh", ["pr", "view", String(prNumber), "--json", "statusCheckRollup"]);
  if (code !== 0) return [];
  try {
    const data = JSON.parse(stdout);
    return parseCiChecks(data.statusCheckRollup || []);
  } catch {
    return [];
  }
}

async function getCurrentBranch(exec: Exec): Promise<string | null> {
  const { stdout, code } = await exec("git", ["branch", "--show-current"]);
  return code === 0 && stdout.trim() ? stdout.trim() : null;
}

async function getMergeBase(exec: Exec, branch: string): Promise<string | null> {
  const { stdout: upstream, code: upCode } = await exec("git", ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`]);
  if (upCode === 0 && upstream.trim()) {
    const { stdout: mb, code } = await exec("git", ["merge-base", "HEAD", upstream.trim()]);
    if (code === 0 && mb.trim()) return mb.trim();
  }
  const { stdout: mb, code } = await exec("git", ["merge-base", "HEAD", branch]);
  return code === 0 && mb.trim() ? mb.trim() : null;
}

async function hasPendingChanges(exec: Exec): Promise<boolean> {
  const { stdout, code } = await exec("git", ["status", "--porcelain"]);
  if (code !== 0) return false;
  return stdout
    .trim()
    .split("\n")
    .some((line) => line.trim() && !line.startsWith("??"));
}

async function isGitRepo(exec: Exec): Promise<boolean> {
  const { code } = await exec("git", ["rev-parse", "--git-dir"]);
  return code === 0;
}

// ============================================================================
// Review prompt
// ============================================================================

function buildReviewPrompt(pr: PrInfo, mergeBase: string | null, customFocus?: string): string {
  const diffInstructions = mergeBase
    ? `Run \`git diff ${mergeBase}\` to see the changes being merged.`
    : `Find the merge base: \`git merge-base HEAD ${pr.baseBranch}\`, then \`git diff <merge-base>\`.`;

  const focusSection = customFocus ? `\n**Review focus:** ${customFocus}\n` : "";

  return `You are reviewing PR #${pr.number} ("${pr.title}") against '${pr.baseBranch}'.
URL: ${pr.url}
${focusSection}
## Code Review

${diffInstructions}

Review criteria:
- Flag issues impacting correctness, performance, security, or maintainability
- Only flag issues introduced in this PR, not pre-existing code
- Tag each finding [P0]-[P3]:
  [P0] Blocking — drop everything to fix
  [P1] Urgent — must fix in this PR
  [P2] Normal — fix eventually
  [P3] Low — nice to have
- Include file paths and line numbers
- Keep comments brief and actionable
- Be specific about why something is a problem and what should change
- Don't flag trivial style issues unless they obscure meaning
- Call out new dependencies explicitly
- Prefer fail-fast over logging-and-continue
- Ensure errors are checked against codes, not error messages

## Review Summary

Present your review in this structure:

### Findings
For each finding:
- **[P_] \`file:line\`** — what's wrong, why it matters, what to change

If no issues found, state explicitly that the code looks good.

### Manual Verification
Items I should check that can't be verified by reading code alone:
- UI/visual changes
- Performance under realistic load
- Data migration correctness
- Third-party integration behavior
- Edge cases dependent on production state

State "None" if not applicable.

### Areas of Concern
Code that is correct but deserves extra scrutiny — complex logic, security-sensitive operations, subtle behavioral changes.

State "None" if not applicable.

### Verdict
**approve** (no P0/P1 issues) or **needs attention** (blocking issues remain).

Note: CI is being monitored in the background. If checks fail, you will receive a follow-up message with failure details to investigate and fix.`;
}

// ============================================================================
// Extension
// ============================================================================

export default function githubReviewExtension(pi: ExtensionAPI) {
  const exec = pi.exec.bind(pi);

  // -- Module state --
  let review: ReviewState | null = null;
  let ciPoll: CiPollState | null = null;
  let widgetTui: TUI | null = null;

  // -- State persistence --

  function getPersistedState(ctx: ExtensionContext): ReviewState | null {
    let state: ReviewState | null = null;
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === PR_REVIEW_STATE) {
        const data = entry.data as ReviewState | undefined;
        state = data?.active ? data : null;
      }
    }
    return state;
  }

  function persistState() {
    pi.appendEntry(PR_REVIEW_STATE, review ? { ...review } : { active: false });
  }

  // -- Widget --

  function setReviewWidget(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;

    if (!review) {
      ctx.ui.setWidget("github-review", undefined);
      return;
    }

    const prNum = review.prNumber;
    const prTitle = truncateTitle(review.title);

    ctx.ui.setWidget("github-review", (tui, theme) => {
      widgetTui = tui;
      return {
        render(width: number) {
          const sep = "  ";
          const parts: string[] = [];

          // PR indicator: icon + number + title
          parts.push(`${theme.fg("accent", `\uf407 #${prNum}`)} ${theme.fg("dim", prTitle)}`);

          // CI status with per-status icons
          if (ciPoll?.checks.length) {
            const checks = ciPoll.checks;
            const passing = checks.filter((c) => c.status === "passing").length;
            const failing = checks.filter((c) => c.status === "failing").length;
            const pending = checks.filter((c) => c.status === "pending").length;

            const ciParts: string[] = [];
            if (passing) ciParts.push(theme.fg("success", `\uf00c ${passing}`));
            if (failing) ciParts.push(theme.fg("error", `\uf00d ${failing}`));
            if (pending) ciParts.push(theme.fg("warning", `\uf252 ${pending}`));

            if (ciParts.length) parts.push(ciParts.join(" "));
          }

          // Command hints
          parts.push(theme.fg("dim", "/pr-approve  /pr-review-end"));

          return [truncateToWidth(parts.join(sep), width)];
        },
        invalidate() {},
      };
    });
  }

  // -- CI polling --

  function startCiPolling(prNumber: number, headBranch: string) {
    stopCiPolling();
    ciPoll = {
      timer: null,
      checks: [],
      pollCount: 0,
      notifiedFailures: new Set(),
      resolved: false,
    };
    ciPoll.timer = setTimeout(() => runPoll(prNumber, headBranch), CI_POLL_INITIAL_DELAY_MS);
  }

  function stopCiPolling() {
    if (ciPoll?.timer) clearTimeout(ciPoll.timer);
    ciPoll = null;
  }

  function schedulePoll(prNumber: number, headBranch: string) {
    if (!ciPoll || ciPoll.resolved || ciPoll.pollCount >= CI_MAX_POLLS) return;
    ciPoll.timer = setTimeout(() => runPoll(prNumber, headBranch), CI_POLL_INTERVAL_MS);
  }

  async function runPoll(prNumber: number, headBranch: string) {
    if (!ciPoll || ciPoll.resolved) return;
    ciPoll.pollCount++;

    const checks = await fetchCiChecks(exec, prNumber);
    if (!ciPoll) return; // review ended while fetching

    const previous = ciPoll.checks;
    ciPoll.checks = checks;

    if (checks.length === 0) {
      schedulePoll(prNumber, headBranch);
      return;
    }

    // Clear notifications for restarted checks (failing -> pending)
    for (const check of checks) {
      if (check.status === "pending") {
        const prev = previous.find((c) => c.name === check.name);
        if (prev?.status === "failing") {
          ciPoll.notifiedFailures.delete(check.name);
        }
      }
    }

    // Batch new failures
    const newFailures = checks.filter((c) => c.status === "failing" && !ciPoll?.notifiedFailures.has(c.name));

    if (newFailures.length > 0) {
      for (const f of newFailures) ciPoll.notifiedFailures.add(f.name);

      const failureList = newFailures.map((f) => `- ${f.name}`).join("\n");
      const failureText =
        newFailures.length === 1
          ? `CI check "${newFailures[0].name}" is failing on PR #${prNumber}.`
          : `${newFailures.length} CI checks are failing on PR #${prNumber}:\n${failureList}`;

      pi.sendMessage(
        {
          customType: "github-review-ci",
          content:
            `${failureText}\n\nInvestigate and fix:\n` +
            `1. Find failing runs: \`gh run list --branch ${headBranch} --status failure --json databaseId,name --limit 5\`\n` +
            `2. View logs: \`gh run view <id> --log-failed\`\n` +
            `3. Fix the issue, commit, and push (confirm with me before pushing)\n\n` +
            `CI will be re-checked automatically after pushing.`,
          display: true,
        },
        { triggerTurn: true, deliverAs: "followUp" },
      );
    }

    // All passing
    if (checks.every((c) => c.status === "passing")) {
      ciPoll.resolved = true;
      pi.sendMessage(
        {
          customType: "github-review-ci",
          content: `All CI checks passing on PR #${prNumber}.`,
          display: true,
        },
        { triggerTurn: false },
      );
    }

    widgetTui?.requestRender();

    if (!ciPoll.resolved && ciPoll.pollCount < CI_MAX_POLLS) {
      schedulePoll(prNumber, headBranch);
    }
  }

  // -- PR selector --

  async function showPrSelector(ctx: ExtensionContext): Promise<number | null> {
    const prs = await fetchOpenPrs(exec);
    if (prs.length === 0) {
      ctx.ui.notify("No open pull requests found.", "info");
      return null;
    }

    const items: SelectItem[] = prs.map((pr) => ({
      value: String(pr.number),
      label: `#${pr.number} ${pr.title}`,
      description: `${pr.headRefName} by @${pr.author.login}`,
    }));

    return ctx.ui.custom<number | null>((tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
      container.addChild(new Text(theme.fg("accent", theme.bold("Select a pull request to review"))));

      const selectList = new SelectList(items, Math.min(items.length, 10), {
        selectedPrefix: (text) => theme.fg("accent", text),
        selectedText: (text) => theme.fg("accent", text),
        description: (text) => theme.fg("muted", text),
        scrollInfo: (text) => theme.fg("dim", text),
        noMatch: (text) => theme.fg("warning", text),
      });
      selectList.searchable = true;
      selectList.onSelect = (item) => done(Number.parseInt(item.value, 10));
      selectList.onCancel = () => done(null);

      container.addChild(selectList);
      container.addChild(new Text(theme.fg("dim", "Type to filter \u2022 Enter select \u2022 Esc cancel")));
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      return {
        render(width: number) {
          return container.render(width);
        },
        invalidate() {
          container.invalidate();
        },
        handleInput(data: string) {
          selectList.handleInput(data);
          tui.requestRender();
        },
      };
    });
  }

  // -- Session lifecycle --

  pi.on("session_start", (_event, ctx) => {
    const persisted = getPersistedState(ctx);
    if (persisted) {
      review = persisted;
      startCiPolling(persisted.prNumber, persisted.headBranch);
    } else {
      review = null;
      stopCiPolling();
    }
    setReviewWidget(ctx);
  });

  // -- /pr-review --

  pi.registerCommand("pr-review", {
    description: "Review a GitHub PR (checkout, code review, CI monitoring)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("PR review requires interactive mode.", "error");
        return;
      }
      if (review) {
        ctx.ui.notify(`Already reviewing PR #${review.prNumber}. Use /pr-review-end first.`, "warning");
        return;
      }
      if (!(await isGitRepo(exec))) {
        ctx.ui.notify("Not a git repository.", "error");
        return;
      }

      const { prRef, focus } = parseReviewArgs(args);
      let prNumber = prRef ? parsePrReference(prRef) : null;

      if (!prNumber) {
        prNumber = await showPrSelector(ctx);
        if (!prNumber) {
          ctx.ui.notify("Review cancelled.", "info");
          return;
        }
      }

      if (await hasPendingChanges(exec)) {
        ctx.ui.notify("Uncommitted changes to tracked files. Commit or stash first.", "error");
        return;
      }

      ctx.ui.notify(`Fetching PR #${prNumber}...`, "info");
      const prInfo = await fetchPrInfo(exec, prNumber);
      if (!prInfo) {
        ctx.ui.notify(`PR #${prNumber} not found. Check gh auth and PR existence.`, "error");
        return;
      }

      const originalBranch = (await getCurrentBranch(exec)) || "main";

      ctx.ui.notify(`Checking out PR #${prNumber} (${prInfo.headBranch})...`, "info");
      const checkout = await exec("gh", ["pr", "checkout", String(prNumber)]);
      if (checkout.code !== 0) {
        ctx.ui.notify(`Checkout failed: ${checkout.stderr || checkout.stdout}`, "error");
        return;
      }

      const mergeBase = await getMergeBase(exec, prInfo.baseBranch);

      review = {
        active: true,
        prNumber,
        baseBranch: prInfo.baseBranch,
        headBranch: prInfo.headBranch,
        title: prInfo.title,
        originalBranch,
      };
      persistState();
      setReviewWidget(ctx);
      startCiPolling(prNumber, prInfo.headBranch);

      ctx.ui.notify(`Reviewing PR #${prNumber}: ${prInfo.title}`, "info");
      pi.sendUserMessage(buildReviewPrompt(prInfo, mergeBase, focus));
    },
  });

  // -- /pr-approve --

  pi.registerCommand("pr-approve", {
    description: "Approve the PR under review",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Requires interactive mode.", "error");
        return;
      }
      if (!review) {
        ctx.ui.notify("No active PR review. Start one with /pr-review.", "info");
        return;
      }

      const comment = args.trim() || undefined;
      const hint = comment ? ` with: "${comment}"` : "";
      const confirmed = await ctx.ui.confirm("Approve PR", `Approve PR #${review.prNumber} ("${review.title}")${hint}?`);
      if (!confirmed) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }

      const approveArgs = ["pr", "review", String(review.prNumber), "--approve"];
      if (comment) approveArgs.push("--body", comment);

      const result = await exec("gh", approveArgs);
      if (result.code !== 0) {
        ctx.ui.notify(`Approval failed: ${result.stderr || result.stdout}`, "error");
        return;
      }

      ctx.ui.notify(`PR #${review.prNumber} approved.`, "info");
    },
  });

  // -- /pr-review-end --

  pi.registerCommand("pr-review-end", {
    description: "End the PR review and switch back",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Requires interactive mode.", "error");
        return;
      }
      if (!review) {
        ctx.ui.notify("No active PR review.", "info");
        return;
      }

      const { prNumber, originalBranch } = review;
      const confirmed = await ctx.ui.confirm("End Review", `End review of PR #${prNumber} and switch to '${originalBranch}'?`);
      if (!confirmed) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }

      stopCiPolling();

      const { code, stderr } = await exec("git", ["checkout", originalBranch]);
      if (code !== 0) {
        ctx.ui.notify(`Switch to ${originalBranch} failed: ${stderr}. Review state cleared anyway.`, "warning");
      }

      review = null;
      persistState();
      setReviewWidget(ctx);
      ctx.ui.notify(`Review of PR #${prNumber} ended.`, "info");
    },
  });
}
