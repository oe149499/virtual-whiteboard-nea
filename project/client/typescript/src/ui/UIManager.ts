import { ToolState, ToolType } from "../tool/Tool.js";
import { CanvasController } from "../canvas/Canvas.js";
import { ToolIcon, ToolIconCallback } from "./Icon.js";
import { PanelController } from "./Panel.js";
import { PropertyEditor } from "./PropertiesEditor.js";
import { MutableState, State, mutableStateOf } from "../util/State.js";
import { Logger } from "../Logger.js";

const logger = new Logger("ui/manager");

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;
	public readonly toolPanel: PanelController;
	public readonly propertiesPanel: PanelController;
	public readonly properties: PropertyEditor;

	public readonly toolState: State<ToolState>;
	private readonly _toolState: MutableState<ToolState>;

	public constructor(
		private readonly canvas: CanvasController,
	) {
		this.containerElement = document
			.createElement("div")
			.addClasses("ui");
		this.containerElement.style.height = "100%";

		this.containerElement.appendChild(canvas.svgElement);
		canvas.svgElement.setAttrs({
			width: "100%",
			height: "100%",
		});

		let panelContainer = this.containerElement
			.createChild("div")
			.addClasses("bottom-container");

		panelContainer
			.createChild("div")
			.addClasses("icon-container", "panel-contents")
			.createChild("div")
			.addClasses("debug-block");

		this.viewPanel = new PanelController(panelContainer);

		panelContainer = this.containerElement
			.createChild("div")
			.addClasses("right-container");

		panelContainer
			.createChild("div")
			.addClasses("icon-container", "panel-contents");

		this.toolPanel = new PanelController(panelContainer);

		panelContainer = this.containerElement
			.createChild("div")
			.addClasses("left-container");

		const propEditorContainer = panelContainer
			.createChild("div")
			.addClasses("panel-contents");


		this._toolState = mutableStateOf(null as ToolState);
		this.toolState = this._toolState;

		this.propertiesPanel = new PanelController(panelContainer);
		this.properties = new PropertyEditor(propEditorContainer, this.toolState);
	}

	public addToolIcon(icon: ToolIcon) {
		this.toolPanel.contents.appendChild(icon.element);
		icon.bind(this.toolState);
		icon.onselect = this.onIconSelect;
		icon.ondeselect = this.onItemDeselect;
	}

	private cancelTool() {
		const state = this.toolState.get();
		if (state === null) return;
		const { tool } = state;
		if (tool.type == ToolType.Action) {
			// @ts-ignore there should be narrowing here
			state.action?.cancel();
		} else {
			tool.unbind();
		}
		this._toolState.set(null);
	}

	private readonly onIconSelect: ToolIconCallback = tool => {
		logger.debug("Selected tool %o", tool);
		if (tool.type == ToolType.Action) {
			this.cancelTool();
			tool.bind(async (action) => {
				this._toolState.updateBy(s =>
					s?.tool === tool ? {
						tool: s.tool,
						action
					} : s
				);
				await action.completion;
				this._toolState.set(null);
			});
			this._toolState.set({ tool });
		} else if (tool.type == ToolType.Mode) {
			this.cancelTool();
			tool.bind();
			this._toolState.set({ tool });
		} else {
			tool.execute();
		}
	};

	private readonly onItemDeselect: ToolIconCallback = tool => {
		const toolState = this.toolState.get();
		if (toolState?.tool === tool) this.cancelTool();
	};
}