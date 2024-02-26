import { Logger } from "../Logger.js";
import { mutableStateOf, type State } from "../util/State.js";
import { SvgIcon, SimpleIcon } from "./Icon.js";
import "../util/ExtensionsImpl.js";
import type { Color } from "../gen/Types.js";
import { multiTargetProvider, type MultiTargetDispatcher } from "../util/Events.js";

const logger = new Logger("panel");

export enum EnabledState {
	Active,
	Inactive,
	Cancellable,
}

const StateColors: { readonly [S in EnabledState]: Color } = {
	[EnabledState.Active]: "#ffffff",
	[EnabledState.Inactive]: "#444444",
	[EnabledState.Cancellable]: "#ff0000",
};

function VIS_ICON(open: boolean): string {
	if (open) return "xmark";
	else return "bars";
}

export class PanelController {
	private visibility: VisibilityButton;
	public readonly contents: HTMLElement;

	public readonly openState: State<boolean>;
	public readonly events: MultiTargetDispatcher<PanelEvents>;

	private getContents(): HTMLElement {
		const contents = this
			.containerElement
			.getElementsByClassName("panel-contents");

		if (contents.length == 0)
			logger.throw("Failed to find a suitable `.panel-contents`");
		const contentsElem = contents[0];

		if (contentsElem instanceof HTMLElement) {
			return contentsElem;
		} else {
			return logger.throw(
				"Panel contents found not an instance of HTMLELement: %o",
				contentsElem,
			);
		}
	}

	public constructor(
		private containerElement: HTMLElement,
		enabledState: State<EnabledState>,
	) {
		this.visibility = new VisibilityButton(enabledState);
		this.containerElement.prepend(
			this.visibility.element,
		);

		this.openState = this.visibility.openState;
		this.events = this.visibility.events.dispatcher;

		this.contents = this.getContents();

		const panelVisible = enabledState.derived(s => s === EnabledState.Active)
			.with(this.openState)
			.derivedT((enabled, open) => enabled && open);

		this.contents.classList.selectBy("open", "closed", panelVisible);
	}
}

type PanelEvents = {
	cancel(): void,
}

class VisibilityButton {
	private container: HTMLDivElement;
	private icon: SimpleIcon;

	public readonly openState = mutableStateOf(true);
	public get element(): HTMLElement {
		return this.container;
	}

	public readonly events = multiTargetProvider<PanelEvents>();

	public constructor(
		enabledState: State<EnabledState>,
	) {
		this.container = document.createElement("div");
		this.container.setAttribute("class", "ui-icon");

		enabledState.watchOn(this, s => {
			this.container.style.backgroundColor = StateColors[s];
		});

		const iconState = enabledState.with(this.openState)
			.derivedT((enabled, open) => {
				if (enabled == EnabledState.Cancellable) return true;
				else return open;
			})
			.derived(VIS_ICON);

		this.icon = new SimpleIcon(iconState);
		this.container.appendChild(this.icon.element);

		// this.icon.svgElement.then(el => {
		// 	Object.setPrototypeOf(el.classList, DOMTokenList.prototype);
		// 	el.classList.selectBy("open", "closed", iconState);
		// });

		this.container.onclick = () => {
			switch (enabledState.get()) {
				case EnabledState.Active: {
					this.openState.updateBy(current => !current);
				} break;
				case EnabledState.Cancellable: {
					this.events.emit("cancel");
				} break;
			}
		};
	}
}