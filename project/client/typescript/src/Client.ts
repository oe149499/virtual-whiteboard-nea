import { Logger } from "./Logger.js";
import { RawClient } from "./RawClient.js";
import { getErr, getOk } from "./Utils.js";
import { ClientInfo } from "./gen/Types.js";

const logger = new Logger("session-client");

export class SessionClient {
	private rawClient: RawClient;
	private sessionCode?: number;
	private _clientID?: number;
	public get clientID() {
		return this._clientID;
	}
	readonly url: URL;

	constructor(
		readonly boardName: string,
		readonly info: ClientInfo,
	) {	
		const location = window.location;
		this.url = new URL(`/api/board/${boardName}/`, location.href);
		if (location.protocol == "https") {
			this.url.protocol = "wss";
		} else {
			this.url.protocol = "ws";
		}
		this.rawClient = new RawClient(this.url);

		this.rawClient.callMethod("Connect", {info})
			.then((val) => {
				let res;
				if ((res = getOk(val))) {
					this._clientID = res.clientId;
					this.sessionCode = res.sessionId;
				} else if ((res = getErr(val))) {
					logger.error("Failed to register with board");
				}
			});
	}
}