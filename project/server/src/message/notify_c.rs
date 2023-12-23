//! Types associated with server-to-client notification messages

use super::{ClientID, ClientInfo, MsgSend};
use paste::paste;
use serde::Serialize;
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
		$(
			$(#[$($attr:tt)*])*
			$name:ident (
				$(
					$(#[$($pattr:tt)*])*
					$pname:ident : $ptype:ty
				),*
			);
		)*
	} => {
		paste!{
			$(#[$($eattr)*])*
			#[derive(Serialize, TS, Debug, Clone)]
			#[serde(tag = "name")]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name ($name),
				)*
			}
		}
		$(
			$(#[$($attr)*])*
			#[derive(Serialize, TS, Debug, Clone)]
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

    /// A new client has joined the board (not necessarily connected)
    ClientJoined (
        /// The client's ID
        id: ClientID,
        /// The client's information
        info: ClientInfo
    );

    /// A client has established a connection with the board
    ClientConnected (
        /// The client's ID
        id: ClientID
    );
}

impl NotifyC {
    /// Wrap self in [`MsgSend`]
    pub fn as_msg(self) -> MsgSend {
        MsgSend::NotifyC(self)
    }
}
