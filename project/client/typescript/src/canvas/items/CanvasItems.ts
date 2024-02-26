import { Bounds } from "../../Bounds.js";
import { ItemType, SpecificItem } from "../../GenWrapper.js";
import { Logger } from "../../Logger.js";
import { PropertySchema, PropertyStore, PropKey, PropType, PropValue } from "../../Properties.js";
import { PropertyTemplates } from "../../PropertyTemplates.js";
// import { AnyPropertyMap } from "../../Properties.js";
import { Color, Item, ItemID, Point, Stroke, Transform, type LocationUpdate } from "../../gen/Types.js";
import { AutoMap, HookMap } from "../../util/Maps.js";
import { Constructor, None, Option } from "../../util/Utils.js";
import { CanvasContext, CenterHelper, FillHelper, StrokeHelper, TransformHelper } from "../CanvasBase.js";
import { ItemEntry, BoardTable } from "../../BoardTable.js";
import { ReadonlyAs } from "../../util/State.js";
import { fromMatrix, updateMatrix } from "../../Transform.js";

const logger = new Logger("canvas-items");

export abstract class CanvasItem {
	[ReadonlyAs]?(): CanvasItem;
	static readonly InitHook = new HookMap<CanvasItem, CanvasContext>();
	static readonly UpdateHook = new HookMap<CanvasItem>();
	static readonly PropertiesHook = new HookMap<CanvasItem, ItemPropertyStore, PropertySchema>();

	public readonly element: SVGGElement;
	protected abstract get innerElement(): SVGGraphicsElement;

	public update(value: Item) {
		this.updateItem(value);
		UpdateHook.trigger(this);
	}

	public abstract updateItem(value: Item): void;
	protected abstract item: Item;

	private static schemas: { [K in ItemType]?: PropertySchema[] } = {};

	public static schemaFor(item: CanvasItem, store: ItemPropertyStore) {
		if (item.item.type in this.schemas) {
			return this.schemas[item.item.type]!;
		} else {
			const schema = Array.from(PropertiesHook.collect(item, store));
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
		this.element = ctx.createElement("g").addClasses("item-outer");
		queueMicrotask(() => {
			CanvasItem.InitHook.trigger(this, ctx);
			this.element.appendChild(this.innerElement);
		});
	}

	public abstract getLocationUpdate(transform: DOMMatrix): LocationUpdate;
	public abstract applylocationUpdate(update: LocationUpdate): void;

	protected checkType<T extends Item["type"]>(item: Item, type: T): asserts item is SpecificItem<T> {
		if (item.type !== type) logger.throw("Tried to update `%o` item with type `%o`: %o", type, item.type, item);
	}

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
	public constructor(private table: BoardTable) { super(); }

	private currentItem: ItemEntry[] = [];
	private accessorTable: {
		[T in ItemType]?: AccMap<T>
	} = {};

	private getAccessor<T extends ItemType, N extends PropType>(type: T, key: PropKey<N>): ItemAcc<T, N> {
		let map: AccMap<T> | undefined = this.accessorTable[type];
		if (!map) {
			map = new AutoMap(_ => ({}));
			// @ts-expect-error I'm putting it back where I got it from
			this.accessorTable[type] = map;
		}

		return map.get(key);
	}

	public bind(id: ItemID) {
		const entry = this.table.get(id);
		if (entry === None) return;
		this.currentItem = [entry];
	}

	public bindEntries(entries: Iterable<ItemEntry>) {
		this.currentItem = Array.from(entries);
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
		for (const { item } of this.currentItem) {
			const getter = this.getAccessor(item.type, key).getter;
			if (!getter) return PropertyStore.NoValue;
			return getter(item);
		}
		return PropertyStore.NoValue;
	}

	protected override set<N extends PropType>(key: PropKey<N>, value: PropValue<N>) {
		for (const entry of this.currentItem) {
			const { item } = entry;
			const setter = this.getAccessor(item.type, key).setter;
			if (!setter) continue;
			setter(item, value);
			this.table.editSelectedItem(entry);
		}
	}
}

export function TransformMixin<TBase extends Constructor<CanvasItem>>(Base: TBase) {
	abstract class Derived extends Base {
		protected abstract override item: Extract<Item, { transform: Transform }>;

		protected transform!: TransformHelper;

		public override getLocationUpdate(transform: DOMMatrix): LocationUpdate {
			const mat = updateMatrix(new DOMMatrix(), this.item.transform);
			mat.preMultiplySelf(transform);
			const t = fromMatrix(mat);
			// this.transform.update(t);
			// this.item.transform = t;
			return { Transform: t };
		}

		public override applylocationUpdate(update: LocationUpdate): void {
			if ("Points" in update) return;
			const { Transform: t } = update;
			this.transform.update(t);
			this.item.transform = t;
		}

		static {
			InitHook.add(this, function (ctx) {
				this.transform = new TransformHelper(ctx, this.innerElement.transform.baseVal, this.item.transform);
			});

			UpdateHook.add(this, function () {
				this.transform.update(this.item.transform);
			});
		}
	}

	return Derived;
}

TransformMixin.schema = PropertyTemplates.TransformSchema();


export abstract class StrokeItem extends CanvasItem {
	protected abstract override item: Extract<Item, { stroke: Stroke }>;

	#stroke?: StrokeHelper;

	static schema: PropertySchema[];

	static {
		InitHook.add(this, function () {
			this.#stroke = new StrokeHelper(this.innerElement.style, this.item.stroke);
		});

		UpdateHook.add(this, function () {
			this.#stroke?.update(this.item.stroke);
		});


		const { keys, schema } = PropertyTemplates.StrokeSchema();
		this.schema = [schema];

		PropertiesHook.add(this, function (store) {
			const t = this.item.type;
			store.getter(t, keys.color, item => item.stroke.color);
			store.setter(t, keys.color, (item, color) => item.stroke.color = color);
			store.getter(t, keys.width, item => item.stroke.width);
			store.setter(t, keys.width, (item, val) => item.stroke.width = val);

			return schema;
		});
	}
}



export abstract class FillItem extends StrokeItem {
	protected abstract override item: Extract<Item, { fill: Color }>;

	#fill?: FillHelper;

	static override schema: PropertySchema[];

	static {
		InitHook.add(this, function () {
			this.#fill = new FillHelper(this.innerElement.style, this.item.fill);
		});

		UpdateHook.add(this, function () {
			this.#fill?.update(this.item.fill);
		});

		const key = new PropKey("color");
		const schema: PropertySchema = {
			type: "color",
			key,
			displayName: "Fill color",
		};
		this.schema = [schema, ...super.schema];

		PropertiesHook.add(this, function (store) {
			store.getter(this.item.type, key, item => item.fill);
			store.setter(this.item.type, key, ((item, color) => item.fill = color));
			return schema;
		});
	}
}

export class Image extends TransformMixin(CanvasItem) {
	private elem: SVGGraphicsElement;

	public override get innerElement() { return this.elem; }
	public constructor(
		ctx: CanvasContext,
		protected item: SpecificItem<"Image">,
	) {
		super(ctx);

		const elem = ctx.createElement("image")
			.setAttrs({
				href: item.url,
			});
		this.elem = CenterHelper.of(elem);
	}

	static {
		InitHook.add(this, function () {
			this.transform.createExtra().setScale(1 / 37.8, 1 / 37.8);
		});
	}

	public override updateItem(value: Item): void {
		this.checkType(value, "Image");
		this.item = value;
	}
}
