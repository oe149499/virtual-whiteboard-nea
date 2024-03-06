import { Logger } from "../Logger.js";
import { PropertyStore, PropType, ValuePropertyType, PropKey, PropertySchema, StructPropertySchema, PropValue, type PropertyInstance } from "../Properties.js";
import { AutoMap } from "../util/Maps.js";
import { State } from "../util/State.js";
import { None, Option, getObjectID } from "../util/Utils.js";
import { ResourcePicker } from "./ResourcePicker.js";
const logger = new Logger("ui/PropertiesEditor");

export class PropertyEditor {
	private uiTable = new AutoMap((props: PropertySchema[]) => new PropertyUIContainer(props));
	private currentElement?: HTMLElement;

	public constructor(
		private container: HTMLElement,
		propState: State<Option<PropertyInstance>>,
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
		const current = this.uiTable.get(props);
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
	protected abstract build(): void;

	private static _create(
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

	public static create(
		target: HTMLElement,
		prop: PropertySchema,
	): PropertyUI {
		const ui = this._create(target, prop);
		ui.build();
		return ui;
	}
}

class PropertyUIContainer {
	public readonly element: HTMLElement;
	private children: PropertyUI[] = [];

	public constructor(
		public readonly schema: PropertySchema[],
	) {
		this.element = document.createElement("div")
			.addClasses("property-container");
		for (const item of schema) {
			this.children.push(PropertyUI.create(this.element, item));
		}
	}

	public reload(store: PropertyStore) {
		for (const child of this.children) {
			child.reload(store);
		}
	}
}

abstract class ValuePropertyUI<N extends PropType> extends PropertyUI {
	protected readonly key: PropKey<N>;
	protected store: Option<PropertyStore> = None;

	protected container: HTMLDivElement;
	protected label: HTMLLabelElement;
	protected id: number;

	public constructor(
		target: HTMLElement,
		protected readonly prop: ValuePropertyType<N>,
	) {
		super();
		this.id = getObjectID(prop);

		this.label = target.createChild("label")
			.setAttrs({ htmlFor: this.id })
			.setContent(prop.displayName ?? "");

		this.container = target.createChild("div")
			.addClasses("passthrough");

		this.key = prop.key;
	}

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

	protected override build(): void {
		this.input = this.container.createChild("input")
			.setAttrs({ id: this.id });
		this.init();
	}

	protected abstract init(): void;
}

abstract class WidePropertyUI<N extends PropType> extends ValuePropertyUI<N> {
	protected override build(): void {
		this.label.addClasses("property-label-wide");
		this.init();
	}

	protected abstract init(): void;
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

		this.input.oninput = () => this.update(this.input.value);
	}

	protected override load(value: string): void {
		this.input.value = value;
	}
}

class LongTextPropertyUI extends WidePropertyUI<"text"> {
	private area!: HTMLTextAreaElement;

	protected override init(): void {
		this.area = this.container.createChild("textarea")
			.setAttrs({ id: this.id });

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

	protected override init(): void {
		this.picker = new ResourcePicker(this.container, url => {
			this.update(url);
		});
	}

	protected override load(value: Option<string>): void {
		this.picker.load(value);
	}
}

class StructPropertyUI extends PropertyUI {
	private children: PropertyUI[] = [];

	public constructor(
		target: HTMLElement,
		prop: StructPropertySchema,
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

	protected override build(): void {
		for (const child of this.children) child["build"]();
	}

	public override reload(store: PropertyStore): void {
		for (const child of this.children) {
			child.reload(store);
		}
	}
}