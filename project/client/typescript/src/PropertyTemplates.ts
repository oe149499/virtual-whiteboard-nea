import { CompositeKey, PropKey, PropertyBuilder, PropertySchema, key } from "./Properties.js";
import { UserTransform, UserTransformConverter } from "./Transform.js";
import { Point, Stroke, Transform } from "./gen/Types.js";
import { DeepReadonly, MutableState } from "./util/State.js";


function Stroke($: PropertyBuilder<Stroke>) {
	$.color("color").as("Colour");
	$.number("width").as("Width");
}

function Point($: PropertyBuilder<Point>) {
	$.number("x").as("X");
	$.number("y").as("Y");
}

function PointSchema() {
	const keys = {
		x: key("number"),
		y: key("number"),
	};

	const schema: PropertySchema[] = [
		{
			type: "number",
			key: keys.x,
			displayName: "X"
		},
		{
			type: "number",
			key: keys.y,
			displayName: "Y",
		}
	];

	return { keys, schema };
}

function Transform($: PropertyBuilder<UserTransform>) {
	$.struct("origin", Point).as("Position");
	$.number("rotation").as("Angle");
	$.struct("stretch", Point).as("Scale");
	$.number("skew").as("Shear");
}

function TransformSchema() {
	const origin = PointSchema();

	const stretch = PointSchema();

	const keys = {
		origin: origin.keys,
		rotation: key("number"),
		stretch: stretch.keys,
		skew: key("number"),
	};

	const schema: PropertySchema = {
		type: "struct",
		displayName: "Transformation",
		fields: [
			{
				type: "struct",
				displayName: "Position",
				fields: origin.schema,
			},
			{
				type: "number",
				displayName: "Angle",
				key: keys.rotation,
				min: -180,
				max: 180,
			},
			{
				type: "struct",
				displayName: "Scale",
				fields: stretch.schema,
			},
			{
				type: "number",
				displayName: "Shear",
				key: keys.skew,
			},
		],
	};

	return { keys, schema };
}

function StrokeSchema() {
	const color = key("color");
	const width = key("number");

	const stroke = new CompositeKey<Stroke>(get => ({
		color: get(color),
		width: get(width),
	}));

	const keys = {
		color,
		width,
		stroke,
	};

	const schema: PropertySchema = {
		type: "struct",
		displayName: "Stroke",
		fields: [
			{
				type: "color",
				key: color,
				displayName: "Colour",
			},
			{
				type: "number",
				key: width,
				displayName: "Width",
				min: 0,
			}
		]
	};

	return { keys, schema };
}

type Merged<A, T> = T extends [infer First, ...infer Rest] ? Merged<A & First, Rest> : A;

export function merge<Ts extends object[]>(...objs: Ts): Merged<object, Ts> {
	return Object.assign({}, ...objs);
}

export const PropertyTemplates = Object.freeze({
	Point, PointSchema, Transform, TransformSchema, Stroke, StrokeSchema
});