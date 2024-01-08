import { Color } from "./gen/Types";

interface Accessor<T> {
	get(): T,
	set(_: T): T,
}

type KeysWhere<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

export interface PropertyBuilder<TStore> {
	get<TObj, TKey extends keyof TObj>(obj: TObj, key: TKey): Accessor<TObj[TKey]>;

	number<K extends KeysWhere<TStore, number>>(name: K): NumberProperty;
	number(name: string, accessor: Accessor<number>): NumberProperty;
	color<K extends KeysWhere<TStore, Color>>(name: K): ColorProperty;
	color(name: string, accessor: Accessor<Color>): ColorProperty;
	//struct(name: string, body: BuilderFn<null>): StructProperty;
	struct<K extends keyof TStore>(name: K, body: BuilderFn<TStore[K]>): StructProperty;
}

type VConst<P extends Property, V> = new (name: string, get: () => V, set: (_: V) => V) => P;

type BuilderFn<TStore> = ($: PropertyBuilder<TStore>) => void;

class Builder<TStore extends object> implements PropertyBuilder<TStore> {
	private constructor(
		private store: TStore,
		output?: Property[]
	) {
		this.output = output ?? [];
	}

	private output: Property[] = [];

	public get<TObj, TKey extends keyof TObj>(obj: TObj, key: TKey): Accessor<TObj[TKey]> {
		return {
			get() { return obj[key]; },
			set(value) {
				obj[key] = value;
				return obj[key];
			}
		};
	}

	private getAccessor<V>(name: KeysWhere<TStore, V>): Accessor<V> {
		return {
			get: () => this.store[name] as V,
			// @ts-expect-error madness
			set: (value) => this.store[name] = value,
		};
	}

	private value<V, TProp extends ValueProperty<V>>(name: string, accessor: Accessor<V> | null | undefined, constructor: VConst<TProp, V>): TProp {
		accessor ??= this.getAccessor(name as KeysWhere<TStore, V>);
		const prop = new constructor(name, accessor.get, accessor.set);
		this.output.push(prop);
		return prop;
	}

	number<K extends KeysWhere<TStore, number>>(name: K): NumberProperty;
	number(name: string, accessor: Accessor<number>): NumberProperty;
	number(name: string, accessor?: Accessor<number>): NumberProperty {
		return this.value(name, accessor, NumberProperty);
	}


	color<K extends KeysWhere<TStore, Color>>(name: K): ColorProperty;
	color(name: string, accessor: Accessor<Color>): ColorProperty;
	color(name: string, accessor?: Accessor<string>): ColorProperty {
		return this.value(name, accessor, ColorProperty);
	}

	struct(name: string, body: BuilderFn<null>): StructProperty;
	struct<K extends keyof TStore>(name: K, body: BuilderFn<TStore[K]>): StructProperty;
	struct<K extends string>(name: K, fields: BuilderFn<K extends keyof TStore ? TStore[K] : null>): StructProperty {
		const builder = new Builder(name in this.store ? (this.store as Record<K, object>)[name] : {});

		fields(builder);

		const prop = new StructProperty(name, builder.output);
		this.output.push(prop);
		return prop;
	}

	public evaluate<T>(fields: ($: PropertyBuilder<T>) => void) {
		this.output = [];
		fields(this);
		return this.output;
	}

	public static evaluate<T extends object>(store: T, fields: BuilderFn<T>) {
		return new this(store).evaluate(fields);
	}

	public static evaluateDeferred<T extends object>(store: () => T, fields: BuilderFn<T>) {
		const output = [] as Property[];
		setTimeout(() => {
			new this(store(), output).evaluate(fields);
		});
		return output;
	}
}

export const buildProperties = Builder.evaluate.bind(Builder);
export const buildPropertiesDeferred = Builder.evaluateDeferred.bind(Builder);

export abstract class Property {
	#displayName?: string;
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
		public readonly get: () => T,
		public readonly set: (_: T) => T,
	) {
		super(name);
	}
}

export class NumberProperty extends ValueProperty<number> { }

export class ColorProperty extends ValueProperty<Color> { }

export class StructProperty extends Property {
	public constructor(
		name: string,
		public readonly fields: Property[],
	) {
		super(name);
	}
}