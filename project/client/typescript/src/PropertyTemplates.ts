import { CompositeKey, PropKey, PropType, PropertySchema, ValuePropertyType } from "./Properties.js";
import { Stroke, type Point } from "./gen/Types.js";
import { point } from "./util/Utils.js";

function PointSchema(defaultVal = point()) {
	const keys = {
		x: new PropKey("number", { defaultValue: defaultVal.x }),
		y: new PropKey("number", { defaultValue: defaultVal.y }),
	};

	console.log(keys);

	const schema: PropertySchema[] = [
		{
			type: "number",
			key: keys.x,
			displayName: "X",
		},
		{
			type: "number",
			key: keys.y,
			displayName: "Y",
		},
	];

	return { keys, schema };
}

function PointPropertySchema(name: string, defaults?: Point) {
	const { keys, schema: fields } = PointSchema(defaults);
	return {
		keys: { point: keys },
		schema: {
			type: "struct" as const,
			fields,
		},
	};
}

function TransformSchema() {
	const origin = PointSchema();

	const stretch = PointSchema(point(1, 1));

	const keys = {
		origin: origin.keys,
		rotation: new PropKey("number", { defaultValue: 0 }),
		stretch: stretch.keys,
		skew: new PropKey("number", { defaultValue: 0 }),
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

function StrokeSchema(defaultVal = { color: "black", width: 0.1 }) {
	const color = new PropKey("color", { defaultValue: defaultVal.color });
	const width = new PropKey("number", { defaultValue: defaultVal.width });

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
			},
		],
	};

	return { keys, schema };
}

type Template<TKeys> = {
	keys: TKeys,
	schema: PropertySchema,
}

type TemplateArray<TKeys> = {
	keys: TKeys,
	schema: PropertySchema[],
}

class Builder<TKeys extends object> {
	private constructor(private keys: TKeys, private schemas: PropertySchema[]) {

	}

	public static empty(): Builder<object> {
		return new this({}, []);
	}

	add<TAdd>(prop: Template<TAdd>): Builder<TKeys & TAdd>;
	add<Name extends string, N extends PropType>(name: Name, prop: ValuePropertyType<N>): Builder<TKeys & Record<Name, PropKey<N>>>;
	public add<Name extends string, N extends PropType, TAdd = Record<Name, PropKey<N>>>(templOrName: Template<TAdd> | Name, prop?: ValuePropertyType<N>) {
		if (typeof templOrName == "object") {
			const { schema, keys } = templOrName;
			return new Builder(
				{
					...this.keys,
					...keys,
				},
				[...this.schemas, schema],
			);
		} else {
			return new Builder<TKeys & Record<Name, PropKey<N>>>(
				// @ts-expect-error adding a key with a specific type doesn't convince TS
				{
					...this.keys,
					[templOrName as Name]: prop!.key,
				},
				[...this.schemas, prop!],
			);
		}
	}

	build(): TemplateArray<TKeys> {
		return {
			keys: this.keys,
			schema: this.schemas,
		};
	}
}

export function builder() {
	return Builder.empty();
}

export const PropertyTemplates = Object.freeze({
	PointSchema, PointPropertySchema, TransformSchema, StrokeSchema,
});