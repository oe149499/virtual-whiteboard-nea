use super::{Transform, Stroke, Color, Point, Spline};

use serde::{Serialize, Deserialize};
use ts_rs::TS;


#[derive(Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[non_exhaustive]
pub enum Item {
	Rectangle(RectangleItem),
	Ellipse(EllipseItem),
	Line(LineItem),
	Polygon(PolygonItem),
	Path(PathItem),
	Image(ImageItem),
	Text(TextItem),
	Link(LinkItem),
}

#[derive(Serialize, Deserialize, TS)]
pub struct RectangleItem {
	transform: Transform,
	stroke: Stroke,
	fill: Color,
}

#[derive(Serialize, Deserialize, TS)]
pub struct EllipseItem {
	transform: Transform,
	stroke: Stroke,
	fill: Color,
}

#[derive(Serialize, Deserialize, TS)]
pub struct LineItem {
	start: Point,
	end: Point,
	stroke: Stroke,
}


#[derive(Serialize, Deserialize, TS)]
pub struct PolygonItem {
	points: Vec<Point>,
	stroke: Stroke,
	fill: Color,
}


#[derive(Serialize, Deserialize, TS)]
pub struct PathItem {
	transform: Transform,
	path: Spline,
	stroke: Stroke,
}

#[derive(Serialize, Deserialize, TS)]
pub struct ImageItem {
	transform: Transform,
	url: String,
	description: String,
}

#[derive(Serialize, Deserialize, TS)]
pub struct TextItem {
	transform: Transform,
	text: String,
}

#[derive(Serialize, Deserialize, TS)]
pub struct LinkItem {
	transform: Transform,
	url: String,
	text: String,
}