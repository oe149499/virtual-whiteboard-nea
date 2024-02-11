import { IterateNames, IterateSpec } from "./gen/Iterate.js";
import { MethodNames, MethodSpec } from "./gen/Methods.js";
import { NotifyCSpec } from "./gen/NotifyC.js";
import type { Color, Item, Stroke, Transform } from "./gen/Types.js";
import { AsyncIter } from "./util/AsyncIter.js";

export type Id<T> = { [K in keyof T]: T[K] };

export type ItemType = Item["type"];
export type SpecificItem<T extends ItemType> = Extract<Item, { type: T }>;

export interface HasTransform { transform: Transform }
export interface HasStroke { stroke: Stroke }
export interface HasFill { fill: Color }

export type MName = keyof MethodSpec;

export type MArgs<M extends MName = MName> = MethodSpec[M][0];
export type MRet<M extends MName = MName> = MethodSpec[M][1];
type MCall<M extends MName = MName> = (args: MArgs<M>) => Promise<MRet<M>>;

export type MPayload<M extends MName = MName> = {
	protocol: "Method",
	id: number,
	name: M,
} & MArgs<M>;

export type MResponse<M extends MName = MName> = {
	protocol: "Response",
	id: number,
	value: MRet<M>,
}

export function createMethodPayload<M extends MName>(
	name: M,
	id: number,
	args: MArgs<M>,
): MPayload<M> {
	return {
		protocol: "Method",
		id: id,
		name: name,
		...args,
	};
}

export type MethodDispatcher = {
	[M in MName]: MCall<M>;
}

export type MethodHandler = <M extends MName>(name: M, args: MArgs<M>) => Promise<MRet<M>>;

export function createMethodReciever(handler: MethodHandler): MethodDispatcher {
	// This should work but fails type checking
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = {} as any;
	for (const name of MethodNames) {
		result[name] = function (args: MArgs<typeof name>) {
			return handler(name, args);
		};
	}
	return result as MethodDispatcher;
}

export type NCName = keyof NotifyCSpec;

export type NCArgs<N extends NCName = NCName> = NotifyCSpec[N];

export type NCPayload<N extends NCName> = {
	protocol: "Notify-C",
	name: N,
} & NCArgs<N>;

export type IName = keyof IterateSpec;

export type IArgs<I extends IName> = IterateSpec[I][0];

export type IItem<I extends IName> = IterateSpec[I][1];

export type IPayload<I extends IName> = {
	protocol: "Iterate",
	name: I,
	id: number,
} & IArgs<I>;

export type IResponse<I extends IName> = {
	protocol: "Response-Part",
	id: number,
	part: number,
	complete: boolean,
	items: IItem<I>[],
};

export function createIteratePayload<I extends IName>(name: I, id: number, args: IArgs<I>): IPayload<I> {
	return {
		protocol: "Iterate",
		name,
		id,
		...args,
	};
}

export type IterateDispatcher = {
	[I in IName]: (args: IArgs<I>) => AsyncIter<IItem<I>[]>
}

export type IterateHandler = <I extends IName>(name: I, args: IArgs<I>) => AsyncIter<IItem<I>[]>;

export function createIterateReciever(handler: IterateHandler): IterateDispatcher {
	// This should work but fails type checking
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = {} as any;
	for (const name of IterateNames) {
		result[name] = function (args: IArgs<typeof name>) {
			return handler(name, args);
		};
	}
	return result;
}

//type Test = Id<IItem<"GetActivePath">>;

export type MethodCall = MPayload<MName>;

export type MethodResponse = MResponse<MName>;

export type NotifyC = NCPayload<NCName>;

export type IterateCall = IPayload<IName>;

export type IterateResponse = IResponse<IName>;

export type MsgSend = MethodCall | IterateCall;

export type MsgRecv = MethodResponse | NotifyC | IterateResponse;