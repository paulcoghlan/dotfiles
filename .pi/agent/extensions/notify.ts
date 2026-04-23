/**
 * Pi Notify Extension
 *
 * Sends a desktop notification via OSC 777 when the agent finishes,
 * including a summary of the last assistant message.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const notify = (title: string, body: string): void => {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
};

const isTextPart = (part: unknown): part is { type: "text"; text: string } => {
	return typeof part === "object" && part !== null && (part as Record<string, unknown>).type === "text" && typeof (part as Record<string, unknown>).text === "string";
};

const extractLastAssistantText = (messages: Array<{ role?: string; content?: unknown }>): string | null => {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message?.role !== "assistant") {
			continue;
		}

		const content = message.content;
		if (typeof content === "string") {
			return content.trim() || null;
		}

		if (Array.isArray(content)) {
			const text = content
				.filter(isTextPart)
				.map((part) => part.text)
				.join("\n")
				.trim();
			return text || null;
		}

		return null;
	}

	return null;
};

const formatNotification = (lastText: string | null): { title: string; body: string } => {
	if (!lastText) {
		return { title: "Pi", body: "Ready for input" };
	}

	const maxLength = 120;
	const trimmed = lastText.length > maxLength ? lastText.slice(0, maxLength) + "..." : lastText;

	return { title: "Pi", body: trimmed };
};

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (event) => {
		const lastText = extractLastAssistantText(event.messages ?? []);
		const { title, body } = formatNotification(lastText);
		notify(title, body);
	});
}
