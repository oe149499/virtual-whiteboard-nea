import { Logger } from "../Logger.js";
import { AnyPropertyMap, ColorProperty, NumberProperty, Property, StructProperty } from "../Properties.js";
import { ToolState } from "../tool/Tool.js";
import { State } from "../util/State.js";
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
	private propertyCache = new ObjectCacheMap<AnyPropertyMap, HTMLDivElement>();
	private currentElement?: HTMLElement;

	public constructor(
		private container: HTMLElement,
		toolState: State<ToolState>,
	) {
		toolState.watch(s => {
			if (s) {
				const props = s.tool.properties;
				if (props) this.loadProperties(props);
			} else this.currentElement?.remove();
		});
	}

	public loadProperties(props: AnyPropertyMap) {
		logger.debug("loading properties");
		const current = this.propertyCache.get(props, (props) => {
			logger.debug("building properties: %o", props);
			const root = document.createElement("div").addClasses("property-container");
			for (const name in props) {
				this.buildPropertyUI(root, props[name]);
			}
			return root;
		});
		if (current !== this.currentElement) {
			this.currentElement?.remove();
			this.container.prepend(current);
			this.currentElement = current;
		}
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