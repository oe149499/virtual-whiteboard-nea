pub mod method;
use std::collections::HashMap;

use serde::{Serialize, Deserialize};
use ts_rs::TS;
use derive_more::Deref;

use crate::canvas::{Transform, Point};

#[derive(Serialize, Deserialize, TS)]
pub enum ErrorCode {
	NotAvailable = 0,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename = "ErrMsg")]
pub struct Error {
	pub code: ErrorCode,
	pub msg: Option<String>,
}

#[derive(Serialize, Deserialize, TS)]
pub enum Result<T = (), TErr = ErrorCode> {
	Ok(T),
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

#[derive(Serialize, Deserialize, TS)]
pub struct ClientInfo {
	pub name: String,
}

#[derive(Serialize, Deserialize, TS)]
pub struct ConnectionInfo {
	pub client_id: ClientID,
	pub session_id: SessionID,
}

#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash)]
pub struct SessionID(u32);
#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash)]
pub struct ClientID(u32);
#[derive(Serialize, Deserialize, TS, Deref, PartialEq, Eq, Hash)]
pub struct ItemID(u32);

#[derive(Serialize, Deserialize, TS)]
pub enum LocationUpdate {
	Transform(Transform),
	Points(Vec<Point>),
}

#[derive(Serialize, Deserialize, TS, Deref)]
pub struct ItemsDeselected(HashMap<ItemID, LocationUpdate>);