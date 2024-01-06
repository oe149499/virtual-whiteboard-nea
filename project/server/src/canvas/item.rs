//! The item types themselves

use super::{Color, Point, Spline, Stroke, Transform};
use crate::tags::TagID;
use paste::paste;
use serde::{Deserialize, Serialize};
#[cfg(feature = "codegen")]
use ts_rs::TS;

macro_rules! item_enum {
    {
        $(#[$($attr:tt)*])*
        enum $enum_name:ident { $($name:ident),* }
    } => {
        $(#[$($attr)*])*
        pub enum $enum_name {
            $(
                $name(paste!([<$name Item>])),
            )*
        }

        $(
            impl paste!([<$name Item>]) {
                pub fn to_item(self) -> $enum_name {
                    $enum_name::$name(self)
                }
            }
        )*
    }
}

item_enum! {
    /// A union of all Item types, see the individual types for more information
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[cfg_attr(feature = "codegen", derive(TS))]
    #[serde(tag = "type")]
    #[non_exhaustive]
    #[allow(missing_docs)]
    enum Item {
        Rectangle,
        Ellipse,
        Line,
        Polygon,
        Path,
        Image,
        Text,
        Link,
        Tag
    }
}

/// A rectangle.
///
/// NOTE: The size is implemented through the [`Transform`], instead of a separate property
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct RectangleItem {
    pub transform: Transform,
    pub stroke: Stroke,
    pub fill: Color,
}

/// An ellipse
///
/// NOTE: The size is implemented through the [`Transform`], instead of a separate property
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct EllipseItem {
    pub transform: Transform,
    pub stroke: Stroke,
    pub fill: Color,
}

/// A line segment between two points
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct LineItem {
    pub start: Point,
    pub end: Point,
    pub stroke: Stroke,
}

/// A closed loop of points
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct PolygonItem {
    pub points: Vec<Point>,
    pub stroke: Stroke,
    pub fill: Color,
}

/// A hand-drawn path between two points
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct PathItem {
    pub transform: Transform,
    pub path: Spline,
    pub stroke: Stroke,
}

/// An image stored in a URL
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct ImageItem {
    pub transform: Transform,
    pub url: String,
    pub description: String,
}

/// A text box, rendered with Markdown
///
/// NOTE: The [`Transform`] controls the text box, not the text itself
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct TextItem {
    pub transform: Transform,
    pub text: String,
}

/// A hyperlink
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub struct LinkItem {
    pub transform: Transform,
    pub url: String,
    pub text: String,
}

/// An indexed tag
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct TagItem {
    #[allow(missing_docs)]
    pub transform: Transform,
    /// The ID of the tag type
    pub id: TagID,
    /// The data associated with the tag
    pub data: String,
}
