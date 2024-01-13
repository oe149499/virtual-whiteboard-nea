import { Action, Tool, ToolType } from "../tool/Tool.js";
import { CanvasController } from "../canvas/Canvas.js";
import { ToolIcon } from "./Icon.js";
import { PanelController } from "./Panel.js";
import { PropertyEditor } from "./PropertiesEditor.js";

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;
	public readonly toolPanel: PanelController;
	public readonly propertiesPanel: PanelController;
	public readonly properties: PropertyEditor;

	public lastTool?: Tool;
	public lastIcon?: ToolIcon;
	public currentAction?: Action;

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

		this.propertiesPanel = new PanelController(panelContainer);
		this.properties = new PropertyEditor(propEditorContainer);
	}

	public addToolIcon(icon: ToolIcon) {
		this.toolPanel.contents.appendChild(icon.element);
		icon.onselect = this.onIconSelect;
		icon.ondeselect = this.onItemDeselect;
	}

	private readonly onIconSelect: ToolIcon["onselect"] = ({ tool, icon }) => {
		if (tool.type != ToolType.Instantaneous) {
			switch (this.lastTool?.type) {
				case null: break;
				case ToolType.Action: {
					if (this.currentAction) {
						this.currentAction.cancel();
					}
				} break;
				case ToolType.Mode: {
					this.lastTool.unbind();
				} break;
			}
			this.lastIcon?.deactivate();
		}
		switch (tool.type) {
			case ToolType.Action: {
				tool.bind(async (action) => {
					this.currentAction = action;
					await action.completion;
					icon.deactivate();
				});
				this.properties.loadProperties(tool.properties);
				this.lastTool = tool;
				this.lastIcon = icon;
			} break;
			case ToolType.Mode: {
				tool.bind();
				this.properties.loadProperties(tool.properties);
				this.lastTool = tool;
				this.lastIcon = icon;
			} break;
			case ToolType.Instantaneous: {
				tool.execute();
				return false;
			}
		}
		return true;
	};

	private readonly onItemDeselect: ToolIcon["ondeselect"] = ({ tool, icon }) => {
		switch (tool.type) {
			case ToolType.Action: {
				this.currentAction?.cancel();
			} break;
			case ToolType.Mode: {
				tool.unbind();
			} break;
		}
		return true;
	};
}