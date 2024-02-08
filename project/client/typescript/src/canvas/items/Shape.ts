import { HasFill, HasStroke, HasTransform } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { PropKey } from "../../Properties.js";
import { PropertyTemplates, builder } from "../../PropertyTemplates.js";
import { Item } from "../../gen/Types.js";
import { point } from "../../util/Utils.js";
import { TransformHelper, StrokeHelper, FillHelper, CanvasContext } from "../CanvasBase.js";
import { CanvasItem } from "./CanvasItems.js";

const logger = new Logger("canvas/items/Shape");

// const ShapeItemSpec = {
// 	transform: {
// 		origin: point(),
// 		rotation: 0,
// 		stretch: point(1),
// 		skew: 0,
// 	},
// 	stroke: {
// 		color: "black",
// 		width: 0.1,
// 	},
// 	fill: "black",
// };

const { keys, schema } = builder()
	.add(PropertyTemplates.TransformSchema())
	.add(PropertyTemplates.StrokeSchema())
	.add("fill", {
		type: "color",
		key: new PropKey("color", { defaultValue: "black" }),
		displayName: "Fill color",
	})
	.build();

// const ShapeItemProperties = buildProperties(ShapeItemSpec, $ => {
// 	$.struct("transform", PropertyTemplates.Transform);
// 	$.struct("stroke", PropertyTemplates.Stroke);
// 	$.color("fill").as("Fill Colour");
// });

abstract class ShapeItem extends CanvasItem {
	private _transform: TransformHelper;
	private _stroke: StrokeHelper;
	private _fill: FillHelper;

	private innerElem: SVGGraphicsElement;

	public get innerElement() { return this.innerElem; }

	protected abstract createElement(ctx: CanvasContext): SVGGraphicsElement;

	public constructor(
		ctx: CanvasContext,
		protected item: Extract<Item, HasFill & HasStroke & HasTransform>,
	) {
		super(ctx);

		const elem = this.createElement(ctx);
		this.innerElem = elem;

		this._transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);
		this._stroke = new StrokeHelper(elem.style, item.stroke);
		this._fill = new FillHelper(elem.style, item.fill);
	}

	public override updateItem(value: Item): void {
		if (!(
			"transform" in value &&
			"fill" in value &&
			"stroke" in value
		)) {
			logger.error("Recieved invalid item type for update:", value);
			return;
		}
		this.item = value;
		this._fill.update(value.fill);
		this._stroke.update(value.stroke);
		this._transform.update(value.transform);
	}
}

export class Rectangle extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		return ctx.createElement("rect")
			.setAttrs({
				x: -0.5,
				y: -0.5,
				width: 1,
				height: 1,
			});
	}
}

export class Ellipse extends ShapeItem {
	protected override createElement(ctx: CanvasContext): SVGGraphicsElement {
		const elem = ctx.createElement("circle");

		elem.setAttribute("r", "0.5cm");

		return elem;
	}
}
