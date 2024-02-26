import type { Board } from "../Board.js";
import { PX_PER_CM } from "../canvas/CanvasBase.js";
import { ImageTool } from "../tool/ImageTool.js";
import { LineTool } from "../tool/LineTool.js";
import { PathTool } from "../tool/PathTool.js";
import { PolygonTool } from "../tool/PolygonTool.js";
import { SelectionTool } from "../tool/SelectionTool.js";
import { EllipseTool, RectangleTool } from "../tool/ShapeTools.js";
import { LinkTool, TextTool } from "../tool/TextTools.js";
import { Tool } from "../tool/Tool.js";
import { ViewTool } from "../tool/ViewTool.js";
import { ZoomInTool, ZoomTool } from "../tool/ZoomTools.js";

type ConstructorEntry = [iconName: string, tool: new (board: Board) => Tool];
type ToolEntry = [iconName: string, tool: Tool];
type ConstructorList = ConstructorEntry[];
export type ToolList = ToolEntry[];


const toolBuilder = (list: ConstructorList) =>
	(board: Board) =>
		list.map(([iconName, tool]): ToolEntry =>
			[iconName, new tool(board)]);


const EditConstructors: ConstructorList = [
	["up-down-left-right", ViewTool],
	["pen", PathTool],
	["image", ImageTool],
	["object-group", SelectionTool],
	["", LineTool],
	["draw-polygon", PolygonTool],
	["square", RectangleTool],
	["circle", EllipseTool],
	["font", TextTool],
	["link", LinkTool],
];

const ViewConstructors: ConstructorList = [
	["magnifying-glass-plus", ZoomTool(zoom => zoom * 1.2)],
	["magnifying-glass", ZoomTool(_ => PX_PER_CM)],
	["magnifying-glass-minus", ZoomTool(zoom => zoom / 1.2)],
];

export const createEditToolList = toolBuilder(EditConstructors);
export const createViewToolList = toolBuilder(ViewConstructors);