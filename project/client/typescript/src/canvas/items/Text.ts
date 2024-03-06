import type { SpecificItem } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { PropKey, type PropertySchema } from "../../Properties.js";
import type { Item } from "../../gen/Types.js";
import { CenterHelper, type CanvasContext } from "../CanvasBase.js";
import { GestureLayer, GestureType } from "../Gesture.js";
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

		const textElement = ctx.createElement("text");
		textElement.setAttribute("text-anchor", "middle");

		this.innerElement = CenterHelper.of(textElement);

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

export class Link extends TransformMixin(CanvasItem) {
	public override readonly innerElement: SVGGElement;

	private textElement: SVGTextElement;

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Link">,
	) {
		super(ctx);
		this.textElement = ctx.createElement("text").addClasses("hyperlink");
		this.innerElement = CenterHelper.of(this.textElement);

		ctx.createGestureFilter(GestureLayer.Lowest)
			.setTest(p => {
				const bounds = this.bounds;
				return bounds.testIntersection(p);
			})
			.addHandler(GestureType.Click, () => {
				try {
					window.open(this.item.url, "_blank", "noreferrer=1");
				} catch { return; }
			});

		this.updateItem(item);
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Link");

		this.item = value;

		this.textElement.setContent(value.text || value.url);
	}

	static {
		this.PropertiesHook.add(this, store => {
			const key = new PropKey("text");
			const schema: PropertySchema = {
				type: "text",
				key,
				displayName: "URL",
				display: "short",
			};

			store.getter("Link", key, item => item.url);
			store.setter("Link", key, (item, val) => item.url = val);

			return schema;
		});

		this.PropertiesHook.add(this, store => {
			const key = new PropKey("text");
			const schema: PropertySchema = {
				type: "text",
				key,
				displayName: "Link text",
				display: "short",
			};

			store.getter("Link", key, item => item.text);
			store.setter("Link", key, (item, val) => item.text = val);

			return schema;
		});
	}
}