/**
 * Powerline Footer Extension
 *
 * A minimal powerline-style footer showing model, git branch, tokens, cost,
 * and context usage. Requires a Nerd Font for powerline separator glyphs.
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// Powerline glyphs (need a Nerd Font)
const SEP = "\uE0B0";       // right-pointing solid arrow
const BRANCH = "\uE0A0";    // git branch icon

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

/**
 * Build a powerline segment string.
 * Each segment is: " content " followed by a separator arrow
 * whose fg matches the current bg and whose bg matches the next segment's bg (or reset).
 */
function buildSegments(segments: Array<{ text: string; fg: number; bg: number }>, width: number): string {
	let result = "";

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const nextBg = i < segments.length - 1 ? segments[i + 1].bg : -1;

		// Segment content with padding
		result += ansiFgBg(seg.fg, seg.bg, ` ${seg.text} `);

		// Separator: fg = current bg, bg = next bg (or reset)
		if (nextBg >= 0) {
			result += ansiFgBg(seg.bg, nextBg, SEP);
		} else {
			result += ansiFg(seg.bg, SEP);
		}
	}

	return truncateToWidth(result, width);
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

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setFooter((tui, _theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
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

					// Git branch
					const branch = footerData.getGitBranch();

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

					// Build segments
					const segments: Array<{ text: string; fg: number; bg: number }> = [
						{ text: modelName, fg: COLORS.modelFg, bg: COLORS.modelBg },
						{ text: thinking.label, fg: thinking.fg, bg: thinking.bg },
					];

					if (branch) {
						segments.push({ text: `${BRANCH} ${branch}`, fg: COLORS.branchFg, bg: COLORS.branchBg });
					}

					segments.push(
						{ text: tokenStr, fg: COLORS.tokensFg, bg: COLORS.tokensBg },
						{ text: costStr, fg: COLORS.costFg, bg: COLORS.costBg },
						{ text: ctxStr, fg: COLORS.ctxFg, bg: COLORS.ctxBg },
					);

					return [buildSegments(segments, width)];
				},
			};
		});
	});
}
