const PointKeepaliveMap = new WeakMap<SVGPointList, Map<number, SVGPoint>>();

console.log(PointKeepaliveMap);

function getKeepaliveMap(list: SVGPointList) {
	let map = PointKeepaliveMap.get(list);
	if (!map) {
		map = new Map();
		PointKeepaliveMap.set(list, map);
	}
	return map;
}

const oldReplaceItem = SVGPointList.prototype.replaceItem;
const oldAppendItem = SVGPointList.prototype.appendItem;

SVGPointList.prototype.replaceItem = function (newItem, index) {
	const map = getKeepaliveMap(this);
	map.set(index, newItem);
	return oldReplaceItem.call(this, newItem, index);
};

SVGPointList.prototype.appendItem = function (newItem) {
	const map = getKeepaliveMap(this);
	const index = this.length;
	map.set(index, newItem);
	return oldAppendItem.call(this, newItem);
};

export { };