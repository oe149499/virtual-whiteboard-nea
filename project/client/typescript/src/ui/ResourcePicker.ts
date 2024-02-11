import { Logger } from "../Logger.js";
import { API } from "../client/HttpApi.js";
import { State, mutableStateOfNone } from "../util/State.js";
import { None, Option, getObjectID } from "../util/Utils.js";
const logger = new Logger("ui/ResourcePicker");

export class ResourcePicker {
	private input: HTMLInputElement;

	constructor(
		target: HTMLElement,
		private callback: (_: Option<URL>) => void,
	) {
		const urlInput = buildUrlDisplay(target);
		this.input = urlInput;

		urlInput.onchange = () => {
			if (urlInput.value) this.callback(new URL(urlInput.value));
			else this.callback(None);
		};

		const fileState = buildFileArea(target);

		buildUploadArea(target, fileState, (url) => {
			urlInput.value = url.toString();
			this.callback(url);
		});
	}

	public load(value: Option<URL>) {
		if (value === None) this.input.value = "";
		else this.input.value = value.toString();
	}
}

function buildUrlDisplay(target: HTMLElement): HTMLInputElement {
	const id = getObjectID();
	target.createChild("label")
		.setAttrs({ htmlFor: id })
		.addClasses("property-label-wide")
		.setContent("URL: ");

	const input = target.createChild("input")
		.addClasses("property-input-url")
		.setAttrs({
			id,
			type: "url",
		});
	return input;
}

function buildFileArea(target: HTMLElement): State<Option<File>> {
	const state = mutableStateOfNone<File>();
	const input = target.createChild("input")
		.setAttrs({ type: "file" })
		.addClasses("property-input-file");

	input.onchange = () => {
		if (!input.files) return;
		if (input.files.length === 0) {
			state.set(None);
		} else {
			state.set(input.files[0]);
		}
		logger.debug("File selected", input.files);
	};
	return state;
}

function buildUploadArea(target: HTMLElement, fileState: State<Option<File>>, cb: (url: URL) => void) {
	const btn = target.createChild("button")
		.addClasses("property-file-upload-button")
		.setContent("Upload");

	btn.classList.setBy(
		"file-present",
		fileState.derived(o => o !== None),
	);

	btn.onclick = async () => {
		const file = fileState.get();
		if (file === None) return;
		logger.info("Uploading file");
		const url = await API.uploadFile(file);
		cb(url);
		logger.info("Uploaded file", url);
	};
}