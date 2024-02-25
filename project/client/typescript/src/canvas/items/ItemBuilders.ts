import { ItemType, SpecificItem } from "../../GenWrapper.js";
import { CanvasContext } from "../CanvasBase.js";
import { Image, CanvasItem } from "./CanvasItems.js";
import { Line, Polygon, Path } from "./Line.js";
import { Rectangle, Ellipse } from "./Shape.js";
import { Text } from "./Text.js";

const ItemBuilders = {
	Rectangle,
	Ellipse,
	Line,
	Polygon,
	Path,
	Image,
	Text,
} as { [K in ItemType]?: new (_: CanvasContext, __: SpecificItem<K>) => CanvasItem };

CanvasItem.create = function <K extends ItemType>(ctx: CanvasContext, item: SpecificItem<K>): CanvasItem {
	const builder = ItemBuilders[item.type];
	if (!builder) throw new Error("unimplemented item type");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	else return new (builder as any)(ctx, item);
};