#![allow(missing_docs)] // API is documented in design section
//! Types associated with server-to-client notification messages

use crate::canvas::{Item, Stroke, Transform};

use super::{ClientID, ClientInfo, ItemID, LocationUpdate, MsgSend, PathID};
use paste::paste;
use serde::Serialize;
#[cfg(feature = "codegen")]
use ts_rs::TS;

/// An individual Notify-C message type that can be converted into a message
pub trait NotifyCType: Sized {
    /// Wrap self into an instance of the [`NotifyC`] enumeration
    fn as_notify(self) -> NotifyC;

    /// Wrap self fully into a sendable message
    fn as_msg(self) -> MsgSend {
        MsgSend::NotifyC(self.as_notify())
    }
}

macro_rules! notify_c_declarations {
	{
		$(#[$($eattr:tt)*])*
		enum $enum_name:ident;
        spec $spec_name:ident;
		$(
			$(#[$($attr:tt)*])*
			$name:ident (
				$(
					$(#[$($pattr:tt)*])*
					$pname:ident : $ptype:ty,
				)*
			)
		)*
	} => {
		paste!{
			$(#[$($eattr)*])*
			#[derive(Serialize, Debug)]
			#[serde(tag = "name")]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name ($name),
				)*
			}

            #[cfg(feature = "codegen")]
            #[derive(TS)]
            #[allow(non_snake_case, unused)] // Special reflection structure
            pub struct $spec_name {
                $(
                    $name: $name,
                )*
            }
		}
		$(
			$(#[$($attr)*])*
			#[derive(Serialize, Debug)]
            #[cfg_attr(feature = "codegen", derive(TS))]
            #[serde(rename_all = "camelCase")]
			pub struct $name {
				$(
					$(#[$($pattr)*])*
					pub $pname : $ptype,
				)*
			}

			impl NotifyCType for $name {
				fn as_notify(self) -> NotifyC {
					NotifyC::$name(self)
				}
			}
		)*
	}
}

notify_c_declarations! {
    /// The enumeration of all Notify-C types
    enum NotifyC;
    spec NotifyCSpec;

    /// A new client has joined the board (not necessarily connected)
    ClientJoined (
        /// The client's ID
        id: ClientID,
        /// The client's information
        info: ClientInfo,
    )

    /// A client has established a connection with the board
    ClientConnected (
        /// The client's ID
        id: ClientID,
    )

    ClientDisconnected (
        id: ClientID,
    )

    ClientExited (
        id: ClientID,
    )

    SelectionItemsAdded (
        id: ClientID,
        items: Vec<ItemID>,
        new_srt: Transform,
    )

    SelectionItemsRemoved (
        id: ClientID,
        items: Vec<(ItemID, LocationUpdate)>,
    )

    SelectionMoved (
        id: ClientID,
        transform: Transform,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[cfg_attr(feature = "codegen", ts(optional))]
        new_sits: Option<Vec<(ItemID, Transform)>>,
    )

    SingleItemEdited (
        id: ItemID,
        item: Item,
    )

    ItemsDeleted (
        ids: Vec<ItemID>,
    )

    ItemCreated (
        id: ItemID,
        client: ClientID,
        item: Item,
    )

    PathStarted (
        client: ClientID,
        stroke: Stroke,
        path: PathID,
    )
}

impl NotifyC {
    /// Wrap self in [`MsgSend`]
    pub fn as_msg(self) -> MsgSend {
        MsgSend::NotifyC(self)
    }
}
