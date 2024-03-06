/// Due to bug in Firefox, some SVG objects get garbage collected when they shouldn't.
/// This is already problematic, but is made even worse by the fact that these objects
/// have a special garbage-collection mechanism that doesn't account for weak references,
/// allowing the JS wrapper to be accessed after its backing data is freed, causing a tab crash
///
/// This module monkey-patches some of the methods on SVGPointList to keep their contained points alive,
/// which is enough to make this application work

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