//! Collection of types relating to board objects

pub mod active;
pub mod item;

use serde::{Deserialize, Serialize};
#[cfg(codegen)]
use ts_rs::TS;

pub use active::ActiveCanvas;
pub use item::Item;

/// A global location on the board plane
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
pub struct Point {
    x: f64,
    y: f64,
}

/// A CSS-compatible color
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
pub struct Color(String);

/// A descriptor for how to render a line
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
pub struct Stroke {
    /// The thickness of the line, from one side to the other
    pub width: f64,
    /// The color of the line
    pub color: Color,
}

/// An angle, measured in degrees clockwise
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
pub struct Angle(f64);

/// A mapping used to position objects on the board
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
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

/// A point along a [`Spline`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
pub struct SplineNode {
    /// The position of the node
    pub position: Point,
    /// The direction of the curve at the node
    pub velocity: Point,
}

/// ### May change at a later date
/// A curved path, currently represented as a series of [`SplineNode`]s
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(codegen, derive(TS))]
#[non_exhaustive]
pub struct Spline {
    /// The points the path travels through
    pub points: Vec<SplineNode>,
}
