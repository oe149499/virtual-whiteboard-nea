import { Board } from "./Board.js";
import { SpecificItem } from "./GenWrapper.js";
import { Property, buildProperties } from "./Properties.js";
import type { Item, Point, RectangleItem } from "./gen/Types.js";
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

export const rect: SpecificItem<"Rectangle"> = {
	type: "Rectangle",
	transform: {
		origin: { x: 10, y: 10 },
		basisX: point(1, 0),
		basisY: point(0, 1),
	},
	stroke: {
		color: "red",
		width: 1
	},
	fill: "blue"
};

export const triangle: SpecificItem<"Polygon"> = {
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

export async function createTestUI() {
	console.log("Creating board");

	const board = await Board.new("test", { name: "Oscar" });

	console.log("Board created");

	document.body.appendChild(board.ui.containerElement);

	return board;
}

const acc = {
	get<T>() { return null as T; },
	set<T>(val: T) { return val; }
};

type Test = { [K in keyof RectangleItem]: 1 };

/*const prop = buildProperties(rect as RectangleItem, ($) => {
	$.struct("stroke", ($) => {
		$.number("width");
		$.color("color", $.get(rect.stroke, "color"));
	});
	$.struct("transform", ($) => {
		$.struct("origin", ($) => {
			$.number("x");
			$.number("y");
		});
		$.number("rotation");
		$.number("stretchX");
		$.number("stretchY");
	});
	$.color("fill");
});
console.log(prop);*/