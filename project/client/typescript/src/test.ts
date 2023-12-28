/* eslint-disable @typescript-eslint/ban-types */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { CanvasController } from "./canvas/Canvas.js";
import { SessionClient } from "./client/Client.js";
import type { Item, Point, PolygonItem, RectangleItem } from "./gen/Types.js";
/* eslint-disable @typescript-eslint/no-unused-vars */
// Test file

function point(x: number, y: number): Point {
	return { x: x, y: y };
}

export const basic_item: Item = {
	"type": "Line",
	"start": point(0, 0),
	"end": point(3, 0.5),
	"stroke": {
		width: 10,
		color: "red",
	}
};

export async function createBoundTestBoard(): { canvas: CanvasController, client: SessionClient } {
	const client = await SessionClient.new("test", { name: "test" });
	const canvas = new CanvasController();
	canvas.svgElem.setAttribute("width", "10cm");
	canvas.svgElem.setAttribute("height", "10cm");
	document.querySelector("#test-container")?.appendChild(canvas.svgElem);
	client.bindNotify("ItemCreated", ({ id, item }) => {
		canvas.addItem(id, item);
	});
	return { client, canvas };
}

export const rect: RectangleItem = {
	type: "Rectangle",
	transform: {
		origin: { x: 10, y: 10 },
		rotation: 0,
		stretchX: 1,
		stretchY: 1,
	},
	stroke: {
		color: "red",
		width: 1
	},
	fill: "blue"
};

export const triangle: PolygonItem = {
	type: "Polygon",
	points: [
		point(1, 1),
		point(2, 1),
		point(2, 3),
	],
	stroke: {
		color: "blue",
		width: 0.5,
	},
	fill: "green",
};

const message: string = "Hello World!";
const item = JSON.stringify(basic_item);
console.log(message, item);

window.SessionClient = SessionClient;