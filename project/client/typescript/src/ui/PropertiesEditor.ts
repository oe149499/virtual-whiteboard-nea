import { Logger } from "../Logger.js";
import { ColorProperty, NumberProperty, Property, StructProperty } from "../Properties.js";
import { getObjectID } from "../util/Utils.js";
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
	private propertyCache = new ObjectCacheMap<Property[], HTMLDivElement>();
	private currentProps?: Property[];
	private currentElement?: HTMLElement;

	public constructor(
		private container: HTMLElement,
	) { }

	public loadProperties(props: Property[]) {
		logger.debug("loading properties");
		this.currentProps = props;
		this.currentElement?.remove();
		this.currentElement = this.propertyCache.get(props, (props) => {
			logger.debug("building properties: %o", props);
			const root = document.createElement("div").addClasses("property-container");
			for (const prop of props) {
				this.buildPropertyUI(root, prop);
			}
			return root;
		});
		this.container.prepend(this.currentElement);
	}

	private buildPropertyUI(target: HTMLElement, prop: Property) {
		logger.debug("%o", prop);
		if (prop instanceof NumberProperty) return this.buildNumberUI(target, prop);
		if (prop instanceof ColorProperty) return this.buildColorUI(target, prop);
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
				value: prop.get(),
				step: "any",
			});
		input.oninput = () => {
			if (input.checkValidity()) {
				prop.set(Number(input.value)).toString();
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
				value: prop.get(),
			});
		input.oninput = () => {
			input.value = prop.set(input.value);
		};
	}

	private buildStructUI(target: HTMLElement, prop: StructProperty) {
		const container = target.createChild("div")
			.addClasses("property-struct");
		container.createChild("span")
			.addClasses("struct-header")
			.setContent(prop.displayName);
		for (const innerProp of prop.fields) {
			this.buildPropertyUI(container, innerProp);
		}
	}
}