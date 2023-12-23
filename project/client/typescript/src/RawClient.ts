import { MArgs, MName, MRet, MsgRecv, createMethodPayload, NCName, NCArgs, MethodHandler } from "./GenWrapper.js";
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
	private notifyCHandlers: {
		[K in NCName]?: (_:NCArgs<K>) => void;
	} = {};


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

	public getMethodHandler(): MethodHandler {
		return this.callMethod.bind(this);
	}

	public setNotifyHandler<N extends NCName>(
		name: N,
		handler: (_:NCArgs<N>) => void,
	) {
		// @ts-expect-error trust me bro
		this.notifyCHandlers[name] = handler;
	}

	private handleMessageObject(msg: MsgRecv) {
		switch(msg.protocol) {
		case "Response": {
			const {id, value} = msg;
			if (id in this.calls) {
				this.calls[id].resolve(value);
				delete this.calls[id];
			} else {
				logger.error("Got response with no registered call");
			}
		} break;
		case "Notify-C": {
			const {protocol:_, name, ...args} = msg;
			this.handleNotifyC(name, args);
		} break;
		default: {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			logger.error(`Unknown message type: ${(msg as any).protocol}`);
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

	private handleNotifyC<N extends NCName>(name: N, args: NCArgs<N>) {
		const handler = this.notifyCHandlers[name];
		if (handler !== undefined) {
			handler(args);
		} else {
			logger.error(`No handler set for Notify-C type ${name}`);
		}
	}
}