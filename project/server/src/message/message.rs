//! Types associated with communication between client and server

pub mod method;
use std::collections::HashMap;

use serde::{Serialize, Deserialize};
use ts_rs::TS;
use derive_more::Deref;

use crate::canvas::{Transform, Point, Color, Stroke};

#[derive(Serialize, Deserialize, TS, Debug)]
#[serde(tag = "protocol")]
/// A message received from a client
pub enum MsgRecv {
	/// A method call expecting a response
	Method(method::Methods),
}

/// A message sent to a client
#[derive(Serialize, Deserialize, TS, Debug)]
#[serde(tag = "protocol")]
pub enum MsgSend {
	/// A response to a method call
	Response(method::Responses),
}

#[derive(Serialize, Deserialize, TS, Debug)]
/// A generic error code that indicates a problem with a request
pub enum ErrorCode {
	/// The request attempted to access a resource which is currently in use by another client
	NotAvailable = 0,
}

#[derive(Serialize, Deserialize, TS, Debug)]
#[serde(rename = "ErrMsg")]
/// An error code with an explanation
pub struct Error {
	/// The error code
	pub code: ErrorCode,
	/// The error explanation
	pub msg: Option<String>,
}

#[derive(Serialize, Deserialize, TS, Debug)]
/// Copy of [`std::result::Result`] to enable generation of TS types.
/// 
/// Convenient default type parameters are also set.
pub enum Result<T = (), TErr = ErrorCode> {
	/// Success
	Ok(T),
	/// Failure
	Err(TErr),
}

impl <T,E> From<core::result::Result<T, E>> for Result<T, E> {
	fn from(value: core::result::Result<T, E>) -> Self {
		match value {
			Ok(v) => Result::Ok(v),
			Err(v) => Result::Err(v)
		}
	}
}

#[derive(Serialize, Deserialize, TS, Debug)]
#[non_exhaustive]
/// The information describing a client
pub struct ClientInfo {
	/// The client's name
	pub name: String,
}

#[derive(Serialize, Deserialize, TS, Debug)]
/// Identification provided to clients
pub struct ConnectionInfo {
	/// See [`ClientID`]
	pub client_id: ClientID,
	/// See [`SessionID`]
	pub session_id: SessionID,
}

#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash, Debug, Clone, Copy)]
/// A private ID used to verify reconnects
pub struct SessionID(u32);
#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash, Debug, Clone, Copy)]
/// A public ID shared with other clients
pub struct ClientID(u32);

impl ClientID {
	/// Atomically create a new uniquw [`ClientID`]
	pub fn new() -> Self {
		Self(crate::utils::counter!(AtomicU32))
	}
}

#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash, Debug, Clone, Copy)]
/// A board-unique ID for each [`crate::canvas::Item`]
pub struct ItemID(u32);

#[derive(Serialize, Deserialize, TS, Debug)]
/// A piece of location data which could describe either a [`Transform`] or [`Point`]-based [`crate::canvas::Item`]
pub enum LocationUpdate {
	/// The new [`Transform`] of the item
	Transform(Transform),
	/// The new set of [`Point`]s of the item
	Points(Vec<Point>),
}

#[derive(Serialize, Deserialize, TS, Deref, Debug)]
/// The information required to describe a collection of [`crate::canvas::Item`]s being deselected.
/// Each item needs to have a new absolute position, but that could be a [`Transform`] or collection of [`Point`]s.
/// 
/// See also [`LocationUpdate`]
pub struct ItemsDeselected(HashMap<ItemID, LocationUpdate>);

#[derive(Serialize, Deserialize, TS, Debug)]
/// The edits that can be made to multiple [`crate::canvas::Item`]s at the same time
pub struct BatchChanges {
	/// The new fill [`Color`] for the items
	pub fill: Option<Color>,
	/// The new [`Stroke`] information for the items
	pub stroke: Option<Stroke>,
}