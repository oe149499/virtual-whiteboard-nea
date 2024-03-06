import { ClientInfo, ConnectionInfo, Result } from "../gen/Types";

function API_URL(name: string, ...parts: (string | number)[]) {
	return `/api/${name}/${parts.join("/")}`;
}

const MEDIA_URL = (path: string) => `/media/${path}`;

const UPLOAD_URL = API_URL("upload");
const START_TIME_URL = API_URL("start_time");


export const API = Object.freeze({
	openSession(boardName: string, info: ClientInfo): Promise<ConnectionInfo> {
		const url = API_URL("board", boardName);
		const response = fetch(url, {
			method: "POST",
			body: JSON.stringify(info),
			headers: {
				"Content-Type": "application/json",
			},
		});
		return response.then(
			response => response.json(),
		);
	},

	uploadFile(file: File) {
		const formData = new FormData();
		formData.set("file", file);
		return fetch(UPLOAD_URL, {
			method: "POST",
			body: formData,
		}).then(response => response.text())
			.then(name => MEDIA_URL(name));
	},

	startTime: fetch(START_TIME_URL)
		.then(response => response.text())
		.then(Number),
});