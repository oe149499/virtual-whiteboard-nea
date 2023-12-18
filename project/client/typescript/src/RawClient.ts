import { MArgs, MName, MRet, MsgRecv, createMethodPayload } from "./GenWrapper.js";
import { Logger } from "./Logger.js";

const logger = new Logger("ws-client");

type CallRecord = {
	resolve: (_: MRet) => void;
	reject: (_: unknown) => void;
}

export class RawClient {
	private callId: number = 0;
	private socket: WebSocket | null = null;
	private calls: Record<number, CallRecord> = {};

	constructor(private url: URL) {
		this.bindSocket();
	}

	private bindSocket() {
		if (this.socket != null) {
			throw new Error("Attempted to bind socket when already present");
		}
		this.socket = new WebSocket(this.url);
		this.socket.onopen = this.onSocketOpen.bind(this);
		this.socket.onerror = this.onSocketError.bind(this);
		this.socket.onmessage = this.onSocketMessage.bind(this);
		this.socket.onclose = this.onSocketClose.bind(this);
	}

	private sendPayload(payload: string) {
		this.socket?.send(payload);
	}

	public callMethod<M extends MName>(name: M, args: MArgs<M>): Promise<MRet<M>> {
		const id = this.callId++;

		const payload = createMethodPayload(name, id, args);

		this.sendPayload(JSON.stringify(payload));

		const promise = new Promise<MRet<M>>((res, rej) => {
			this.calls[id] = {
				resolve: res,
				reject: rej,
			};
		});

		return promise;
	}

	private handleMessageObject(msg: MsgRecv) {
		const {protocol, id, value} = msg;
		switch(protocol) {
		case "Response": {
			if (id in this.calls) {
				this.calls[id].resolve(value);
				delete this.calls[id];
			} else {
				logger.error("Got response with no registered call");
			}
		} break;
		default: {
			logger.error(`Unknown message type: ${msg.protocol}`);
		}
		}
	}

	private onSocketOpen(_event: Event) {
		logger.info(`Connection opened at ${this.url}`);
	}

	private onSocketError(event: Event) {
		logger.error(`Socket connection error for ${this.url}:`, event);
	}

	private onSocketMessage(event: MessageEvent) {
		logger.info("Recieved message:", event);
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
}