import { ToolState, ToolType } from "../tool/Tool.js";
import { CanvasController } from "../canvas/Canvas.js";
import { ToolIcon, ToolIconCallback } from "./Icon.js";
import { EnabledState, PanelController } from "./Panel.js";
import { PropertyEditor } from "./PropertiesEditor.js";
import { MutableState, State, deadStateOf, mutableStateOfNone } from "../util/State.js";
import { Logger } from "../Logger.js";
import { None, Option, todo } from "../util/Utils.js";
import { LocalSelectionCount, type BoardTable } from "../BoardTable.js";
import { PropertyInstance } from "../Properties.js";
import { CanvasItem } from "../canvas/items/CanvasItems.js";

const logger = new Logger("ui/manager");

const iconTypeMap = {
	"edit": "toolPanel",
	"view": "viewPanel",
} as const;

export class UIManager {
	public readonly containerElement = document
		.createElement("div")
		.addClasses("ui");

	public readonly viewPanel: PanelController;
	public readonly toolPanel: PanelController;
	public readonly propertiesPanel: PanelController;
	public readonly properties: PropertyEditor;

	private readonly _toolState = mutableStateOfNone<ToolState>();
	public readonly toolState = this._toolState.asReadonly();

	public constructor(
		canvas: CanvasController,
		table: BoardTable,
	) {
		this.containerElement.style.height = "100%";

		this.containerElement.appendChild(canvas.svgElement);
		canvas.svgElement.setAttrs({
			width: "100%",
			height: "100%",
		});

		this.viewPanel = this.createPanel("bottom-container", deadStateOf(EnabledState.Active), "icon-container");

		const toolPanelActive = table
			.selectedItems
			.size.with(this.toolState)
			.derivedT((items, tool) => {
				if (items > 0) return EnabledState.Cancellable;
				if (tool === None) return EnabledState.Active;
				if ("action" in tool && tool.action) return EnabledState.Cancellable;
				return EnabledState.Active;
			});

		this.toolPanel = this.createPanel("right-container", toolPanelActive, "icon-container");

		this.toolPanel.events.connect("cancel", () => {
			const tool = this.toolState.get();
			if (tool !== None) this.cancelTool();
			else table.cancelSelection();
		});

		const toolProps = this.toolState.derived<Option<PropertyInstance>>(t => {
			if (t === None) return None;
			const properties = t.tool.properties;
			if (!properties) return None;
			return {
				schema: properties.schema,
				store: properties,
			};
		});

		const propertiesState = toolProps.with(table.selectedItems)
			.derivedT((tool, selection) => {
				if (selection.size === 0) return tool;
				else return canvas.getPropertyInstance(selection);
			});

		const propertiesEnabled = propertiesState.derived(s => s == None ? EnabledState.Inactive : EnabledState.Active);

		this.propertiesPanel = this.createPanel("left-container", propertiesEnabled);
		this.properties = new PropertyEditor(this.propertiesPanel.contents, propertiesState);
	}

	public addToolIcon(icon: ToolIcon, panel: "edit" | "view") {
		const container = this[iconTypeMap[panel]].contents;
		container.appendChild(icon.element);
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

	private createPanel(containerClass: string, enabledState: State<EnabledState>, ...contentClases: string[]) {
		const panelContainer = this.containerElement
			.createChild("div")
			.addClasses(containerClass);

		panelContainer
			.createChild("div")
			.addClasses("panel-contents", ...contentClases);

		return new PanelController(panelContainer, enabledState);
	}
}