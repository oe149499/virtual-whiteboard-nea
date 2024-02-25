import { Logger } from "../Logger.js";
import { PropertyStore, PropType, ValuePropertyType, PropKey, PropertySchema, StructPropertySchema, PropValue, type PropertyInstance } from "../Properties.js";
import { ToolState } from "../tool/Tool.js";
import { State } from "../util/State.js";
import { None, Option, getObjectID } from "../util/Utils.js";
import { ResourcePicker } from "./ResourcePicker.js";
const logger = new Logger("ui/PropertiesEditor");

class ObjectCacheMap<K extends object, V> {
	private idMap = new Map<number, V>();

	public get(key: K, fallback: (_: K) => V): V {
		const id = getObjectID(key);
		if (this.idMap.has(id)) {
			return this.idMap.get(id) as V;
		} else {
			const val = fallback(key);
			this.idMap.set(id, val);
			return val;
		}
	}
}

export class PropertyEditor {
	private propertyCache = new ObjectCacheMap<PropertySchema[], RootPropertyUI>();
	private currentElement?: HTMLElement;

	public constructor(
		private container: HTMLElement,
		propState: State<Option<PropertyInstance>>,
		// toolState: State<ToolState>,
	) {
		propState.watchOn(this, s => {
			if (s !== None) {
				const { schema, store } = s;
				this.loadProperties(schema, store);
			} else {
				this.currentElement?.remove();
				delete this.currentElement;
			}
		});
	}

	public loadProperties(props: PropertySchema[], store: PropertyStore) {
		logger.debug("loading properties");
		const current = this.propertyCache.get(
			props,
			props => new RootPropertyUI(props),
		);
		queueMicrotask(() => current.reload(store));
		if (current.element !== this.currentElement) {
			this.currentElement?.remove();
			this.container.prepend(current.element);
			this.currentElement = current.element;
		}
	}
}

abstract class PropertyUI {
	public abstract reload(store: PropertyStore): void;

	public static create(
		target: HTMLElement,
		prop: PropertySchema,
	): PropertyUI {
		switch (prop.type) {
			case "number": return new NumberPropertyUI(target, prop);
			case "color": return new ColorPropertyUI(target, prop);
			case "text": {
				if (prop.display !== "long")
					return new ShortTextPropertyUI(target, prop);
				else return new LongTextPropertyUI(target, prop);
			}
			case "resource": return new ResourcePropertyUI(target, prop);
			case "struct": return new StructPropertyUI(target, prop);
			default: return logger.throw("Unimplemented property schema type");
		}
	}
}

class RootPropertyUI extends PropertyUI {
	public readonly element: HTMLElement;
	private children: PropertyUI[] = [];

	public constructor(
		public readonly schema: PropertySchema[],
	) {
		super();
		this.element = document.createElement("div")
			.addClasses("property-container");
		for (const item of schema) {
			this.children.push(PropertyUI.create(this.element, item));
		}
	}

	public override reload(store: PropertyStore) {
		for (const child of this.children) {
			child.reload(store);
		}
	}
}

abstract class ValuePropertyUI<N extends PropType> extends PropertyUI {
	protected readonly key: PropKey<N>;
	protected store: Option<PropertyStore> = None;

	public constructor(
		target: HTMLElement,
		protected readonly prop: ValuePropertyType<N>,
	) {
		super();
		const id = getObjectID(prop);
		const label = target.createChild("label")
			.setAttrs({ htmlFor: id })
			.setContent(prop.displayName ?? "");

		const container = target.createChild("div")
			.addClasses("passthrough");

		this.key = prop.key;
		queueMicrotask(() => this.buildUI(container, label, id));
	}

	protected abstract buildUI(target: HTMLElement, label: HTMLLabelElement, id: number): void;

	protected update(value: PropValue<N>) {
		if (this.store !== None) this.store.store(this.key, value);
	}

	protected abstract load(value: PropValue<N>): void;

	public override reload(store: PropertyStore): void {
		this.store = store;
		this.load(store.read(this.key));
	}
}

abstract class ShortPropertyUI<N extends PropType> extends ValuePropertyUI<N> {
	protected input!: HTMLInputElement;

	protected override buildUI(target: HTMLElement, label: HTMLLabelElement, id: number): void {
		this.input = target.createChild("input")
			.setAttrs({ id });
		this.init();
	}

	protected abstract init(): void;
}

abstract class WidePropertyUI<N extends PropType> extends ValuePropertyUI<N> {
	protected override buildUI(target: HTMLElement, label: HTMLLabelElement, id: number): void {
		label.addClasses("property-label-wide");
		this.build(target, id);
	}

	protected abstract build(target: HTMLElement, id: number): void;
}

class NumberPropertyUI extends ShortPropertyUI<"number"> {
	protected override init(): void {
		this.input.setAttrs({
			type: "text",
			pattern: "[0-9]+(\\.[0-9]+)?",
			inputMode: "numeric",
		});
		const { key: _1, type: _2, displayName: _3, ...attrs } = this.prop;
		this.input.setAttrs(attrs);
		this.input.oninput = () => {
			logger.debug("validity:", this.input.checkValidity());
			if (this.input.checkValidity()) {
				this.update(Number(this.input.value));
			}
		};
	}

	protected override load(value: number): void {
		this.input.value = value.toString();
	}
}

class ColorPropertyUI extends ShortPropertyUI<"color"> {
	protected override init(): void {
		this.input.setAttrs({
			type: "color",
		});
		this.input.oninput = () => this.update(this.input.value);
	}

	protected override load(value: string): void {
		this.input.value = value;
	}
}

class ShortTextPropertyUI extends ShortPropertyUI<"text"> {
	protected override init(): void {
		this.input.setAttrs({
			type: "text",
		});
	}

	protected override load(value: string): void {
		this.input.value = value;
	}
}

class LongTextPropertyUI extends WidePropertyUI<"text"> {
	private area!: HTMLTextAreaElement;

	protected override build(target: HTMLElement, id: number): void {
		this.area = target.createChild("textarea")
			.setAttrs({ id });

		this.area.oninput = () => {
			this.update(this.area.value);
		};
	}

	public override load(value: string): void {
		this.area.value = value;
	}
}

class ResourcePropertyUI extends WidePropertyUI<"resource"> {
	private picker!: ResourcePicker;

	protected override build(target: HTMLElement, _id: number): void {
		logger.debug("ui built");
		this.picker = new ResourcePicker(target, url => {
			logger.debug("Updating with", url);
			this.update(url);
		});
		logger.debug("ui built", this);
	}

	protected override load(value: Option<URL>): void {
		logger.debug("", this);
		this.picker.load(value);
	}
}

class StructPropertyUI extends PropertyUI {
	private children: PropertyUI[] = [];

	public constructor(
		target: HTMLElement,
		private prop: StructPropertySchema,
	) {
		super();

		const container = target.createChild("div")
			.addClasses("property-struct");

		if (prop.displayName) container
			.createChild("span")
			.addClasses("struct-header")
			.setContent(prop.displayName);

		for (const field of prop.fields) {
			const ui = PropertyUI.create(container, field);
			this.children.push(ui);
		}
	}

	public override reload(store: PropertyStore): void {
		for (const child of this.children) {
			child.reload(store);
		}
	}
}