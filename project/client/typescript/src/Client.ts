import { Logger } from "./Logger.js";

const logger = new Logger("ws-client");

export class Client {
	private socket: WebSocket | null = null;

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

	private handleMessageObject(msg: object) {
		console.log(msg);
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