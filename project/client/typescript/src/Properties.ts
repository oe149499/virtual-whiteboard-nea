import { Color } from "./gen/Types.js";
import { None, Option } from "./util/Utils.js";
import { BlockDeepReadonly } from "./util/State.js";
import { Logger } from "./Logger.js";

const logger = new Logger("Properties");

type PropertyGetter = <N extends PropType>(key: PropKey<N>) => PropValue<N>;
type PropertyValidator<N extends PropType> = (val: PropValue<N>) => boolean;
type PropKeyInit<N extends PropType> = {
	validator?: PropertyValidator<N>,
	defaultValue?: PropValue<N>,
}

export class PropKey<N extends keyof ValuePropertyTypes> {
	public readonly validator: (val: PropValue<N>) => boolean;
	public readonly defaultVal?: PropValue<N>;
	public constructor(
		public readonly type: N,
		options?: PropKeyInit<N>,
	) {
		this.validator = options?.validator ?? alwaysValid;
		if (options?.defaultValue) this.defaultVal = options.defaultValue;
	}
}

export class CompositeKey<T> {
	public constructor(
		public readonly extractor: (get: PropertyGetter) => T,
	) { }
}

const alwaysValid = () => true;

type PropertySchemaBase = {
	displayName?: string,
};

type ValuePropertyTypes = {
	number: {
		valType: number,
		min?: number,
		max?: number,
		step?: number,
	},
	color: {
		valType: Color,
	},
	text: {
		valType: string,
		display?: "short" | "long",
	},
	resource: {
		valType: Option<URL>,
		accept?: string[],
	},
};

const defaults: { [N in PropType]?: PropValue<N> } = {
	number: 0,
	color: "black",
	text: "",
	resource: None,
};

export type PropType = keyof ValuePropertyTypes;
export type PropValue<T extends PropType> = ValuePropertyTypes[T]["valType"];

export type ValuePropertyType<T extends PropType> = {
	type: T,
	key: PropKey<T>,
} & Omit<ValuePropertyTypes[T], "valType"> & PropertySchemaBase;

type ValuePropertySchema = { [K in PropType]: ValuePropertyType<K> }[PropType];

export type StructPropertySchema = PropertySchemaBase & {
	type: "struct",
	fields: PropertySchema[],
};

export type PropertySchema = ValuePropertySchema | StructPropertySchema;

type NoValue = typeof PropertyStore.NoValue;

export abstract class PropertyStore {
	[BlockDeepReadonly]() { }
	public static readonly NoValue = Symbol("NoValue");

	public read<N extends PropType>(key: PropKey<N>): PropValue<N>;
	public read<T>(key: CompositeKey<T>): T;
	public read<N extends PropType, T>(key: PropKey<N> | CompositeKey<T>) {
		logger.debug("key: ", key);
		if (key instanceof CompositeKey) return key.extractor(this.read.bind(this));
		else {
			const value = this.get(key);
			if (value === PropertyStore.NoValue) {
				if (key.defaultVal !== undefined) return key.defaultVal;
				else if (key.type in defaults) {
					return defaults[key.type];
				}
				throw new Error("Missing property key");
			} else return value;
		}
	}

	public store<N extends PropType>(key: PropKey<N>, value: PropValue<N>): boolean {
		if (!key.validator(value)) return false;
		this.set(key, value);
		return true;
	}

	protected abstract get<N extends PropType>(key: PropKey<N>): PropValue<N> | NoValue;
	protected abstract set<N extends PropType>(key: PropKey<N>, value: PropValue<N>): void;
}

export class SingletonPropertyStore extends PropertyStore {
	public constructor(
		public readonly schema: PropertySchema[],
	) { super(); }

	public static readonly Empty = new this([]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private dataStore = new Map<PropKey<any>, any>();

	protected override get<N extends keyof ValuePropertyTypes>(key: PropKey<N>) {
		if (this.dataStore.has(key)) {
			return this.dataStore.get(key);
		} else {
			return PropertyStore.NoValue;
		}
	}

	protected override set<N extends keyof ValuePropertyTypes>(key: PropKey<N>, value: PropValue<N>) {
		this.dataStore.set(key, value);
	}
}