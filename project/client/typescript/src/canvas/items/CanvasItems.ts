import { Bounds } from "../../Bounds.js";
import { Id, ItemType, SpecificItem } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { PropertySchema, PropertyStore, PropKey, PropType, PropValue } from "../../Properties.js";
import { PropertyTemplates } from "../../PropertyTemplates.js";
// import { AnyPropertyMap } from "../../Properties.js";
import { Color, ImageItem, Item, ItemID, Point, Stroke, Transform } from "../../gen/Types.js";
import { AutoMap, HookMap } from "../../ui/Maps.js";
import { Constructor, None, Option } from "../../util/Utils.js";
import { CanvasContext, FillHelper, StrokeHelper, TransformHelper } from "../CanvasBase.js";
import { ItemEntry, ItemTable } from "../ItemTable.js";

const logger = new Logger("canvas-items");

export abstract class CanvasItem {
	static readonly InitHook = new HookMap<CanvasItem, CanvasContext>();
	static readonly UpdateHook = new HookMap<CanvasItem>();
	static readonly PropertiesHook = new HookMap<CanvasItem, void, PropertySchema>();

	public readonly element: SVGGElement;
	// public readonly properties?: AnyPropertyMap;
	protected abstract get innerElement(): SVGGraphicsElement;

	public _update(value: Item) {
		this.updateItem(value);
		UpdateHook.trigger(this);
	}

	public abstract updateItem(value: Item): void;
	protected abstract item: Item;

	private static schemas: { [K in ItemType]?: PropertySchema[] } = {};

	public static schemaFor(item: CanvasItem) {
		if (item.item.type in this.schemas) {
			return this.schemas[item.item.type]!;
		} else {
			const schema = Array.from(PropertiesHook.collect(item));
			this.schemas[item.item.type] = schema;
			return schema;
		}
	}

	protected getBounds(): Bounds {
		return Bounds.of(this.element.getBBoxState());
	}

	#bounds: Option<Bounds> = None;

	public get bounds() {
		if (this.#bounds === None) this.#bounds = this.getBounds();
		return this.#bounds;
	}

	public testIntersection(target: Point): boolean {
		return this.bounds.testIntersection(target);
	}

	constructor(ctx: CanvasContext) {
		this.element = ctx.createElement("g");
		queueMicrotask(() => {
			CanvasItem.InitHook.trigger(this, ctx);
			this.element.appendChild(this.innerElement);
		});
	}

	protected checkType<T extends Item["type"]>(item: Item, type: T): asserts item is SpecificItem<T> {
		if (item.type !== type) logger.throw("Tried to update `%o` item with type `%o`: %o", type, item.type, item);
	}

	/** @deprecated */
	protected init?(ctx: CanvasContext): void;
	/** @deprecated */
	protected update?(): void;

	public static create(_ctx: CanvasContext, _item: Item): CanvasItem {
		throw new Error("not implemented here due to cyclic dependency");
	}
}

const { InitHook, UpdateHook, PropertiesHook } = CanvasItem;

interface ItemAcc<T extends ItemType, N extends PropType> {
	getter?(_: SpecificItem<T>): PropValue<N>;
	setter?(_: SpecificItem<T>, __: PropValue<N>): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AccMap<T extends ItemType> = AutoMap<PropKey<any>, ItemAcc<T, any>>;

export class ItemPropertyStore extends PropertyStore {
	public constructor(private items: ItemTable) { super(); }

	private currentItem: Option<ItemEntry> = None;
	private accessorTable: {
		[T in ItemType]?: AccMap<T>
	} = {};

	private getAccessor<T extends ItemType, N extends PropType>(type: T, key: PropKey<N>): ItemAcc<T, N> {
		let map: AccMap<T> | undefined = this.accessorTable[type];
		if (!map) {
			map = new AutoMap(_ => ({}));
			// @ts-ignore
			this.accessorTable[type] = map;
		}

		return map.get(key);
	}

	public bind(id: ItemID) {
		const entry = this.items.get(id);
		this.currentItem = entry ?? None;
	}

	public getter<T extends ItemType, N extends PropType>(type: T, key: PropKey<N>, fn: Required<ItemAcc<T, N>>["getter"]): this {
		this.getAccessor(type, key).getter = fn;
		return this;
	}

	public setter<T extends ItemType, N extends PropType>(type: T, key: PropKey<N>, fn: Required<ItemAcc<T, N>>["setter"]): this {
		this.getAccessor(type, key).setter = fn;
		return this;
	}

	protected override get<N extends PropType>(key: PropKey<N>) {
		if (this.currentItem === None) return PropertyStore.NoValue;
		const getter = this.getAccessor(this.currentItem.item.type, key).getter;
		if (!getter) return PropertyStore.NoValue;
		return getter(this.currentItem.item);
	}

	protected override set<N extends PropType>(key: PropKey<N>, value: PropValue<N>) {
		if (this.currentItem === None) return;
		const setter = this.getAccessor(this.currentItem.item.type, key).setter;
		if (!setter) return;
		setter(this.currentItem.item, value);
	}
}

export function TransformMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract override item: Extract<Item, { transform: Transform }>;

		protected transform!: TransformHelper;

		static {
			InitHook.add(this, function (ctx) {
				this.transform = new TransformHelper(ctx, this.innerElement.transform.baseVal, this.item.transform);
			});

			UpdateHook.add(this, function () {
				this.transform.update(this.item.transform);
			});
		}

		// protected override init?(ctx: CanvasContext): void {
		// 	this.transform = new TransformHelper(ctx, this.innerElement.transform.baseVal, this.item.transform);
		// 	super.init?.(ctx);
		// }

		// protected override update(): void {
		// 	this.transform.update(this.item.transform);
		// 	super.update?.();
		// }
	}

	return Derived;
}

TransformMixin.schema = PropertyTemplates.TransformSchema();

export function StrokeMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract override item: Extract<Item, { stroke: Stroke }>;

		#stroke?: StrokeHelper;

		static {
			InitHook.add(this, function () {
				this.#stroke = new StrokeHelper(this.innerElement.style, this.item.stroke);
			});

			UpdateHook.add(this, function () {
				this.#stroke?.update(this.item.stroke);
			});
		}

		// protected override init?(ctx: CanvasContext): void {
		// 	this.#stroke = new StrokeHelper(this.innerElement.style, this.item.stroke);
		// 	super.init?.(ctx);
		// }

		// protected override update(): void {
		// 	this.#stroke?.update(this.item.stroke);
		// 	super.update?.();
		// }
	}

	return Derived;
}

export function FillMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract override item: Extract<Item, { fill: Color }>;

		#fill?: FillHelper;

		static {
			InitHook.add(this, function () {
				this.#fill = new FillHelper(this.innerElement.style, this.item.fill);
			});

			UpdateHook.add(this, function () {
				this.#fill?.update(this.item.fill);
			});
		}

		// protected override init?(ctx: CanvasContext): void {
		// 	this.#fill = new FillHelper(this.innerElement.style, this.item.fill);
		// 	super.init?.(ctx);
		// }

		// protected override update?(): void {
		// 	this.#fill?.update(this.item.fill);
		// 	super.update?.();
		// }
	}

	return Derived;
}

export class Image extends TransformMixin(CanvasItem) {
	private elem: SVGImageElement;

	public override get innerElement() { return this.elem; }

	// private transform: TransformHelper;

	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Image">,
	) {
		super(ctx);

		const elem = ctx.createElement("image")
			.setAttrs({
				href: item.url,
			});
		this.elem = elem;

		//this.init?.(ctx);

		// this.transform = new TransformHelper(ctx, elem.transform.baseVal, item.transform);
		//this.transform.createExtra().setScale(1 / 37.8, 1 / 37.8);
	}

	static {
		InitHook.add(this, function () {
			this.transform.createExtra().setScale(1 / 37.8, 1 / 37.8);
		});
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Image");
		this.item = value;

		// this.update?.();

		// this.transform.update(value.transform);
	}
}