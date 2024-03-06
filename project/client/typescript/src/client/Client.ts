import { IterateDispatcher, MethodDispatcher, NCArgs, NCName, createIterateReciever, createMethodReciever } from "../GenWrapper.js";
import { Logger } from "../Logger.js";
import { RawClient } from "./RawClient.js";
import { QUERY_PARAMS, unwrap } from "../util/Utils.js";
import { ClientInfo, type ConnectionInfo } from "../gen/Types.js";
import { API } from "./HttpApi.js";

const logger = new Logger("session-client");

const SESSION_STORAGE_KEY = "SESSION_INFO_";

interface SessionCache {
	startTime: number;
	info: ClientInfo;
	connnection: ConnectionInfo;
}

export class SessionClient {
	static async new(
		boardName: string,
		info: ClientInfo,
	): Promise<SessionClient> {
		const storageKey = SESSION_STORAGE_KEY + boardName + (QUERY_PARAMS.get("session") ?? "");
		const cache = sessionStorage.getItem(storageKey);

		if (cache) {
			const data = <SessionCache>JSON.parse(cache);
			if (data.startTime === await API.startTime) {
				return new SessionClient(
					boardName,
					data.connnection.sessionId,
					data.connnection.clientId,
					data.info,
				);
			}
		}

		const data = await API.openSession(boardName, info);

		logger.info("Recieved connection information:", data);

		const conn = data;

		const newCache: SessionCache = {
			startTime: await API.startTime,
			info,
			connnection: conn,
		};

		sessionStorage.setItem(storageKey, JSON.stringify(newCache));


		const client = new SessionClient(
			boardName,
			conn.sessionId,
			conn.clientId,
			info,
		);
		return client;
	}

	private rawClient: RawClient;
	private methodDispatcher?: MethodDispatcher;
	private iterateDispatcher?: IterateDispatcher;
	readonly socketUrl: URL;

	public get method(): MethodDispatcher {
		this.methodDispatcher ??= createMethodReciever(this.rawClient.callMethod.bind(this.rawClient));
		return this.methodDispatcher;
	}

	public get iterate(): IterateDispatcher {
		this.iterateDispatcher ??= createIterateReciever(
			(name, args) => this.rawClient.callIterate(name, args),
		);

		return this.iterateDispatcher;
	}

	public bindNotify<N extends NCName>(name: N, handler: (_: NCArgs<N>) => void) {
		this.rawClient.setNotifyHandler(name, handler);
	}

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