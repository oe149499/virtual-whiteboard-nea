type ExportList = {
	[prefix: string]: string[]
}

function dumpModule(path: string) {
	// @ts-expect-error Only used for testing
	import(path).then(module => {
		for (const prop of Object.getOwnPropertyNames(module)) {
			// @ts-expect-error this is just wrong
			window[prop] = module[prop];
		}
	});
}

export default function dumpList(list: ExportList) {
	for (const prefix in list) {
		for (const name of list[prefix]) {
			dumpModule(`/script/${prefix}${name}.js`);
		}
	}
}
