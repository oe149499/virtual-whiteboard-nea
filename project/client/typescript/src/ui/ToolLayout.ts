import type { Board } from "../Board.js";
import { ImageTool } from "../tool/ImageTool.js";
import { PathTool } from "../tool/PathTool.js";
import { SelectionTool } from "../tool/SelectionTool.js";
import { Tool } from "../tool/Tool.js";
import { ViewTool } from "../tool/ViewTool.js";

export type ToolList = [iconName: string, tool: Tool][];

export function createEditToolList(board: Board): ToolList {
	return [
		["tool/view", new ViewTool(board)],
		["tool/pen", new PathTool(board)],
		["tool/image", new ImageTool(board)],
		["", new SelectionTool(board)],
	];
}