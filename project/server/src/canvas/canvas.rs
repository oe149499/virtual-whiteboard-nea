//! Collection of types relating to board objects

pub mod active;
pub mod item;

use serde::{Deserialize, Serialize};
#[cfg(feature = "codegen")]
use ts_rs::TS;

pub use active::ActiveCanvas;
pub use item::Item;

/// A global location on the board plane
#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct Point {
    x: f64,
    y: f64,
}

/// A CSS-compatible color
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct Color(String);

/// A descriptor for how to render a line
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct Stroke {
    /// The thickness of the line, from one side to the other
    pub width: f64,
    /// The color of the line
    pub color: Color,
}

/// An angle, measured in degrees clockwise
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct Angle(f64);

/// A mapping used to position objects on the board
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[serde(rename_all = "camelCase")]
pub struct Transform {
    /// The global coordinate which the object is centered on and which all other transformations are relative to
    pub origin: Point,

    /// The basis vector of the original X-direction
    pub basis_x: Point,

    /// The Y-direction basis vector
    pub basis_y: Point,
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            origin: Point::default(),
            basis_x: Point { x: 1.0, y: 0.0 },
            basis_y: Point { x: 0.0, y: 1.0 },
        }
    }
}

/// A point along a [`Spline`]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct SplineNode {
    /// The position of the node
    pub position: Point,
    /// The direction of the curve at the node
    pub velocity: Point,
}

/// ### May change at a later date
/// A curved path, currently represented as a series of [`SplineNode`]s
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[non_exhaustive]
pub struct Spline {
    /// The points the path travels through
    pub points: Vec<SplineNode>,
}
