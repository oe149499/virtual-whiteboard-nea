import { ClientInfo, ConnectionInfo, Result } from "../gen/Types";

const API_ROOT = new URL("/api/", window.location.href);
const MEDIA_ROOT = new URL("/media/", window.location.href);

const FILE_URL = new URL("upload", API_ROOT);


export const API = Object.freeze({
	openSession(boardName: string, info: ClientInfo): Promise<Result<ConnectionInfo>> {
		const url = new URL(`board/${boardName}`, API_ROOT);
		const response = fetch(url, {
			method: "POST",
			body: JSON.stringify(info),
			headers: {
				"Content-Type": "application/json",
			},
		});
		return response.then(
			response => response.json() as Promise<Result<ConnectionInfo>>,
		);
	},

	uploadFile(file: File) {
		const formData = new FormData();
		formData.set("file", file);
		return fetch(FILE_URL, {
			method: "POST",
			body: formData,
		}).then(response => response.text())
			.then(name => new URL(name, MEDIA_ROOT));
	},
});