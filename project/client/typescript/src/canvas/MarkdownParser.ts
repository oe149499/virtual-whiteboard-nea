import type { CanvasContext } from "./CanvasBase.js";

const MD_TOKEN = /\\[_*~\\]|\*+|_+|~+|[^*_~]+/;

const CONTROL_SCHEMA = [
	["*", "italic"],
	["**", "bold"],
	["***", "bold", "italic"],
	["_", "italic"],
	["__", "underline"],
	["___", "italic", "underline"],
	["~", "italic"],
	["~~", "strikethrough"],
	["~~~", "italic", "strikethrough"],
];

const CONTROL_TOKENS = new Map(
	CONTROL_SCHEMA.map(
		([token, ...classes]) => [token, classes.map(c => `md-${c}`).join(" ")],
	),
);

function* tokens(source: string) {
	const re = new RegExp(MD_TOKEN, "g");
	let current = re.exec(source);

	while (current) {
		yield current[0];
		current = re.exec(source);
	}
}

export function parseMarkdown(ctx: CanvasContext, source: string) {
	const outer = ctx.createElement("tspan");
	let current = outer;

	const modifierStack: string[] = [];

	// console.log("Parsing line: ", source);

	for (const token of tokens(source)) {
		// console.log(modifierStack, token);
		if (CONTROL_TOKENS.has(token)) {
			const top = modifierStack[modifierStack.length - 1];

			if (top === token) {
				// const classes = CONTROL_TOKENS.assume(token);
				// current.setAttribute("class", classes);

				// @ts-expect-error parentElement is just wrong
				current = current.parentElement as SVGTSpanElement;
				modifierStack.pop();
			} else {
				current = current.createChild("tspan");
				modifierStack.push(token);

				const classes = CONTROL_TOKENS.assume(token);
				current.setAttribute("class", classes);
			}
		} else {
			current.appendChild(document.createTextNode(token));
		}
	}

	return outer;
}