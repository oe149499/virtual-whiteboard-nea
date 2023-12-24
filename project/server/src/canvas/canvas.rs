//! Collection of types relating to board objects

pub mod active;
pub mod item;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use active::ActiveCanvas;
pub use item::Item;

/// A global location on the board plane
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
pub struct Point {
    x: f64,
    y: f64,
}

/// A CSS-compatible color
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
pub struct Color(String);

/// A descriptor for how to render a line
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
pub struct Stroke {
    /// The thickness of the line, from one side to the other
    pub width: f64,
    /// The color of the line
    pub color: Color,
}

/// An angle, measured in degrees clockwise
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
pub struct Angle(f64);

/// A mapping used to position objects on the board
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Transform {
    /// The global coordinate which the object is centered on and which all other transformations are relative to
    pub origin: Point,
    /// The angle of the object, applied after scaling
    pub rotation: Angle,
    /// The horizontal scale of the object, applied before rotation
    pub stretch_x: f64,
    /// The vertical scale of the object, applied before rotation
    pub stretch_y: f64,
}

/// ### May change at a later date
/// A curved path, currently represented as a series of [`Point`]s
#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[non_exhaustive]
pub struct Spline {
    /// The points the path travels through
    pub points: Vec<Point>,
}
