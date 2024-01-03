import { Logger } from "../Logger.js";
import { SvgIcon } from "./Icon.js";

const logger = new Logger("panel");

export class PanelController {
	private visibility: VisibilityButton;
	public readonly contents: HTMLElement;

	public get open() { return this.visibility.open; }

	private getContents(): HTMLElement {
		const contents = this
			.containerElement
			.getElementsByClassName("panel-contents");

		if (contents.length == 0)
			logger.throw("Failed to find a suitable `.panel`");
		const contentsElem = contents[0];

		if (contentsElem instanceof HTMLElement) {
			return contentsElem;
		} else {
			return logger.throw(
				"Panel contents found not an instance of HTMLELement: %o",
				contentsElem
			);
		}
	}

	public constructor(
		private containerElement: HTMLElement,
	) {
		this.visibility = new VisibilityButton("panel-icon");
		this.containerElement.prepend(
			this.visibility.element
		);

		this.visibility.onopen = () => {
			this.contents.classList.swap("closed", "open");
		};

		this.visibility.onclose = () => {
			this.contents.classList.swap("open", "closed");
		};

		this.contents = this.getContents();
	}

}

class VisibilityButton {
	private container: HTMLDivElement;
	private icon: SvgIcon;

	private _open = true;
	public get open() { return this._open; }
	private set open(value) { this._open = value; }

	public get element(): HTMLElement {
		return this.container;
	}

	public onopen?: () => void;
	public onclose?: () => void;

	public constructor(iconName: string) {
		this.container = document.createElement("div");
		this.container.setAttribute("class", "ui-icon");

		this.icon = new SvgIcon(iconName);
		this.container.appendChild(this.icon.objectElement);

		this.container.onclick = async () => {
			const classes = (await this.icon.svgElement).classList;
			if (this.open) {
				classes.remove("open");
				this.open = false;
				classes.add("closed");
				this.onclose?.();
			} else {
				classes.remove("closed");
				this.open = true;
				classes.add("open");
				this.onopen?.();
			}
		};
	}
}