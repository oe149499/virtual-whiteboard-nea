use serde::{Serialize, Deserialize};
use ts_rs::TS;

pub trait Method {
	type Response : TS + Serialize;

	fn name() -> String;

	fn ts_params() -> String;

	fn ts_return() -> String;
}

#[derive(TS, Serialize, Deserialize)]
pub struct Call<T : Method> {
	id: u32,
	#[serde(flatten)]
	pub params: T,
}

impl <T : Method> Call<T> {
	pub fn create_response(&self, value: T::Response) -> Response<T> {
		Response {
			id: self.id,
			value
		}
	}
}

#[derive(TS, Serialize, Deserialize)]
pub struct Response<T : Method> {
	id: u32,
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
	($mname:ident => $($name:ident : $type:ty),*) => (
		#[derive(TS, Serialize, Deserialize)]
		pub struct $mname {
			$(
				pub $name: $type
			),*
		}
	)
}

macro_rules! declare_method {
	{fn $method_name:ident($($params:tt)*) -> $($rt:tt)*} => {
		pubify!{$method_name => $($params)*}

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

macro_rules! method_enum {
	{
		$enum_name:ident => $($type:ident,)*
	} => {
		#[derive(Serialize, Deserialize, TS)]
		pub enum $enum_name {
			$(
				$type($type),
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
		fn Connect(info: ClientInfo) -> m::Result<(m::ConnectionInfo)>
	}

	declare_method!{
		fn Reconnect(session: SessionID) -> m::Result
	}

	declare_method!{
		fn SelectionAddItems(items: Vec<(ItemID)>) -> Vec<(m::Result)>
	}

	declare_method!{
		fn SelectionRemoveItems(items: ItemsDeselected) -> m::Result
	}

	declare_method!{
		fn EditBatchItems(ids: Vec<(ItemID)>, changes: BatchChanges) -> Vec<(m::Result)>
	}

	declare_method!{
		fn EditSingleItem(id: ItemID, item: Item) -> m::Result
	}

	declare_method!{
		fn DeleteItems(ids: Vec<(ItemID)>) -> Vec<(m::Result)>
	}
}