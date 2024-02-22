import { ItemType, SpecificItem } from "./GenWrapper.js";
import { ClientID, Item, ItemID, Transform, type ClientInfo, type LocationUpdate } from "./gen/Types.js";
import { CanvasItem } from "./canvas/items/CanvasItems.js";
import { None, Option, Some, ok, todo } from "./util/Utils.js";
import { exclusiveProvider, keyedProvider, multiTargetProvider } from "./util/Events.js";
import { SessionClient } from "./client/Client.js";
import { Logger } from "./Logger.js";
import { invertTransform } from "./Transform.js";
import { LocalSelection, RemoteSelection, RemoteSelectionInit, TransformRecord } from "./canvas/Selection.js";
import { mutableStateOf, type ReadonlyAs, type State } from "./util/State.js";

const logger = new Logger("ItemTable");

export interface ItemEntry<T extends ItemType = ItemType> {
	id: ItemID;
	item: SpecificItem<T> & ReadonlyAs<SpecificItem<T>>;
	canvasItem: CanvasItem;
	selection: Option<ClientID>;
}

export enum ConnectionState {
	Unknown,
	Disconnected,
	Connected,
	Exited,
}

export interface ClientEntry {
	[ReadonlyAs]?(): ClientEntry;
	readonly id: ClientID;
	readonly items: ReadonlySet<ItemID>;
	readonly info: Readonly<ClientInfo>;
	readonly connection: ConnectionState;
}

interface ClientEntryMut extends ClientEntry {
	id: ClientID;
	items: Set<ItemID>;
	info: ClientInfo;
	connection: ConnectionState;
}

interface RemoteEntry extends ClientEntryMut {
	box: Option<RemoteSelection>;
}

interface SelfEntry extends ClientEntryMut {
	box: Option<LocalSelection>;
}

export enum LocalSelectionCount {
	None,
	One,
	Multiple,
}

type LocalSelectionState = {
	type: LocalSelectionCount.None,
} | {
	type: LocalSelectionCount.One,
	entry: ItemEntry,
} | {
	type: LocalSelectionCount.Multiple,
	ids: ReadonlySet<ItemID>,
};

interface SelectionHandlers {
	add(i: ItemEntry[]): void;
	move(t: Transform): void;
}

type SelectionHandlersT = { [K in keyof SelectionHandlers]: SelectionHandlers[K] };

type ItemHandlers = {
	insert(entry: ItemEntry): void,
	deselect(entry: ItemEntry): void,
}

function* map<T, U>(src: Iterable<T>, fn: (_: T) => U) {
	for (const item of src) {
		yield fn(item);
	}
}

function* mapFilter<T, U, V extends U>(src: Iterable<T>, fn: (_: T) => U, filter: (_: U) => _ is V) {
	for (const t of src) {
		const u = fn(t);
		if (filter(u)) yield u;
	}
}

export class BoardTable {
	private items = new Map<ItemID, ItemEntry>();
	private clients = new Map<ClientID, RemoteEntry>();
	private self: SelfEntry;
	public readonly ownID: ClientID;

	private _selectionState = mutableStateOf<LocalSelectionState>({ type: LocalSelectionCount.None });
	public readonly selectionState = this._selectionState.asReadonly();

	public constructor(private client: SessionClient) {
		this.ownID = client.clientID;

		this.self = {
			id: this.ownID,
			items: new Set(),
			info: client.info,
			connection: ConnectionState.Connected,
			box: None,
		};

		this.bootstrap();
	}

	private async bootstrap() {
		const items = await this.client.method.GetAllItemIDs({});

		this.client.bindNotify("ItemCreated", ({ id, item }) => {
			if (this.items.has(id)) return;
			this.addItem(id, item);
		});

		this.client.bindNotify("SingleItemEdited", ({ id, item }) => {
			const entry = this.items.assume(id);
			if (this.self.items.has(id)) return;
			entry.item = item;
			entry.canvasItem.update(item);
		});

		for await (const res of this.client.iterate.GetFullItems({ ids: items }).dechunk()) {
			if (ok(res)) {
				const [id, item] = res.value;
				this.addItem(id, item);
			}
		}

		const clients = await this.client.method.GetAllClientIDs({});

		this.bindClientEvents();

		const ownInfo = await this.client.method.GetClientState({ clientId: this.ownID });
		logger.debug("own info: ", ownInfo);
		for (const [id] of ownInfo.selectedItems) {
			this.self.items.add(id);
		}
		this.self.box = this._events.ownSelectionCreate.call(ownInfo.selectionTransform, ownInfo.selectedItems);

		this.updateSelectionState();

		await Promise.all(clients.map(id => this.addClient(id)));

		this.bindSelectionEvents();
	}

	private bindClientEvents() {
		this.client.bindNotify("ClientJoined", ({ id }) => {
			if (id === this.ownID) return;
			this.addClient(id);
		});

		this.client.bindNotify("ClientConnected", ({ id }) => {
			this.clients.get(id)!.connection = ConnectionState.Connected;
		});

		this.client.bindNotify("ClientDisconnected", ({ id }) => {
			this.clients.get(id)!.connection = ConnectionState.Disconnected;
		});

		this.client.bindNotify("ClientExited", ({ id }) => {
			this.clients.get(id)!.connection = ConnectionState.Exited;
		});
	}

	private bindSelectionEvents() {
		this.client.bindNotify("SelectionItemsAdded", ({ id, items, newSrt }) => {
			if (id === this.ownID) return;
			const entry = this.clients.assume(id);

			const sit = invertTransform(newSrt);
			const item_entries: TransformRecord[] = items.map(id => [id, sit]);

			entry.items.addFrom(items);
			if (entry.box === None) {
				const box = this._events.remoteSelectionCreate.call({
					id,
					items: item_entries,
					srt: newSrt,
				});
				entry.box = box;
			} else {
				entry.box.addItems(item_entries, newSrt);
			}
		});

		this.client.bindNotify("SelectionItemsRemoved", ({ id, items }) => {
			if (id == this.ownID) return;
			for (const [id, update] of items) {
				const entry = this.items.assume(id);
				entry.canvasItem.applylocationUpdate(update);
				this._events.items.emit("deselect", entry);
			}
		});

		this.client.bindNotify("SelectionMoved", ({ id, transform, newSits }) => {
			if (id == this.ownID) return;
			const box = this.clients.assume(id).box;
			if (box === None) return;
			box.moveItems(transform, newSits);
		});
	}

	private async addClient(id: ClientID) {
		if (id === this.ownID) return;
		const { info, paths: _, selectedItems, selectionTransform } = await this.client.method.GetClientState({ clientId: id });

		for (const [itemId] of selectedItems) {
			this.items.assume(itemId).selection = id;
		}

		const entry: RemoteEntry = {
			id,
			info,
			items: new Set(selectedItems.map(([id]) => id)),
			connection: ConnectionState.Unknown,
			box: this._events.remoteSelectionCreate.call({ srt: selectionTransform, items: selectedItems, id }),
		};

		this.clients.set(id, entry);
	}

	public addItem(id: ItemID, item: Item) {
		const canvasItem = this._events.itemCreate.call(item);
		const entry: ItemEntry = { id, item, canvasItem, selection: None };
		this.items.set(id, entry);
		this._events.items.emit("insert", entry);
		return canvasItem;
	}

	private _events = {
		selection: keyedProvider<ClientID, SelectionHandlersT>(),
		items: multiTargetProvider<ItemHandlers>(),
		itemCreate: exclusiveProvider<[Item], CanvasItem>(),
		remoteSelectionCreate: exclusiveProvider<[_: RemoteSelectionInit], RemoteSelection>(),
		ownSelectionCreate: exclusiveProvider<[] | [srt: Transform, items: [ItemID, Transform][]], LocalSelection>(),
	};

	public readonly events = Object.freeze({
		selection: this._events.selection.dispatcher,
		items: this._events.items.dispatcher,
		itemCreate: this._events.itemCreate.dispatcher,
		remoteSelectionCreate: this._events.remoteSelectionCreate.dispatcher,
		ownSelectionCreate: this._events.ownSelectionCreate.dispatcher,
	});

	public get(ids: Iterable<ItemID>): Iterable<Option<ItemEntry>>;
	public get(ids: Iterable<ItemID>, filter: true): Iterable<ItemEntry>
	public get(id: ItemID): Option<ItemEntry>;
	public get(idOrIds: ItemID | Iterable<ItemID>, filter?: true): Option<ItemEntry> | Iterable<Option<ItemEntry>> {
		if (typeof idOrIds === "object") {
			if (filter) return mapFilter(idOrIds, id => this.items.get(id) ?? None, Some);
			return map(idOrIds, id => this.items.get(id) ?? None);
		}
		return this.items.get(idOrIds) ?? None;
	}

	public entries() {
		return this.items.values();
	}

	private ensureLocalBox(): SelfEntry & { box: LocalSelection } {
		const self = this.self;
		if (self.box === None) {
			self.box = this._events.ownSelectionCreate.call();
		}
		return self as SelfEntry & { box: LocalSelection };
	}

	private updateSelectionState() {
		const count = this.self.items.size;
		if (count === 0) this._selectionState.mutate(s => s.type = LocalSelectionCount.None);
		else if (count == 1) this._selectionState.set({
			type: LocalSelectionCount.One,
			entry: this.items.assume(this.self.items.first()!),
		});
		else this._selectionState.set({
			type: LocalSelectionCount.Multiple,
			ids: this.self.items,
		});
	}

	public addOwnSelection(items: ItemID[]) {
		const self = this.ensureLocalBox();
		const entries = [];
		for (const item of this.get(items, true)) {
			if (item.selection !== None) continue;
			item.selection = self.id;
			entries.push(item);
			self.items.add(item.id);
		}

		// self.items.addFrom(items);

		const payload = self.box.createAddPayload(entries);

		logger.debug("Sending payload: ", payload);

		this.client.method.SelectionAddItems(payload).then(res => logger.debug("Add items result: ", res));

		this.updateSelectionState();
	}

	public moveOwnSelection(transform: Transform) {
		this.client.method.SelectionMove({ newSrt: transform });
	}

	public cancelSelection() {
		const items: [ItemID, LocationUpdate][] = [];

		const box = this.self.box;
		if (box === None) return;

		for (const [id, transform] of box.getFinalTransforms()) {
			const entry = this.items.assume(id);
			const update = entry.canvasItem.getLocationUpdate(transform);
			entry.canvasItem.applylocationUpdate(update);
			items.push([id, update]);
			entry.selection = None;
			this._events.items.emit("deselect", entry);
		}

		this.client.method.SelectionRemoveItems({ items });
	}

	public editSelectedItem(entry: ItemEntry) {
		entry.canvasItem.update(entry.item);
		logger.debug("Editing entry: ", entry);
		this.client.method.EditSingleItem({
			itemId: entry.id,
			item: entry.item,
		});
	}
}