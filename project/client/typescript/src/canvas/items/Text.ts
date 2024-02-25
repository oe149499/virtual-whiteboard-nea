import type { SpecificItem } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { PropKey } from "../../Properties.js";
import type { Item } from "../../gen/Types.js";
import { todo } from "../../util/Utils.js";
import { CenterHelper, type CanvasContext } from "../CanvasBase.js";
import { parseMarkdown } from "../MarkdownParser.js";
import { CanvasItem, TransformMixin } from "./CanvasItems.js";

const logger = new Logger("canvas/items/Text");

type LineEntry = {
	free: Set<SVGTSpanElement>,
	used: Set<SVGTSpanElement>,
	lastUse: number,
}

class TextRenderer {
	private lineCache = new Map<string, LineEntry>();
	private _lineCache = new Map<string, LineEntry>();
	private updateCount = 0;

	public constructor(
		private ctx: CanvasContext,
		private container: SVGTextElement,
	) { }

	public update(newLines: Iterable<string>) {
		this.updateCount += 1;
		[this._lineCache, this.lineCache] = [this.lineCache, this._lineCache];

		const target = this.ctx.createElement("tspan")
			.setAttrs({
				x: 0,
				dy: "-1.2em",
			});

		target.createChild("tspan")
			.addClasses("md-linebreak")
			.setContent("@");

		for (const line of newLines) {
			const rendered = this.getLine(line);
			rendered.setAttrs({
				x: 0,
				dy: "1.2em",
			});
			target.appendChild(rendered);
		}

		this.container.replaceChildren(target);
	}

	private getLine(line: string): SVGTSpanElement {
		let entry = this.lineCache.get(line);
		if (!entry) {
			entry = {
				free: new Set(),
				used: new Set(),
				lastUse: this.updateCount,
			};

			this.lineCache.set(line, entry);

			const rendered = this.renderLine(line);
			entry.used.add(rendered);
			return rendered;
		}

		if (entry.lastUse < this.updateCount) {
			entry.free.addFrom(entry.used.drain());
			entry.lastUse = this.updateCount;
		}

		const rendered = entry.free.first() ?? this.renderLine(line);

		entry.free.delete(rendered);
		entry.used.add(rendered);

		return rendered;
	}

	private renderLine(line: string): SVGTSpanElement {
		if (line == "") return this
			.ctx
			.createElement("tspan")
			.addClasses("md-linebreak")
			.setContent("@");
		return parseMarkdown(this.ctx, line);
	}
}

export class Text extends TransformMixin(CanvasItem) {
	public override readonly innerElement: SVGGraphicsElement;

	private renderer: TextRenderer;

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Text">,
	) {
		super(ctx);
		this.innerElement = ctx.createElement("g");

		const textElement = ctx.createElement("text");
		textElement.setAttribute("text-anchor", "middle");

		this.innerElement.appendChild(CenterHelper.of(textElement));

		// const holderElement = this.innerElement.createChild("g");

		// const holderTransform = ctx.createTransform();
		// holderElement.transform.baseVal.appendItem(holderTransform);

		// textElement
		// 	.getBBoxState()
		// 	.debug(logger)
		// 	.derived(({ top, bottom }) => -(top + bottom) / 2)
		// 	.watchOn(textElement, (offset) => {
		// 		holderTransform.setTranslate(0, offset);
		// 	});

		this.renderer = new TextRenderer(ctx, textElement);
		this.renderer.update(item.text.split("\n"));
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Text");
		this.item = value;

		this.renderer.update(value.text.split("\n"));
	}

	static {
		this.PropertiesHook.add(this, store => {
			const key = new PropKey("text");

			store.getter("Text", key, item => item.text);
			store.setter("Text", key, (item, val) => item.text = val);

			return {
				type: "text",
				key,
				displayName: "Text",
				display: "long",
			};
		});
	}
}