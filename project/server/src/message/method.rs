//! Method call signatures and helper types

use std::marker::PhantomData;

use crate::client::ClientHandle;

use super::MsgSend;
use serde::{Deserialize, Serialize};

#[cfg(feature = "codegen")]
use ts_rs::TS;

/// The information describing a method call
pub trait MethodType {
    /// The type that should be sent back to the client
    #[cfg(not(feature = "codegen"))]
    type Response: Serialize + Sized;

    #[cfg(feature = "codegen")]
    type Response: Serialize + Sized + TS;

    /// Wrap self in the [`Responses`] enum
    fn wrap_response(data: Response<Self>) -> Responses;
}

#[derive(Deserialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
/// An object representing a method call packet
pub struct Call<T: MethodType> {
    /// The call ID for the client to associate the response with the call
    id: u32,
    #[serde(flatten)]
    /// The call parameters
    pub params: T,
}

/// A reference to the information needed to reply to a method
pub struct MethodHandle<T: MethodType> {
    id: u32,
    client: Option<ClientHandle>,
    _t: PhantomData<T>,
}

impl<T: MethodType> Call<T> {
    /// Deconstruct self into parameters and a [`MethodHandle`]
    pub fn create_handle(self, client: Option<ClientHandle>) -> (T, MethodHandle<T>) {
        (
            self.params,
            MethodHandle {
                id: self.id,
                client,
                _t: PhantomData,
            },
        )
    }
}

impl<T: MethodType> MethodHandle<T> {
    /// Send a response to the client
    pub fn respond(self, value: T::Response) {
        let response = T::wrap_response(Response { id: self.id, value });
        if let Some(client) = self.client {
            client.send_message(MsgSend::Response(response));
        }
    }
}

impl<T: MethodType<Response = super::Result<TOk, TErr>>, TOk, TErr> MethodHandle<T> {
    /// Construct a return packet from a [`super::Result::Ok`] value
    pub fn ok(self, value: TOk) {
        self.respond(super::Result::Ok(value))
    }

    /// Construct a return packet from a [`super::Result::Err`] value
    pub fn err(self, value: TErr) {
        self.respond(super::Result::Err(value))
    }
}

/// An object representing a method return packet
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct Response<T: MethodType + ?Sized> {
    /// See [`Call::id`]
    id: u32,
    /// The return value
    pub value: T::Response,
}

macro_rules! method_declarations {
	{
		$(#[$($eattr:tt)*])*
		enum $enum_name:ident => $response_enum_name:ident;
		spec $spec_name:ident;
		$(
			$(#[$($attr:tt)*])*
			fn $name:ident (
				$(
					$(#[$($pattr:tt)*])*
					$pname:ident : $ptype:ty,
				)*
			) => $rtype:ty
		)*
	} => {
		paste::paste!{
			$(#[$($eattr)*])*
			#[derive(Deserialize, Debug)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			#[serde(tag = "name")]
			#[allow(missing_docs)]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name (Call<$name>),
				)*
			}

			#[derive(Serialize, Debug)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			#[serde(untagged)]
			#[allow(missing_docs)]
			pub enum $response_enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name (Response<$name>),
				)*
			}

			#[cfg(feature = "codegen")]
			#[allow(non_snake_case, unused)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			pub struct $spec_name {
				$(
					$name: ($name, $rtype),
				)*
			}

			#[cfg(feature = "codegen")]
			impl $spec_name {
				pub const NAMES: &'static [&'static str] = &[$(stringify!($name)),*];
			}
		}
		$(
			$(#[$($attr)*])*
			#[derive(Deserialize, Debug)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			pub struct $name {
				$(
					$(#[$($pattr)*])*
					pub $pname : $ptype,
				)*
			}


			impl MethodType for $name {
				type Response = $rtype;

				fn wrap_response(r: Response<Self>) -> Responses {
					Responses::$name(r)
				}
			}
		)*
	}
}

pub use _methods::*;
#[allow(non_snake_case, missing_docs)]
mod _methods {
    use std::collections::BTreeMap;

    use super::*;
    use crate::{
        canvas::{Item, SplineNode, Stroke},
        message::{self as m, BatchChanges, ClientID, ClientInfo, ItemID, LocationUpdate, PathID},
    };

    method_declarations! {
        enum Methods => Responses;
        spec MethodSpec;
        /// Attempt to add a set of items to the client's selection
        fn SelectionAddItems(items: Vec<ItemID>,) => Vec<m::Result>

        /// Remove a set of items from the client's selection.
        /// This operation should be either fully successful or fully unsuccessful
        fn SelectionRemoveItems(items: BTreeMap<ItemID, LocationUpdate>,) => m::Result

        /// Apply a [`BatchChanges`] to the set of items
        fn EditBatchItems(ids: Vec<ItemID>, changes: BatchChanges,) => Vec<m::Result>

        /// Replace/Merge \[TODO: Clarify/decide] an item with a new item
        fn EditSingleItem(id: ItemID, item: Item,) => m::Result

        /// Delete multiple items from the board
        fn DeleteItems(ids: Vec<ItemID>,) => Vec<m::Result>

        /// Create a new item
        fn CreateItem(item: Item,) => ItemID

        /// Start a new path
        fn BeginPath(stroke: Stroke,) => PathID

        /// Continue the path
        fn ContinuePath(id: PathID, points: Vec<SplineNode>,) => ()

        /// Close the path
        fn EndPath(id: PathID,) => m::Result<ItemID>

        /// Get a list of every ID on the board
        fn GetAllItemIDs() => Vec<ItemID>

        /// Get a list of all clients and their associated information
        fn GetAllClientInfo() => BTreeMap<ClientID, ClientInfo>
    }
}
