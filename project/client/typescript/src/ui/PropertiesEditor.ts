import { ColorProperty, NumberProperty, Property } from "../Properties";
import { getObjectID } from "../util/Utils";


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
		this.currentProps = props;
		this.currentElement?.remove();
		this.currentElement = this.propertyCache.get(props, (props) => {
			const root = document.createElement("div").addClasses("property-container");
			for (const prop of props) {
				root.createChild("div").addClasses("transparent-container");
			}
			return root;
		});
		this.container.prepend(this.currentElement);
	}

	private buildPropertyUI(target: HTMLElement, prop: Property) {
		if (prop instanceof NumberProperty) return this.buildNumberUI(target, prop);
	}

	private buildNumberUI(target: HTMLElement, prop: NumberProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ for: propID })
			.setContent(prop.displayName);
		target.createChild("input")
			.addClasses("property-number")
			.setAttrs({
				type: "number",
				id: propID,
			});

	}

	private buildColorUI(target: HTMLElement, prop: ColorProperty) {
		const propID = getObjectID(prop);
		target.createChild("label")
			.setAttrs({ for: propID })
			.setContent(prop.displayName);
		target.createChild("input")
			.addClasses("property-color")
			.setAttrs({
				type: "color",
				id: propID,
			});
	}
}