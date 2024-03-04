import { ItemType, SpecificItem } from "../../GenWrapper.js";
import { CanvasContext } from "../CanvasBase.js";
import { Image, CanvasItem } from "./CanvasItems.js";
import { Line, Polygon, Path } from "./Line.js";
import { Rectangle, Ellipse } from "./Shape.js";
import { Text, Link } from "./Text.js";

const ItemBuilders = {
	Rectangle,
	Ellipse,
	Line,
	Polygon,
	Path,
	Image,
	Text,
	Link,
} as { [K in ItemType]?: new (_: CanvasContext, __: SpecificItem<K>) => CanvasItem };

CanvasItem.create = function <K extends ItemType>(ctx: CanvasContext, item: SpecificItem<K>): CanvasItem {
	const builder = ItemBuilders[item.type] as undefined | (new (_: CanvasContext, __: SpecificItem<K>) => CanvasItem);
	if (!builder) throw new Error("unimplemented item type");
	else return new builder(ctx, item);
};