import { Color } from "./gen/Types.js";
import { Option } from "./util/Utils.js";
import { MutableState, SkipReadonly, mutableStateOf } from "./util/State.js";

type KeysWhere<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T] & string;

export interface PropertyBuilder<TSchema> {
	number<K extends KeysWhere<TSchema, number>>(name: K): NumberProperty;
	color<K extends KeysWhere<TSchema, Color>>(name: K): ColorProperty;
	text<K extends KeysWhere<TSchema, string>>(name: K): TextProperty;
	file<K extends KeysWhere<TSchema, Option<URL>>>(name: K): ResourceProperty;

	struct<K extends KeysWhere<TSchema, object>>(name: K, body: BuilderFn<TSchema[K]>): StructProperty<TSchema[K]>;
}

type PropertyValue<T> = T extends SkipReadonly ? MutableState<T> : T extends object ? PropertyStore<T> : MutableState<T>;
export type PropertyStore<T extends object> = {
	[K in keyof T]: PropertyValue<T[K]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPropertyStore = PropertyStore<any>;

type PropertyInstance<T> = true extends false ? never
	: T extends number ? NumberProperty
	: T extends string ? ColorProperty | TextProperty
	: T extends Option<URL> ? ResourceProperty
	: T extends object ? StructProperty<T>
	: never;

export type PropertyMap<T extends object> = { [K in keyof T]: PropertyInstance<T[K]> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPropertyMap = PropertyMap<{ [x: string]: unknown }>;

type BuilderFn<TStore> = ($: PropertyBuilder<TStore>) => void;

class Builder<TSchema extends object> implements PropertyBuilder<TSchema> {
	private constructor(
		private source: TSchema,
		output?: Record<string, never>
	) {
		this.output = (output ?? {}) as never;
	}

	private store: Partial<PropertyStore<TSchema>> = {};
	private output: { [K in keyof TSchema]: PropertyInstance<TSchema[K]> };

	private getNewState<N extends keyof TSchema>(name: N): MutableState<TSchema[N]> {
		return mutableStateOf(this.source[name]);
	}

	number<K extends KeysWhere<TSchema, number>>(name: K): NumberProperty {
		const state = this.getNewState(name);
		const prop = new NumberProperty(name, state as unknown as MutableState<number>);
		// @ts-expect-error filtering keys by value doesn't work
		this.output[name] = prop;
		// @ts-expect-error filtering keys by value doesn't work
		this.store[name] = state;
		return prop;
	}

	color<K extends KeysWhere<TSchema, Color>>(name: K): ColorProperty {
		const state = this.getNewState(name);
		const prop = new ColorProperty(name, state as unknown as MutableState<Color>);
		// @ts-expect-error filtering keys by value doesn't work
		this.output[name] = prop;
		// @ts-expect-error filtering keys by value doesn't work
		this.store[name] = state;
		return prop;
	}

	file<K extends KeysWhere<TSchema, Option<URL>>>(name: K): ResourceProperty {
		const state = this.getNewState(name);
		const prop = new ResourceProperty(name, state as unknown as MutableState<Option<URL>>);
		// @ts-expect-error filtering keys by value doesn't work
		this.output[name] = prop;
		// @ts-expect-error filtering keys by value doesn't work
		this.store[name] = state;
		return prop;
	}

	text<K extends KeysWhere<TSchema, Color>>(name: K): TextProperty {
		const state = this.getNewState(name);
		const prop = new TextProperty(name, state as unknown as MutableState<string>);
		// @ts-expect-error filtering keys by value doesn't work
		this.output[name] = prop;
		// @ts-expect-error filtering keys by value doesn't work
		this.store[name] = state;
		return prop;
	}

	struct<K extends KeysWhere<TSchema, object>, V extends TSchema[K] & object>(name: K, fields: BuilderFn<V>): StructProperty<TSchema[K]> {
		const builder = new Builder<V>(this.source[name] as V);

		fields(builder);

		const prop = new StructProperty(name, builder.output);
		// @ts-expect-error filtering keys by value doesn't work
		this.output[name] = prop;
		// @ts-expect-error filtering keys by value doesn't work
		this.store[name] = builder.store;
		return prop;
	}

	public evaluate(fields: ($: PropertyBuilder<TSchema>) => void) {
		fields(this);
		return this.output as unknown as PropertyStore<TSchema>;
	}

	public static evaluate<T extends object>(source: T, fields: BuilderFn<T>) {
		const builder = new this(source);

		fields(builder);

		return {
			store: builder.store as PropertyStore<T>,
			props: builder.output,
		};
	}
}

export const buildProperties = Builder.evaluate.bind(Builder);

export abstract class Property {
	#displayName?: string | undefined;
	public get displayName() {
		return this.#displayName ?? this.name;
	}

	protected constructor(
		public readonly name: string,
	) { }

	public as(name: string): this {
		this.#displayName = name;
		return this;
	}
}

abstract class ValueProperty<T> extends Property {
	public constructor(
		name: string,
		public readonly state: MutableState<T>,
	) {
		super(name);
	}
}

export class NumberProperty extends ValueProperty<number> { }

export class ColorProperty extends ValueProperty<Color> { }

export class TextProperty extends ValueProperty<string> { }

export class ResourceProperty extends ValueProperty<Option<URL>> { }

export class StructProperty<TSchema> extends Property {
	public constructor(
		name: string,
		public readonly fields: { [K in keyof TSchema]: PropertyInstance<TSchema[K]> }
	) {
		super(name);
	}
}