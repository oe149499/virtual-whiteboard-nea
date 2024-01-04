//! Multipart methods
#![allow(missing_docs)]
use std::mem;

use paste::paste;
use serde::{Deserialize, Serialize};
#[cfg(codegen)]
use ts_rs::TS;

use crate::canvas::{Item, SplineNode};

use super::{ClientID, ItemID};

pub trait IterateType {
    type Item: Serialize;
}

#[derive(Deserialize)]
pub struct IterateCall<M: IterateType> {
    id: u32,
    #[serde(flatten)]
    pub params: M,
}

impl<M: IterateType> IterateCall<M> {
    /// Extract parameters and convert into a response handle
    pub fn get_handle(self) -> (M, IterateResponse<M>) {
        (
            self.params,
            IterateResponse {
                id: self.id,
                complete: false,
                part: 0,
                items: Vec::new(),
            },
        )
    }
}

#[derive(Serialize, Debug)]
pub struct IterateResponse<M: IterateType> {
    id: u32,
    complete: bool,
    part: u32,
    items: Vec<M::Item>,
}

pub struct IterateHandle<M: IterateType> {
    id: u32,
    current_part: u32,
    current_items: Vec<M::Item>,
}

impl<M: IterateType> IterateHandle<M> {
    pub fn add_item(&mut self, item: M::Item) -> &mut Self {
        self.current_items.push(item);
        self
    }

    pub fn flush_response(&mut self) -> IterateResponse<M> {
        let items = mem::replace(&mut self.current_items, Vec::new());
        let response = IterateResponse {
            id: self.id,
            complete: false,
            part: self.current_part,
            items,
        };
        self.current_part += 1;
        response
    }

    pub fn finalize(self) -> IterateResponse<M> {
        IterateResponse {
            id: self.id,
            complete: true,
            part: self.current_part,
            items: self.current_items,
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
			#[cfg_attr(codegen, derive(TS))]
			#[serde(tag = "name")]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name ($name),
				)*
			}

			#[derive(Serialize, Debug)]
			#[cfg_attr(codegen, derive(TS))]
			#[serde(untagged)]
			pub enum $response_enum_name {
				$(
					#[doc = "See `[" $name "`] for more information"]
					$name (IterateResponse<$name>),
				)*
			}

			#[allow(non_snake_case, unused)]
			#[cfg_attr(codegen, derive(TS))]
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
			#[cfg_attr(codegen, derive(TS))]
			pub struct $name {
				$(
					$(#[$($pattr)*])*
					pub $pname : $ptype,
				)*
			}


			impl IterateType for $name {
				type Item = $itype;
			}
		)*
	}
}

iterate_declarations! {
    enum Iterates => IterateResponses;
    spec IterateSpec;

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
