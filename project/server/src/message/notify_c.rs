//! Types associated with server-to-client notification messages

use super::{ClientID, ClientInfo};
use paste::paste;
use serde::Serialize;
use ts_rs::TS;

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
			#[derive(Serialize, TS, Debug)]
			pub enum $enum_name {
				$(
					#[doc = "See [`" $name "`] for more information"]
					$name ($name)
				)*
			}
		}
		$(
			$(#[$($attr)*])*
			#[derive(Serialize, TS, Debug)]
			pub struct $name {
				$(
					$(#[$($pattr)*])*
					pub $pname : $ptype,
				)*
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
}
