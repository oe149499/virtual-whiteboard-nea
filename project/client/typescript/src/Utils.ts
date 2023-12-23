import { Result } from "./gen/Types";

export function getOk<T, TErr>(res: Result<T, TErr>): T | false {
	if ("Ok" in res) {
		return res.Ok;
	} else {
		return false;
	}
}

export function getErr<T, TErr>(res: Result<T, TErr>): TErr | false {
	if ("Err" in res) {
		return res.Err;
	} else {
		return false;
	}
}

export function unwrap<T, TErr>(res: Result<T, TErr>, f?: (_: TErr) => T | never): T {
	if ("Ok" in res) {
		return res.Ok;
	} else {
		if (f != undefined) {
			return f(res.Err);
		} else {
			throw new Error(`unwrap() called on an error value: ${res.Err}`);
		}
	}
}

export function todo() {
	throw new Error("Not yet implemented");
}