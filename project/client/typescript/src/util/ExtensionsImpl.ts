import { Point, Result } from "../gen/Types";

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
		}
	},
	right: {
		get() {
			return this.x + this.width;
		}
	},
	bottom: {
		get() {
			return this.y + this.height;
		}
	},
});

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