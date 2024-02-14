import { Point, Result } from "../gen/Types.js";
import { MutableState, mutableStateOf } from "./State.js";

Set.prototype.addFrom = function <T>(this: Set<T>, src: Iterable<T>) {
	for (const item of src) this.add(item);
};

Map.prototype.assume = function <K, V>(this: Map<K, V>, key: K) {
	const val = this.get(key);
	if (val === undefined) throw new Error("Incorrectly assumed a key to be in a map");
	return val;
};

const timeoutVal = Symbol();

async function maxTimeout<T>(this: Promise<T>, time: number): Promise<Result<T, number>> {
	const timeout = new Promise<typeof timeoutVal>(r => setTimeout(r.bind(undefined, timeoutVal), time));
	const val = await Promise.race([this, timeout]);
	if (val === timeoutVal) return {
		status: "Err",
		value: time,
	};
	else return {
		status: "Ok",
		value: val,
	};
}

Promise.prototype.maxTimeout = maxTimeout;

Element.prototype.addClasses = function (...classes) {
	for (const c of classes) {
		this.classList.add(c);
	}
	return this;
};

HTMLElement.prototype.createChild = function (tagname) {
	const elem = document.createElement(tagname);
	return this.appendChild(elem);
};

SVGElement.prototype.createChild = function (tagname) {
	const elem = document.createElementNS("http://www.w3.org/2000/svg", tagname);
	return this.appendChild(elem);
};

Element.prototype.setAttrs = function (attrs) {
	for (const name in attrs) {
		const attrName = name.startsWith("html") ? name.slice(4) : name;
		// @ts-expect-error I'M LITERALLY ITERATING OVER THE KEYS OF THE OBJECT
		this.setAttribute(attrName, attrs[name]);
	}
	return this;
};

Element.prototype.setContent = function (content) {
	this.textContent = content;
	return this;
};

DOMTokenList.prototype.set = function (name, value) {
	if (value) this.add(name);
	else this.remove(name);
};

const keepaliveMap = new WeakMap();

DOMTokenList.prototype.setBy = function (name, source) {
	const handle = source.watch(value => this.set(name, value));
	keepaliveMap.set(this, handle);
};

const testIntersection = function (this: DOMRectReadOnly, { x, y }: Point) {
	return x >= this.left && y >= this.top && x <= this.right && y <= this.bottom;
};

DOMRectReadOnly.prototype.testIntersection = testIntersection;
SVGRect.prototype.testIntersection = testIntersection;

Object.defineProperties(SVGRect.prototype, {
	left: {
		get() {
			return this.x;
		},
	},
	top: {
		get() {
			return this.y;
		},
	},
	right: {
		get() {
			return this.x + this.width;
		},
	},
	bottom: {
		get() {
			return this.y + this.height;
		},
	},
});

const simpleNames = ["multiply", "rotate", "rotateAxisAngle", "rotateFromVector", "scale3d", "scale", "skewX", "skewY", "translate"] as const;

const matrixMethods = [["inverse", "invertSelf"], ...simpleNames.map(n => [n, n + "Self"])];



for (const [name, selfName] of matrixMethods) {
	// @ts-expect-error
	SVGMatrix.prototype[selfName] = function (...args) {
		// @ts-expect-error
		const newVal = this[name](...args);
		this.a = newVal.a;
		this.b = newVal.b;
		this.c = newVal.c;
		this.d = newVal.d;
		this.e = newVal.e;
		this.f = newVal.f;
		return this;
	};
}

SVGMatrix.prototype.preMultiplySelf = function (other) {
	if (other instanceof SVGMatrix || other instanceof DOMMatrix) {
		const newVal = other.multiply(this);
		this.a = newVal.a;
		this.b = newVal.b;
		this.c = newVal.c;
		this.d = newVal.d;
		this.e = newVal.e;
		this.f = newVal.f;
		return this;
	}

	throw new Error("preMultiplySelf not implemented for DOMMatrixInit values");
};

SVGGraphicsElement.prototype.getFinalTransform = function (current?) {
	current ??= new DOMMatrix([1, 0, 0, 1, 0, 0]);
	for (let i = this.transform.baseVal.length - 1; i >= 0; i--) {
		current.preMultiplySelf(this.transform.baseVal[i].matrix);
	}
	if (this.parentElement instanceof SVGGraphicsElement) {
		return this.parentElement.getFinalTransform(current);
	} else {
		return current;
	}
};

const bboxStateTable = new WeakMap<SVGGraphicsElement, WeakRef<MutableState<DOMRect>>>();

const bboxStateObserver = new ResizeObserver((entries, observer) => {
	for (const entry of entries) {
		const el = entry.target;
		if (bboxStateTable.has(el)) {
			const bbox = el.getBBox();
			const ref = bboxStateTable.get(el)!;
			const state = ref.deref();
			if (state) state.set(bbox);
			else {
				bboxStateTable.delete(el);
				observer.unobserve(el);
			}
		}
	}
});

SVGGraphicsElement.prototype.getBBoxState = function () {
	const state = mutableStateOf(this.getBBox());
	bboxStateTable.set(this, new WeakRef(state));
	bboxStateObserver.observe(this);
	return state;
};