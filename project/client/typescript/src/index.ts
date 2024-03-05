import { Board } from "./Board.js";
import { QUERY_PARAMS } from "./util/Utils.js";

Board.new(QUERY_PARAMS.get("board") || "default", {
	name: QUERY_PARAMS.get("name") || "",
}).then(board => {
	window["board"] = board;
	document.body.appendChild(board.ui.containerElement);
});