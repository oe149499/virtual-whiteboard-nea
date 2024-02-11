import { MArgs, MName, MRet, MsgRecv, createMethodPayload, NCName, NCArgs, IName, IArgs, IItem, createIteratePayload } from "../GenWrapper.js";
import { Logger } from "../Logger.js";
import { AsyncIter } from "../util/AsyncIter.js";
import { Channel, makeChannel } from "../util/Channel.js";
import { IterateReceiver, createReceiver } from "./IterateReceiver.js";

const logger = new Logger("ws-client");

type CallRecord = {
	resolve: (_: MRet) => void,
	reject: (_: unknown) => void,
}

export class RawClient {
	private callId: number = 0;
	private socket: WebSocket;
	private calls: Record<number, CallRecord> = {};
	private notifyCHandlers: {
		[K in NCName]?: (_: NCArgs<K>) => void;
	} = {};

	private iterateReceivers: {
		[n: number]: IterateReceiver<IName>,
	} = {};

	private messageQueue: Channel<string>;
	private messageStream: AsyncIter<string>;

	constructor(private url: URL) {
		[this.messageQueue, this.messageStream] = makeChannel();

		this.socket = new WebSocket(this.url);
		this.bindSocket();
	}

	private bindSocket() {
		this.socket.onopen = this.onSocketOpen.bind(this);
		this.socket.onerror = this.onSocketError.bind(this);
		this.socket.onmessage = this.onSocketMessage.bind(this);
		this.socket.onclose = this.onSocketClose.bind(this);
	}

	private sendPayload(payload: string) {
		this.messageQueue.push(payload);
	}

	public callMethod<M extends MName>(name: M, args: MArgs<M>): Promise<MRet<M>> {
		const id = this.callId++;

		const payload = createMethodPayload(name, id, args);

		this.sendPayload(JSON.stringify(payload));

		return new Promise<MRet<M>>((resolve, reject) => {
			this.calls[id] = { resolve, reject };
		});
	}

	public callIterate<I extends IName>(name: I, args: IArgs<I>): AsyncIter<IItem<I>[]> {
		const id = this.callId++;

		const payload = createIteratePayload(name, id, args);

		this.sendPayload(JSON.stringify(payload));

		const [receiver, iter] = createReceiver<I>();

		// @ts-expect-error This all relies on the ID being handled correctly
		this.iterateReceivers[id] = receiver;

		return iter;
	}

	public setNotifyHandler<N extends NCName>(
		name: N,
		handler: (_: NCArgs<N>) => void,
	) {
		// @ts-expect-error enum generics
		this.notifyCHandlers[name] = handler;
	}

	private handleMessageObject(msg: MsgRecv) {
		logger.trace("Parsed Message Object: ", msg);
		switch (msg.protocol) {
			case "Response": {
				const { id, value } = msg;
				if (id in this.calls) {
					this.calls[id].resolve(value);
					delete this.calls[id];
				} else {
					logger.error("Got response with no registered call");
				}
			} break;
			case "Notify-C": {
				const { protocol: _, name, ...args } = msg;
				this.handleNotifyC(name, args);
			} break;
			case "Response-Part": {
				const id = msg.id;
				const rec = this.iterateReceivers[id];
				if (rec) {
					rec.handlePayload(msg);
					if (rec.finished) delete this.iterateReceivers[id];
				} else {
					logger.error("Got Iterate response with no registered receiver");
				}
			} break;
			default: {
				logger.error(`Unknown message type: ${msg}`);
			}
		}
	}

	private async onSocketOpen(_event: Event) {
		logger.info(`Connection opened at ${this.url}`);

		for await (const payload of this.messageStream) {
			this.socket.send(payload);
		}
	}

	private onSocketError(event: Event) {
		logger.error(`Socket connection error for ${this.url}:`, event);
	}

	private onSocketMessage(event: MessageEvent) {
		logger.trace("Recieved message:", event);
		const data = event.data;
		if (data instanceof Blob) {
			data.text()
				.then(s => this.handleMessageObject(JSON.parse(s)));
		} else if (typeof data == "string") {
			this.handleMessageObject(JSON.parse(data));
		}
	}

	private onSocketClose(event: CloseEvent) {
		logger.info("Socket Closed:", event);
	}

	private handleNotifyC<N extends NCName>(name: N, args: NCArgs<N>) {
		const handler: ((_: NCArgs<N>) => void) | undefined = this.notifyCHandlers[name];
		if (handler) handler(args);
		else logger.error(`No handler set for Notify-C type ${name}`);
	}
}