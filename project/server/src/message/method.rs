use serde::{Serialize, Deserialize};
use ts_rs::{TS, Dependency};

use super::{ClientInfo, SessionID, ItemID};

pub trait Method {
	type Response : TS + Serialize;

	fn ts_decl() -> String;
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
		pub struct $mname {
			$(
				pub $name: $type
			),*
		}
	)
}

macro_rules! declare_method {
	{fn $method_name:ident($($params:tt)*) -> $($rt:tt)*} => {
		//#[derive(TS, Serialize, Deserialize)]
		pubify!{$method_name => $($params)*}

		impl Method for $method_name {
			type Response = $($rt)*;
			fn ts_decl() -> String {
				format!(
					"async function {}({}): {}", 
					stringify!($method_name), 
					parse_params!($($params)*),
					parse_type!($($rt)*),
				)
			}
		}
	}
}

declare_method!{
	fn Test(a: usize, b: usize) -> String
}

declare_method! {
	fn Connect(info: ClientInfo) -> super::Result<(super::ConnectionInfo)>
}

declare_method!{
	fn Reconnect(session: SessionID) -> super::Result
}

declare_method!{
	fn SelectionAddItems(items: Vec<(ItemID)>) -> Vec<(super::Result)>
}