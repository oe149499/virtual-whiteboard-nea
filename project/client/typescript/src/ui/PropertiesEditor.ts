import { Logger } from "../Logger.js";
import { AnyPropertyMap, ColorProperty, ResourceProperty, NumberProperty, Property, StructProperty, TextProperty, PropertyKeyStore, PropType, ValuePropertyType, PropKey, PropertySchema, key } from "../Properties.js";
import { ToolState } from "../tool/Tool.js";
import { State } from "../util/State.js";
import { None, getObjectID } from "../util/Utils.js";
import { buildResourcePicker } from "./ResourcePicker.js";
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
		toolState: State<ToolState>,
	) {
		toolState.watch(s => {
			if (s !== None) {
				const props = s.tool.properties;
				if (props) this.loadProperties(props.schema, props);
			} else {
				this.currentElement?.remove();
				delete this.currentElement;
			}
		});
	}

	public loadProperties(props: PropertySchema[], store: PropertyKeyStore) {
		logger.debug("loading properties");
		const current = this.propertyCache.get(props, (props) =>
			new RootPropertyUI(props, store)
		);
		if (current.element !== this.currentElement) {
			this.currentElement?.remove();
			this.container.prepend(current.element);
			this.currentElement = current.element;
		}
	}

	private buildPropertyUI(target: HTMLElement, prop: Property) {
		logger.debug("%o", prop);
		if (prop instanceof NumberProperty) return this.buildNumberUI(target, prop);
		if (prop instanceof ColorProperty) return this.buildColorUI(target, prop);
		if (prop instanceof TextProperty) return this.buildTextUI(target, prop);
		if (prop instanceof ResourceProperty) return this.buildFileUI(target, prop);
		if (prop instanceof StructProperty) return this.buildStructUI(target, prop);
	}

	private buildNumberUI(target: HTMLElement, prop: NumberProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ htmlFor: propID })
			.setContent(prop.displayName);
		const input = target.createChild("input")
			.addClasses("property-number")
			.setAttrs({
				type: "text",
				pattern: "[0-9](\\.[0-9]+)",
				inputMode: "numeric",
				id: propID,
				value: prop.state.get(),
				step: "any",
			});
		input.oninput = () => {
			if (input.checkValidity()) {
				prop.state.set(Number(input.value));
			}
		};
	}

	private buildColorUI(target: HTMLElement, prop: ColorProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ htmlFor: propID })
			.setContent(prop.displayName);
		const input = target.createChild("input")
			.addClasses("property-color")
			.setAttrs({
				type: "color",
				id: propID,
				value: prop.state.get(),
			});
		input.oninput = () => {
			prop.state.set(input.value);
		};
	}

	private buildTextUI(target: HTMLElement, prop: TextProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ htmlFor: propID })
			.addClasses()
			.setContent(prop.displayName);
		const input = target.createChild("input")
			.addClasses("property-text")
			.setAttrs({
				type: "text",
				id: propID,
				value: prop.state.get(),
			});
		input.oninput = () => {
			prop.state.set(input.value);
		};
	}

	private buildFileUI(target: HTMLElement, prop: ResourceProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.addClasses("property-label-wide")
			.setContent(prop.displayName);
		buildResourcePicker(target, prop.state);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private buildStructUI(target: HTMLElement, prop: StructProperty<any>) {
		const container = target.createChild("div")
			.addClasses("property-struct");
		container.createChild("span")
			.addClasses("struct-header")
			.setContent(prop.displayName);
		for (const name in prop.fields) {
			this.buildPropertyUI(container, prop.fields[name]);
		}
	}
}

abstract class PropertyUI {
	public abstract reload(store: PropertyKeyStore): void;

	public static create(
		target: HTMLElement,
		prop: PropertySchema,
		store: PropertyKeyStore,
	): PropertyUI {
		switch (prop.type) {
			case "number": return new NumberPropertyUI(target, prop, store);
			case "color": return new ColorPropertyUI(target, prop, store);
			case "text": {
				if (prop.display !== "long")
					return new ShortTextPropertyUI(target, prop, store);
				else return new LongTextPropertyUI(target, prop, store);
			}
			case "resource": break;
			case "struct": break;
		}
		return logger.throw("Unimplemented property schema type");
	}
}

class RootPropertyUI extends PropertyUI {
	public readonly element: HTMLElement;
	private children: PropertyUI[] = [];

	public constructor(
		public readonly schema: PropertySchema[],
		store: PropertyKeyStore,
	) {
		super();
		this.element = document.createElement("div");
		for (const item of schema) {
			this.children.push(PropertyUI.create(this.element, item, store));
		}
	}

	public override reload(store: PropertyKeyStore) {
		for (const child of this.children) {
			child.reload(store);
		}
	}
}

abstract class SimplePropertyUI<N extends PropType> extends PropertyUI {
	protected readonly input: HTMLInputElement;
	protected readonly key: PropKey<N>;

	public constructor(
		target: HTMLElement,
		protected readonly prop: ValuePropertyType<N>,
		store: PropertyKeyStore,
	) {
		super();
		const id = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ htmlFor: id })
			.setContent(prop.displayName ?? "");
		this.input = target.createChild("input")
			.setAttrs({ id });

		this.key = prop.key;
		this.init(store);
	}

	protected abstract init(store: PropertyKeyStore): void;
}

class NumberPropertyUI extends SimplePropertyUI<"number"> {
	protected override init(store: PropertyKeyStore): void {
		this.input.setAttrs({
			type: "text",
			pattern: "[0-9](\\.[0-9]+)",
			inputMode: "numeric",
			value: store.read(this.key),
		});
		const { key: _1, type: _2, displayName: _3, ...attrs } = this.prop;
		this.input.setAttrs(attrs);
	}

	public override reload(store: PropertyKeyStore): void {
		this.input.setAttrs({
			value: store.read(this.key)
		});
	}
}

class ColorPropertyUI extends SimplePropertyUI<"color"> {
	protected override init(store: PropertyKeyStore): void {
		this.input.setAttrs({
			type: "color",
			value: store.read(this.key),
		});
	}

	public override reload(store: PropertyKeyStore): void {
		this.input.setAttrs({
			value: store.read(this.key),
		});
	}
}

class ShortTextPropertyUI extends SimplePropertyUI<"text"> {
	protected override init(store: PropertyKeyStore): void {
		this.input.setAttrs({
			type: "text",
			value: store.read(this.key),
		});
	}

	public override reload(store: PropertyKeyStore): void {
		this.input.setAttrs({
			value: store.read(this.key),
		});
	}
}

class LongTextPropertyUI extends PropertyUI {
	private area: HTMLTextAreaElement;
	public constructor(
		target: HTMLElement,
		private prop: ValuePropertyType<"text">,
		store: PropertyKeyStore,
	) {
		super();
		const id = getObjectID(prop);
		target.createChild("label")
			.addClasses("property-label-wide")
			.setAttrs({ htmlFor: id })
			.setContent(prop.displayName ?? "");

		this.area = target.createChild("textarea")
			.setAttrs({ id });
		this.area.value = store.read(prop.key);
	}

	public override reload(store: PropertyKeyStore): void {
		this.area.value = store.read(this.prop.key);
	}
}