import { ToolState, ToolType } from "../tool/Tool.js";
import { CanvasController } from "../canvas/Canvas.js";
import { ToolIcon, ToolIconCallback } from "./Icon.js";
import { PanelController } from "./Panel.js";
import { PropertyEditor } from "./PropertiesEditor.js";
import { MutableState, State, mutableStateOfNone } from "../util/State.js";
import { Logger } from "../Logger.js";
import { None, Option, todo } from "../util/Utils.js";
import { LocalSelectionCount } from "../BoardTable.js";
import { PropertyInstance } from "../Properties.js";
import { CanvasItem } from "../canvas/items/CanvasItems.js";

const logger = new Logger("ui/manager");

export class UIManager {
	public readonly containerElement: HTMLDivElement;
	public readonly viewPanel: PanelController;
	public readonly toolPanel: PanelController;
	public readonly propertiesPanel: PanelController;
	public readonly properties: PropertyEditor;

	private readonly _toolState = mutableStateOfNone<ToolState>();
	public readonly toolState = this._toolState.asReadonly();

	public constructor(
		canvas: CanvasController,
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
			.addClasses("icon-container", "panel-contents");

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


		const toolProps = this.toolState.derived<Option<PropertyInstance>>(t => {
			if (t === None) return None;
			const properties = t.tool.properties;
			if (!properties) return None;
			return {
				schema: properties.schema,
				store: properties,
			};
		});

		const propertiesState = toolProps.with(canvas.boardTable.selectionState)
			.derivedT((tool, selection) => {
				switch (selection.type) {
					case LocalSelectionCount.None: return tool;
					case LocalSelectionCount.One: return canvas.getPropertyInstance(selection.entry);
					case LocalSelectionCount.Multiple: return None;
				}
			});

		this.propertiesPanel = new PanelController(panelContainer);
		this.properties = new PropertyEditor(propEditorContainer, propertiesState);
	}

	public addToolIcon(icon: ToolIcon) {
		this.toolPanel.contents.appendChild(icon.element);
		icon.bind(this.toolState);
		icon.onselect = this.onIconSelect;
		icon.ondeselect = this.onItemDeselect;
	}

	private cancelTool() {
		const state = this.toolState.get();
		if (state === None) return;
		const { tool } = state;
		if (tool.type == ToolType.Action) {
			// @ts-ignore there should be narrowing here
			state.action?.cancel();
		} else {
			tool.unbind();
		}
		this._toolState.set(None);
	}

	private readonly onIconSelect: ToolIconCallback = tool => {
		logger.debug("Selected tool %o", tool);
		if (tool.type === ToolType.Action) {
			this.cancelTool();
			tool.bind(async (action) => {
				this._toolState.updateBy(
					s => {
						if (s !== None && s.tool === tool) return {
							tool: s.tool,
							action,
						}; else return s;
					},
				);
				await action.completion;
				this._toolState.set(None);
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
		if (toolState === None) return;
		if (toolState.tool === tool) this.cancelTool();
	};
}