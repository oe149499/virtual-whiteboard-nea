import { ItemType, MArgs, SpecificItem } from "../GenWrapper.js";
import { ClientID, Item, ItemID, Transform, type ClientInfo } from "../gen/Types.js";
import { CanvasItem } from "./items/CanvasItems.js";
import { None, Option, Some, ok, todo, unwrapOption } from "../util/Utils.js";
import { exclusiveProvider, keyedProvider, multiTargetProvider } from "../util/Events.js";
import { SessionClient } from "../client/Client.js";
import { Logger } from "../Logger.js";
import { invertTransform, unitTransform } from "../Transform.js";
import { LocalSelection, RemoteSelection, RemoteSelectionInit, TransformRecord } from "./Selection.js";

const logger = new Logger("ItemTable");

export interface ItemEntry<T extends ItemType = ItemType> {
	id: ItemID;
	item: SpecificItem<T>;
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

interface SelectionHandlers {
	add(i: ItemEntry[]): void;
	move(t: Transform): void;
}

type SelectionHandlersT = { [K in keyof SelectionHandlers]: SelectionHandlers[K] };

type ItemHandlers = {
	insert(entry: ItemEntry): void,
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

		for await (const [item, id] of this.client.iterate.GetFullItems({ ids: items }).dechunk().zipWith(items)) {
			if (ok(item)) {
				this.addItem(id, item.value);
			}
		}

		const clients = await this.client.method.GetAllClientIDs({});

		this.bindClientEvents();

		await Promise.all(clients.map(id => this.addClient(id)));

		this.bindSelectionEvents();
	}

	private bindClientEvents() {
		this.client.bindNotify("ClientJoined", ({ id }) => {
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
		this.client.bindNotify("SelectionItemsAdded", ({ id, items, new_srt }) => {
			const entry = this.clients.assume(id);

			const sit = invertTransform(new_srt);
			const item_entries: TransformRecord[] = items.map(id => [id, sit]);

			entry.items.addFrom(items);
			if (entry.box === None) {
				const box = this._events.remoteSelectionCreate.call({
					id,
					items: item_entries,
					srt: new_srt,
				});
				entry.box = box;
			} else {
				entry.box.addItems(item_entries, new_srt);
			}
		});

		this.client.bindNotify("SelectionItemsRemoved", ({ id, items }) => {
			todo(id, items);
		});

		this.client.bindNotify("SelectionMoved", ({ id, transform }) => {
			this._events.selection.emit("move", id, transform);
		});
	}

	private async addClient(id: ClientID) {
		const { info, paths, selectedItems, selectionTransform } = await this.client.method.GetClientState({ clientId: id });

		const entry: RemoteEntry = {
			id,
			info,
			items: new Set(selectedItems.map(([id]) => id)),
			connection: ConnectionState.Unknown,
			box: None,
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
		ownSelectionCreate: exclusiveProvider<[], LocalSelection>(),
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
		// @ts-ignore not enough narrowing
		return self;
	}

	// private ensureSelection(client: ClientID) {
	// 	const clientEntry = this.clients.get(client);
	// 	if (!clientEntry) return logger.throw("Missing client ID: ", client);
	// 	if (clientEntry.box === None)
	// 		clientEntry.box = this._events.remoteSelectionCreate.call({
	// 			id: client,
	// 			items: {},
	// 			transform: unitTransform(),
	// 		});
	// 	return clientEntry as ClientEntryMut & { box: SelectionBoxBase };
	// }

	// private addSelection(selection: ClientID, items: ItemID[]) {
	// 	const selectionEntry = this.ensureSelection(selection);

	// 	for (const item of items) {
	// 		if (this.items.get(item)?.selection !== None) continue;
	// 		selectionEntry.items.add(item);
	// 	}

	// 	const itemEntries = Array.from(this.get(items)).filter(Some);

	// 	this._events.selection.emit("add", selection, itemEntries);
	// }

	public addOwnSelection(items: ItemID[]) {
		const self = this.ensureLocalBox();
		const entries = [];
		for (const item of this.get(items, true)) {
			if (item.selection !== None) continue;
			item.selection = self.id;
			entries.push(item);
		}

		self.items.addFrom(items);

		const payload = self.box.createAddPayload(entries);

		this.client.method.SelectionAddItems(payload);
	}

	public moveOwnSelection(transform: Transform) {
		this.client.method.SelectionMove({ newSrt: transform });
	}
}