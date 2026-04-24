/**
 * Powerline Footer Extension
 *
 * A minimal powerline-style footer showing model, git branch, tokens, cost,
 * and context usage. Requires a Nerd Font for powerline separator glyphs.
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// Powerline glyphs (need a Nerd Font)
const SEP = "\uE0B0";       // right-pointing solid arrow
const SEP_LEFT = "\uE0B2";  // left-pointing solid arrow (for right-aligned segments)
const BRANCH = "\uE0A0";    // git branch icon
const PR_ICON = "\uF407";   // pull request icon (nerd font)
const TOOL_ICON = "\uF0AD"; // wrench icon (nerd font)

// ANSI helpers for 256-color backgrounds and foregrounds
const ansiFg = (color: number, text: string) => `\x1b[38;5;${color}m${text}\x1b[0m`;
const ansiBg = (color: number, text: string) => `\x1b[48;5;${color}m${text}\x1b[0m`;
const ansiFgBg = (fg: number, bg: number, text: string) => `\x1b[38;5;${fg};48;5;${bg}m${text}\x1b[0m`;

// Segment color palette (256-color indices)
const COLORS = {
	modelBg: 236,   modelFg: 252,   // dark gray - model
	branchBg: 238,  branchFg: 223,  // warm gray - git branch
	tokensBg: 239,  tokensFg: 250,  // medium gray - tokens
	costBg: 237,    costFg: 245,    // darker gray - cost
	ctxBg: 234,     ctxFg: 245,     // darkest gray - context
	ctxBarFull: 70,                 // green for filled portion
	ctxBarEmpty: 240,               // dim for empty portion
	sessionBg: 24,  sessionFg: 117, // blue - session identity
	toolsBg: 236,   toolsFg: 244,   // neutral - active tools
	turnBg: 238,    turnFg: 150,    // subtle green - current turn delta
};

// Thinking level colors and labels
// Bg colors tint toward the level's identity color
const THINKING: Record<string, { label: string; fg: number; bg: number }> = {
	off:     { label: "○ off",     fg: 245, bg: 236 },  // gray
	minimal: { label: "◔ min",     fg: 147, bg: 60  },  // muted blue
	low:     { label: "◑ low",     fg: 117, bg: 25  },  // blue
	medium:  { label: "◕ med",     fg: 123, bg: 30  },  // cyan
	high:    { label: "● high",    fg: 207, bg: 90  },  // magenta
	xhigh:   { label: "⬤ xhigh",   fg: 210, bg: 124 },  // red
};

type Segment = { text: string; fg: number; bg: number; link?: string };

/** Render a run of left-aligned segments joined by right-pointing separators. */
function renderLeftSegments(segments: Segment[]): string {
	let result = "";
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const nextBg = i < segments.length - 1 ? segments[i + 1].bg : -1;

		const content = ansiFgBg(seg.fg, seg.bg, ` ${seg.text} `);
		result += seg.link ? hyperlink(seg.link, content) : content;

		if (nextBg >= 0) {
			result += ansiFgBg(seg.bg, nextBg, SEP);
		} else {
			result += ansiFg(seg.bg, SEP);
		}
	}
	return result;
}

/** Render a run of right-aligned segments joined by left-pointing separators. */
function renderRightSegments(segments: Segment[]): string {
	let result = "";
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const prevBg = i > 0 ? segments[i - 1].bg : -1;

		// Separator: fg = current bg, bg = previous bg (or reset)
		if (prevBg >= 0) {
			result += ansiFgBg(seg.bg, prevBg, SEP_LEFT);
		} else {
			result += ansiFg(seg.bg, SEP_LEFT);
		}

		const content = ansiFgBg(seg.fg, seg.bg, ` ${seg.text} `);
		result += seg.link ? hyperlink(seg.link, content) : content;
	}
	return result;
}

/** Combine left and right segment groups with space padding between them, truncated to width. */
function buildPowerline(left: Segment[], right: Segment[], width: number): string {
	const leftStr = renderLeftSegments(left);
	const rightStr = renderRightSegments(right);
	const used = visibleWidth(leftStr) + visibleWidth(rightStr);
	const pad = " ".repeat(Math.max(1, width - used));
	return truncateToWidth(leftStr + pad + rightStr, width);
}

function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

function buildContextBar(percent: number, barWidth: number): string {
	const filled = Math.round((percent / 100) * barWidth);
	const empty = barWidth - filled;
	return ansiFg(COLORS.ctxBarFull, "▓".repeat(filled)) + ansiFg(COLORS.ctxBarEmpty, "░".repeat(empty));
}

// OSC 8 hyperlink helper
const hyperlink = (url: string, text: string) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;

// Random human-readable session name used when the current branch has no PR.
const RANDOM_ADJECTIVES = [
	"brave", "calm", "clever", "cozy", "eager", "fuzzy", "gentle", "happy",
	"jolly", "keen", "lively", "merry", "nimble", "quiet", "quick", "sleepy",
	"snappy", "sunny", "swift", "tidy", "witty", "zesty", "bold", "bright",
];
const RANDOM_NOUNS = [
	"otter", "fox", "heron", "badger", "falcon", "lynx", "panda", "raven",
	"sparrow", "tiger", "walrus", "yak", "comet", "ember", "glacier", "harbor",
	"meadow", "orchard", "pebble", "river", "thistle", "willow", "canyon", "dune",
];
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomSessionName = () => `${pick(RANDOM_ADJECTIVES)}-${pick(RANDOM_NOUNS)}`;

export default function (pi: ExtensionAPI) {
	// Track cost at the start of the current turn so we can show the delta.
	let turnBaselineCost = 0;
	let hasTurnBaseline = false;

	const snapshotTotalCost = (ctx: ExtensionContext): number => {
		let cost = 0;
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type === "message" && e.message.role === "assistant") {
				cost += (e.message as AssistantMessage).usage.cost.total;
			}
		}
		return cost;
	};

	pi.on("turn_start", async (_event, ctx) => {
		turnBaselineCost = snapshotTotalCost(ctx);
		hasTurnBaseline = true;
	});

	pi.on("session_start", async (_event, ctx) => {
		// New/resumed session starts a fresh turn-cost window.
		turnBaselineCost = 0;
		hasTurnBaseline = false;

		ctx.ui.setFooter((tui, _theme, footerData) => {
			// Track PR URL per branch
			let prUrl: string | null = null;
			let prNumber: string | null = null;
			let lastBranch: string | null = null;
			let prLookupInFlight = false;

			const fetchPr = async (branch: string) => {
				if (prLookupInFlight) return;
				prLookupInFlight = true;
				let title: string | null = null;
				try {
					const result = await pi.exec("gh", ["pr", "view", branch, "--json", "title,url,number"], { timeout: 5000 });
					if (result.code === 0 && result.stdout.trim()) {
						const data = JSON.parse(result.stdout);
						prNumber = data.number != null ? String(data.number) : null;
						prUrl = data.url || null;
						title = data.title || null;
					} else {
						prNumber = null;
						prUrl = null;
					}
				} catch {
					prNumber = null;
					prUrl = null;
				}
				// Always overwrite: PR title if we found one, otherwise a random name.
				pi.setSessionName(title || randomSessionName());
				prLookupInFlight = false;
				tui.requestRender();
			};

			const unsub = footerData.onBranchChange(() => {
				const branch = footerData.getGitBranch();
				if (branch && branch !== lastBranch) {
					lastBranch = branch;
					prUrl = null;
					prNumber = null;
					fetchPr(branch);
				}
				tui.requestRender();
			});

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
				  try {
					// Gather token stats from session
					let input = 0;
					let output = 0;
					let cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cost += m.usage.cost.total;
						}
					}

					// Model
					const modelName = ctx.model?.name || ctx.model?.id || "no model";

					// Git branch (also trigger PR lookup on first render)
					const branch = footerData.getGitBranch();
					if (branch && branch !== lastBranch) {
						lastBranch = branch;
						prUrl = null;
						prNumber = null;
						fetchPr(branch);
					}

					// Tokens and cost
					const tokenStr = `↑${formatTokens(input)} ↓${formatTokens(output)}`;
					const costStr = `$${cost.toFixed(3)}`;

					// Context usage
					const usage = ctx.getContextUsage();
					const ctxPercent = usage ? Math.round((usage.tokens / usage.contextWindow) * 100) : 0;
					const ctxBar = buildContextBar(ctxPercent, 8);
					const ctxStr = `ctx ${ctxBar} ${ctxPercent}%`;

					// Thinking level
					const level = pi.getThinkingLevel();
					const thinking = THINKING[level] || THINKING.off;

					// Session name and active tool count (right-side identity/config)
					const sessionName = pi.getSessionName();
					const activeTools = pi.getActiveTools().length;

					// Turn delta cost (cost accrued since the current turn started)
					const turnDelta = hasTurnBaseline ? Math.max(0, cost - turnBaselineCost) : 0;

					// Left-aligned segments
					const leftSegments: Segment[] = [
						{ text: modelName, fg: COLORS.modelFg, bg: COLORS.modelBg },
						{ text: thinking.label, fg: thinking.fg, bg: thinking.bg },
					];

					if (branch) {
						leftSegments.push({ text: `${BRANCH} ${branch}`, fg: COLORS.branchFg, bg: COLORS.branchBg });
					}

					if (prUrl && prNumber) {
						leftSegments.push({ text: `${PR_ICON} #${prNumber}`, fg: 117, bg: 24, link: prUrl });
					}

					// Right-aligned segments (ordered center-to-edge)
					const rightSegments: Segment[] = [];

					if (sessionName) {
						rightSegments.push({ text: sessionName, fg: COLORS.sessionFg, bg: COLORS.sessionBg });
					}

					rightSegments.push({ text: `${TOOL_ICON} ${activeTools}`, fg: COLORS.toolsFg, bg: COLORS.toolsBg });

					if (hasTurnBaseline) {
						rightSegments.push({ text: `Δ$${turnDelta.toFixed(3)}`, fg: COLORS.turnFg, bg: COLORS.turnBg });
					}

					rightSegments.push(
						{ text: tokenStr, fg: COLORS.tokensFg, bg: COLORS.tokensBg },
						{ text: costStr, fg: COLORS.costFg, bg: COLORS.costBg },
						{ text: ctxStr, fg: COLORS.ctxFg, bg: COLORS.ctxBg },
					);

					return [buildPowerline(leftSegments, rightSegments, width)];
				  } catch {
					return [""];
				  }
				},
			};
		});
	});
}
