/**
 * Powerline Footer Extension
 *
 * A minimal powerline-style footer showing model, tokens, and cost.
 * Requires a Nerd Font for powerline separator glyphs.
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// Powerline separator (right-pointing solid arrow, \uE0B0)
const SEP = "\uE0B0";

// ANSI helpers for 256-color backgrounds and foregrounds
const ansiFg = (color: number, text: string) => `\x1b[38;5;${color}m${text}\x1b[0m`;
const ansiBg = (color: number, text: string) => `\x1b[48;5;${color}m${text}\x1b[0m`;
const ansiFgBg = (fg: number, bg: number, text: string) => `\x1b[38;5;${fg};48;5;${bg}m${text}\x1b[0m`;

// Segment color palette (256-color indices)
const COLORS = {
	seg1Bg: 236,  // dark gray - model segment
	seg1Fg: 252,  // light gray
	seg2Bg: 239,  // medium gray - tokens segment
	seg2Fg: 250,  // lighter gray
	seg3Bg: 234,  // darker gray - cost segment
	seg3Fg: 245,  // mid gray
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

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setFooter((_tui, _theme, _footerData) => {
			return {
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

					const modelName = ctx.model?.name || ctx.model?.id || "no model";
					const tokenStr = `↑${formatTokens(input)} ↓${formatTokens(output)}`;
					const costStr = `$${cost.toFixed(3)}`;

					const segments = [
						{ text: modelName, fg: COLORS.seg1Fg, bg: COLORS.seg1Bg },
						{ text: tokenStr, fg: COLORS.seg2Fg, bg: COLORS.seg2Bg },
						{ text: costStr, fg: COLORS.seg3Fg, bg: COLORS.seg3Bg },
					];

					return [buildSegments(segments, width)];
				},
			};
		});
	});
}
