import { Logger } from "./Logger.js";
import { RawClient } from "./RawClient.js";
import { unwrap } from "./Utils.js";
import { ClientInfo, ConnectionInfo, Result } from "./gen/Types.js";

const logger = new Logger("session-client");

export class SessionClient {
	static async new(
		boardName: string,
		info: ClientInfo,
	): Promise<SessionClient> {
		const boardURL = new URL(`/api/board/${boardName}/`, window.location.href);
		const response = await fetch(boardURL.toString(), {
			method: "POST",
			body: JSON.stringify(info),
			headers: {
				"Content-Type": "application/json"
			}
		});

		const data = await response.json() as Result<ConnectionInfo>;

		logger.info("Recieved connection information:", data);

		const conn = unwrap(data);

		const client = new SessionClient(
			boardName,
			conn.sessionId,
			conn.clientId,
			info,
		);
		return client;
	}

	private rawClient: RawClient;
	readonly socketUrl: URL;

	private constructor(
		readonly boardName: string,
		private sessionCode: number,
		readonly clientID: number,
		readonly info: ClientInfo,
	) {	
		const location = window.location;
		this.socketUrl = new URL(`/api/session/${this.sessionCode}/`, location.href);
		if (location.protocol == "https") {
			this.socketUrl.protocol = "wss";
		} else {
			this.socketUrl.protocol = "ws";
		}
		this.rawClient = new RawClient(this.socketUrl);
	}
}