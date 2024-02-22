import type { Board } from "../Board.js";
import { ImageTool } from "../tool/ImageTool.js";
import { LineTool } from "../tool/LineTool.js";
import { PathTool } from "../tool/PathTool.js";
import { PolygonTool } from "../tool/PolygonTool.js";
import { SelectionTool } from "../tool/SelectionTool.js";
import { Tool } from "../tool/Tool.js";
import { ViewTool } from "../tool/ViewTool.js";

export type ToolList = [iconName: string, tool: Tool][];

export function createEditToolList(board: Board): ToolList {
	return [
		["up-down-left-right", new ViewTool(board)],
		["pen", new PathTool(board)],
		["image", new ImageTool(board)],
		["object-group", new SelectionTool(board)],
		["", new LineTool(board)],
		["draw-polygon", new PolygonTool(board)],
	];
}