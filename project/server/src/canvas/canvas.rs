pub mod item;

use serde::{Serialize, Deserialize};
use ts_rs::TS;

pub use item::Item;

#[derive(Serialize, Deserialize, TS)]
pub struct Point {
	x: f64,
	y: f64,
}

#[derive(Serialize, Deserialize, TS)]
pub struct Color(String);


#[derive(Serialize, Deserialize, TS)]
pub struct Stroke {
	width: f64,
	color: Color,
}


#[derive(Serialize, Deserialize, TS)]
pub struct Angle(f64);


#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Transform {
	origin: Point,
	rotation: Angle,
	stretch_x: f64,
	stretch_y: f64,
}


#[derive(Serialize, Deserialize, TS)]
#[non_exhaustive]
pub struct Spline {
	points: Vec<Point>,
}