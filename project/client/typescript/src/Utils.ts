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