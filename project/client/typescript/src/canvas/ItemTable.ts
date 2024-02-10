import { ItemType, SpecificItem } from "../GenWrapper.js";
import { ClientID, Item, ItemID, Transform } from "../gen/Types.js";
import { CanvasContext } from "./CanvasBase.js";
import { CanvasItem } from "./items/CanvasItems.js";
import { None, Option, Some } from "../util/Utils.js";
import { State } from "../util/State.js";
import { DispatchMode, eventProvider, exclusiveProvider, keyedProvider, multiTargetProvider, singleTargetProvider } from "../util/Events.js";
import { SelectionBoxBase, UserSelection } from "./SelectionBox.js";
import { SessionClient } from "../client/Client.js";

export interface ItemEntry<T extends ItemType = ItemType> {
	id: ItemID;
	item: SpecificItem<T>;
	canvasItem: CanvasItem;
	selection: Option<ClientID>;
}

export interface SelectionEntry {
	readonly id: ClientID;
	readonly items: ReadonlySet<ItemID>;
}

interface SelectionEntryMut extends SelectionEntry {
	id: ClientID;
	items: Set<ItemID>;
	box: SelectionBoxBase;
}

interface SelectionHandlers {
	add(i: ItemEntry[]): void;
	move(t: Transform): void;
}

type SelectionHandlersT = { [K in keyof SelectionHandlers]: SelectionHandlers[K] };

type ItemHandlers = {
	insert(entry: ItemEntry): void,
}

interface ItemTableInit {
	onInsert?(entry: ItemEntry): void;
	selection?: Partial<SelectionHandlers>;
}

function* map<T, U>(src: Iterable<T>, fn: (_: T) => U) {
	for (const item of src) {
		yield fn(item);
	}
}

export class ItemTable {
	private table = new Map<ItemID, ItemEntry>();
	private selection = new Map<ClientID, SelectionEntryMut>();
	public readonly ownID: ClientID;

	public constructor(private client: SessionClient) {
		this.ownID = client.clientID;

		client.bindNotify("SelectionItemsAdded", ({ id, items }) => {
			if (id !== this.ownID) this.addSelection(id, items);
		});

		client.bindNotify("SelectionMoved", ({ id, transform }) => {
			if (id !== this.ownID) this._events.selection.emit("move", id, transform);
		});
	}

	private _events = {
		selection: keyedProvider<ClientID, SelectionHandlersT>(),
		items: multiTargetProvider<ItemHandlers>(),
		itemCreate: exclusiveProvider<[Item], CanvasItem>(),
		selectionCreate: exclusiveProvider<[id: ClientID], SelectionBoxBase>(),
	};

	public readonly events = Object.freeze({
		selection: this._events.selection.dispatcher,
		items: this._events.items.dispatcher,
		itemCreate: this._events.itemCreate.dispatcher,
		selectionCreate: this._events.selectionCreate.dispatcher,
	});

	public insert(id: ItemID, item: Item) {
		const canvasItem = this._events.itemCreate.call(item);
		const entry: ItemEntry = { id, item, canvasItem, selection: None };
		this.table.set(id, entry);
		this._events.items.emit("insert", entry);
		return canvasItem;
	}

	public get(ids: Iterable<ItemID>): Iterable<Option<ItemEntry>>;
	public get(id: ItemID): Option<ItemEntry>;
	public get(idOrIds: ItemID | Iterable<ItemID>): Option<ItemEntry> | Iterable<Option<ItemEntry>> {
		if (typeof idOrIds === "object") {
			return map(idOrIds, id => this.table.get(id) ?? None);
		}
		return this.table.get(idOrIds) ?? None;
	}

	public entries() {
		return this.table.values();
	}

	private addSelection(selection: ClientID, items: ItemID[]) {
		let selectionEntry = this.selection.get(selection);
		if (!selectionEntry) {
			selectionEntry = {
				id: selection,
				items: new Set(),
				box: this._events.selectionCreate.call(selection),
			};
			this.selection.set(selection, selectionEntry);
		}
		const itemEntries = Array.from(this.get(items)).filter(Some);

		this._events.selection.emit("add", selection, itemEntries);
	}

	public addOwnSelection(items: ItemID[]) {
		this.addSelection(this.ownID, items);
		this.client.method.SelectionAddItems({ items });
	}

	public moveOwnSelection(transform: Transform) {
		this.client.method.SelectionMove({ transform });
	}
}