//! Multipart methods
#![allow(missing_docs)]
use std::mem;

use paste::paste;
use serde::{Deserialize, Serialize};
#[cfg(feature = "codegen")]
use ts_rs::TS;

use crate::{
    canvas::{Item, SplineNode},
    client::ClientHandle,
};

use super::{ClientID, ItemID, MsgSend};

pub trait IterateType: Sized {
    #[cfg(not(feature = "codegen"))]
    type Item: Serialize;

    #[cfg(feature = "codegen")]
    type Item: Serialize + TS;

    fn make_response(r: IterateResponse<Self>) -> IterateResponses;
}

#[derive(Deserialize, Debug)]
pub struct IterateCall<M: IterateType> {
    id: u32,
    #[serde(flatten)]
    pub params: M,
}

impl<M: IterateType> IterateCall<M> {
    /// Extract parameters and convert into a response handle
    pub fn get_handle(self, client: Option<ClientHandle>) -> (M, IterateHandle<M>) {
        (
            self.params,
            IterateHandle {
                id: self.id,
                current_part: 0,
                current_items: Vec::new(),
                client,
            },
        )
    }
}

#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub struct IterateResponse<M: IterateType> {
    id: u32,
    complete: bool,
    part: u32,
    items: Vec<M::Item>,
}

impl<M: IterateType> IterateResponse<M> {
    /// Wrap [`Self`] in a [`MsgSend`]
    pub fn to_msg(self) -> MsgSend {
        MsgSend::IterateResponse(M::make_response(self))
    }
}

#[derive(Debug)]
pub struct IterateHandle<M: IterateType> {
    id: u32,
    current_part: u32,
    current_items: Vec<M::Item>,
    client: Option<ClientHandle>,
}

impl<M: IterateType> IterateHandle<M> {
    pub fn add_item(&mut self, item: M::Item) -> &mut Self {
        self.current_items.push(item);
        self
    }

    pub fn add_items(&mut self, items: &[M::Item]) -> &mut Self
    where
        M::Item: Clone,
    {
        self.current_items.extend_from_slice(items);
        self
    }

    pub fn flush_response(&mut self) {
        let items = mem::replace(&mut self.current_items, Vec::new());
        let response = IterateResponse::<M> {
            id: self.id,
            complete: false,
            part: self.current_part,
            items,
        };
        self.current_part += 1;
        if let Some(client) = &self.client {
            client.send_message(response.to_msg());
        }
    }

    pub fn finalize(self) {
        if let Some(client) = self.client {
            client.send_message(
                IterateResponse::<M> {
                    id: self.id,
                    complete: true,
                    part: self.current_part,
                    items: self.current_items,
                }
                .to_msg(),
            );
        }
    }
}

macro_rules! iterate_declarations {
	{
		$(#[$($eattr:tt)*])*
		enum $enum_name:ident => $response_enum_name:ident;
		spec $spec_name:ident;
		$(
			$(#[$($attr:tt)*])*
			$name:ident (
				$(
					$(#[$($pattr:tt)*])*
					$pname:ident : $ptype:ty,
				)*
			) => $itype:ty
		)*
	} => {
		paste!{
			$(#[$($eattr)*])*
			#[derive(Deserialize, Debug)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			#[serde(tag = "name")]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name (IterateCall<$name>),
				)*
			}

			#[derive(Serialize, Debug)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			#[serde(untagged)]
			pub enum $response_enum_name {
				$(
					#[doc = "See `[" $name "`] for more information"]
					$name (IterateResponse<$name>),
				)*
			}

			#[allow(non_snake_case, unused)]
			#[cfg_attr(feature = "codegen", derive(TS))]
			pub struct $spec_name {
				$(
					$name: ($name, $itype),
				)*
			}

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


			impl IterateType for $name {
				type Item = $itype;

				fn make_response(r: IterateResponse<Self>) -> IterateResponses {
					IterateResponses::$name(r)
				}
			}
		)*
	}
}

iterate_declarations! {
    enum Iterates => IterateResponses;
    spec IterateSpec;

    Count(
        from: u32,
        to: u32,
    ) => u32

    GetPartialItems(
        ids: Vec<ItemID>,
    ) => super::Result<Item>

    GetFullItems(
        ids: Vec<ItemID>,
    ) => super::Result<Item>

    GetActivePath(
        client: ClientID,
    ) => SplineNode
}
