//! Types associated with communication between client and server

pub mod iterate;
pub mod method;
pub mod notify_c;
use std::str::FromStr;

use derive_more::Deref;
use serde::{Deserialize, Serialize};
#[cfg(feature = "codegen")]
use ts_rs::TS;

use crate::canvas::{Color, Point, Stroke, Transform};

#[derive(Deserialize, Debug)]
#[serde(tag = "protocol")]
/// A message received from a client
pub enum MsgRecv {
    /// A method call expecting a response
    Method(method::Methods),
    /// A method call expecting a streamed response
    Iterate(iterate::Iterates),
}

/// A message sent to a client
#[derive(Serialize, Debug)]
#[serde(tag = "protocol")]
pub enum MsgSend {
    /// A response to a method call
    Response(method::Responses),

    /// A notification for clients
    #[serde(rename = "Notify-C")]
    NotifyC(notify_c::NotifyC),

    /// A segment of an iteration response
    #[serde(rename = "Response-Part")]
    IterateResponse(iterate::IterateResponses),
}

#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// A generic error code that indicates a problem with a request
pub enum ErrorCode {
    /// The request attempted to access a resource which is currently in use by another client
    NotAvailable,
    /// An internal server error happened, no further information is available
    Internal,
    /// The requested resource does not exist
    NotFound,
    /// The path was not created due to the length being 0
    EmptyPath,
    /// Data provided is incompatible with the target operation
    BadData,
}

impl Into<Error> for ErrorCode {
    fn into(self) -> Error {
        Error::code(self)
    }
}

#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[serde(rename = "ErrMsg")]
/// An error code with an explanation
pub struct Error {
    /// The error code
    pub code: ErrorCode,
    /// The error explanation
    pub msg: Option<String>,
}

impl Error {
    /// Preset for internal errors
    pub fn internal() -> Self {
        Self {
            code: ErrorCode::Internal,
            msg: None,
        }
    }

    /// Create an error from just a code
    pub fn code(code: ErrorCode) -> Self {
        Self { code, msg: None }
    }
}

/// Copy of [`std::result::Result`] to enable generation of TS types.
///
/// Convenient default type parameters are also set.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[serde(tag = "status", content = "value")]
pub enum Result<T = (), TErr = Error> {
    /// Success
    Ok(T),
    /// Failure
    Err(TErr),
}
pub use self::Result::{Err, Ok};

impl<T, E> From<core::result::Result<T, E>> for Result<T, E> {
    fn from(value: core::result::Result<T, E>) -> Self {
        match value {
            core::result::Result::Ok(v) => Result::Ok(v),
            core::result::Result::Err(v) => Result::Err(v),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[non_exhaustive]
/// The information describing a client
pub struct ClientInfo {
    /// The client's name
    pub name: String,
}

/// Identification provided to clients
#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    /// See [`ClientID`]
    pub client_id: ClientID,
    /// See [`SessionID`]
    pub session_id: SessionID,
}

#[derive(Serialize, Deserialize, Deref, PartialEq, Eq, Hash, Debug, Clone, Copy)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// A private ID used to verify reconnects
pub struct SessionID(u32);

impl SessionID {
    /// Atomically create a new unique [`SessionID`]
    pub fn new() -> Self {
        Self(crate::utils::counter!(AtomicU32))
    }
}

impl FromStr for SessionID {
    type Err = <u32 as FromStr>::Err;
    fn from_str(s: &str) -> core::result::Result<Self, Self::Err> {
        core::result::Result::Ok(Self(s.parse()?))
    }
}

#[derive(
    Serialize, Deserialize, Deref, PartialEq, Eq, PartialOrd, Ord, Hash, Debug, Clone, Copy,
)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// A public ID shared with other clients
pub struct ClientID(u32);

impl ClientID {
    /// Atomically create a new uniquw [`ClientID`]
    pub fn new() -> Self {
        Self(crate::utils::counter!(AtomicU32))
    }
}

#[derive(
    Serialize, Deserialize, Deref, PartialEq, Eq, PartialOrd, Ord, Hash, Debug, Clone, Copy,
)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// A board-unique ID for each [`crate::canvas::Item`]
pub struct ItemID(pub u32);

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// A piece of location data which could describe either a [`Transform`] or [`Point`]-based [`crate::canvas::Item`]
pub enum LocationUpdate {
    /// The new [`Transform`] of the item
    Transform(Transform),
    /// The new set of [`Point`]s of the item
    Points(Vec<Point>),
}

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// The edits that can be made to multiple [`crate::canvas::Item`]s at the same time
pub struct BatchChanges {
    /// The new fill [`Color`] for the items
    pub fill: Option<Color>,
    /// The new [`Stroke`] information for the items
    pub stroke: Option<Stroke>,
}
