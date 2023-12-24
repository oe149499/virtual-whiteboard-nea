/* eslint-disable @typescript-eslint/ban-types */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SessionClient } from "./client/Client.js";
import type { Item, Point } from "./gen/Types.js";
/* eslint-disable @typescript-eslint/no-unused-vars */
// Test file

function point(x: number, y: number): Point {
	return { x: x, y: y };
}

const basic_item: Item = {
	"type": "Line",
	"start": point(0, 0),
	"end": point(0, 0),
	"stroke": {
		width: 10,
		color: "red",
	}
};

const message: string = "Hello World!";
const item = JSON.stringify(basic_item);
console.log(message, item);

window.SessionClient = SessionClient;