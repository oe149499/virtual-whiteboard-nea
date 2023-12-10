//! Method call signatures and helper types

use serde::{Serialize, Deserialize};
use ts_rs::TS;

/// The information describing a method call
pub trait Method {
	/// The type that should be sent back to the client
	type Response : TS + Serialize;

	/// The name of the method in Typescript
	fn name() -> String;

	/// The parameters of the method as a Typescript object
	fn ts_params() -> String;

	/// The return type in Typescript
	fn ts_return() -> String;
}

#[derive(TS, Serialize, Deserialize)]
/// An object representing a method call packet
pub struct Call<T : Method> {
	/// The call ID for the client to associate the response with the call
	id: u32,
	#[serde(flatten)]
	/// The call parameters
	pub params: T,
}

impl <T : Method> Call<T> {
	/// Construct a return packet from the call
	pub fn create_response(&self, value: T::Response) -> Response<T> {
		Response {
			id: self.id,
			value
		}
	}
}

/// An object representing a method return packet
#[derive(TS, Serialize, Deserialize)]
pub struct Response<T : Method> {
	/// See [`Call::id`]
	id: u32,
	/// The return value
	pub value: T::Response,
}

macro_rules! parse_type {
	//($($t:tt)*) => ($($t)*);

	(@(
		$main:ty,
		$($p:expr),*
	)) => {
		<$main as TS>::name_with_type_args(
			vec![
				$($p),*
			]
		)
	};

	(@[$($p:tt)*] $i:ident $($r:tt)*) => (
		parse_type!(
			@[$($p)* $i]
			$($r)*
		)
	);

	(@[$($p:tt)*] :: $($r:tt)*) => (
		parse_type!(
			@[$($p)* ::]
			$($r)*
		)
	);

	(@[$($p:tt)*]) => {
		<$($p)* as TS>::name()
	};

	(@[$($p:tt)*] <($($inner:tt)*)>) => (
		parse_type!(@(
			$($p)*<$($inner)*>,
			parse_type!(
					$($inner)*
			)
		))
	);

	(@ $($t:tt)*) => {
		macro_error
	};

	($($t:tt)*) => (
		parse_type!(
			@[]
			$($t)*
		)
	);
}

macro_rules! parse_params {
	(@{$name:ident : $($ty:tt)*}) => (
		format!(
			"{}: {}",
			stringify!($name),
			parse_type!($($ty)*),
		)
	);

	(@{}) => {};

	(@($($curr:tt)*)[$($d:tt)*] ,$($n:tt)+) => (
		parse_params!(@
			()
			[$($d)* parse_params!(@{
				$($curr)*
			}),]
			$($n)+
		)
	);

	(@($($curr:tt)*)[$($d:tt)*] $next:tt $($n:tt)*) => (
		parse_params!(@
			($($curr)* $next)
			[$($d)*]
			$($n)*
		)
	);

	(@($($curr:tt)*)[$($d:tt)*]) => (
		[
			$($d)*
			parse_params!(@{$($curr)*})
		].join(", ")
	);

	(@($($t1:tt)*) $($t:tt)*) => {
		macro_error
	};

	() => ("");

	($($t:tt)*) => {
		parse_params!(
			@()[] $($t)*
		)
	}
}

macro_rules! pubify {
	([$($attrs:tt)*] $mname:ident => $($name:ident : $type:ty),*) => (
		$($attrs)*
		#[derive(TS, Serialize, Deserialize)]
		pub struct $mname {
			$(
				#[allow(missing_docs)]
				pub $name: $type
			),*
		}
	)
}

macro_rules! declare_method {
	{
		$(#[$($attr:tt)*])*
		fn $method_name:ident($($params:tt)*) -> $($rt:tt)*
	} => {
		pubify!{[$(#[$($attr)*])*]$method_name => $($params)*}

		impl Method for $method_name {
			type Response = $($rt)*;

			fn name() -> String {
				stringify!($method_name).to_string()
			}

			fn ts_params() -> String {
				parse_params!($($params)*)
			}

			fn ts_return() -> String {
				parse_type!($($rt)*)
			}
		}
	}
}

/// Helper macro to generate the enum of all methods
macro_rules! method_enum {
	{
		$enum_name:ident => $($type:ident,)*
	} => {
		/// The enumeration of all method call types
		#[derive(Serialize, Deserialize, TS)]
		pub enum $enum_name {
			$(
				/// See individual types for more information
				$type(Call<$type>),
			)*
		}
	}
}

method_enum! {
	Methods => Connect, Reconnect, SelectionAddItems, SelectionRemoveItems, EditBatchItems, EditSingleItem, DeleteItems,
}

pub use _methods::*;
#[allow(unused_parens, non_snake_case)]
mod _methods {
	use super::*;
	use crate::{message::{self as m, ClientInfo, SessionID, ItemID, ItemsDeselected, BatchChanges}, canvas::Item};
	declare_method! {
		/// Establish a connection with the given information
		fn Connect(info: ClientInfo) -> m::Result<(m::ConnectionInfo)>
	}

	declare_method!{
		/// Re-establish a connection and continue as left off
		fn Reconnect(session: SessionID) -> m::Result
	}

	declare_method!{
		/// Attempt to add a set of items to the client's selection
		fn SelectionAddItems(items: Vec<(ItemID)>) -> Vec<(m::Result)>
	}

	declare_method!{
		/// Remove a set of items from the client's selection.
		/// This operation should be either fully successful or fully unsuccessful
		fn SelectionRemoveItems(items: ItemsDeselected) -> m::Result
	}

	declare_method!{
		/// Apply a [`BatchChanges`] to the set of items
		fn EditBatchItems(ids: Vec<(ItemID)>, changes: BatchChanges) -> Vec<(m::Result)>
	}

	declare_method!{
		/// Replace/Merge \[TODO: Clarify/decide] an item with a new item
		fn EditSingleItem(id: ItemID, item: Item) -> m::Result
	}

	declare_method!{
		/// Delete multiple items from the board
		fn DeleteItems(ids: Vec<(ItemID)>) -> Vec<(m::Result)>
	}
}