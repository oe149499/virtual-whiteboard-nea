//! Messages informing of illegal requests made by clients
//! Only used when the client *could have* known that a request was guaranteed to fail, as opposed to failing based on simultaneous actions by other clients

use serde::Serialize;
#[cfg(feature = "codegen")]
use ts_rs::TS;

#[path = "./reject_helpers.rs"]
pub mod helpers;

/// A generic rejection message for any failed request
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[serde(rename_all = "camelCase")]
pub struct RejectMessage {
    /// The protocol used by the request
    pub request_protocol: &'static str,

    #[serde(skip_serializing_if = "Option::is_none")]
    /// The ID of the request, if applicable
    pub request_id: Option<u32>,

    /// Whether or not the rejection should cause a client-side error
    pub level: RejectLevel,

    /// The reason the request was bad
    pub reason: RejectReason,
}

/// The severity of the error
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
pub enum RejectLevel {
    /// The error does not obstruct further logic
    Warning = 0,
    /// The error obstructs further logic and is likely sent instead of a response
    Error = 1,
}

/// Category of a rejection
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "codegen", derive(TS))]
#[allow(missing_docs)]
pub enum RejectReason {
    NonExistentID {
        id_type: &'static str,
        value: u32,
    },
    IncorrectType {
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<String>,
        expected: &'static str,
        received: String,
    },
    MalformedMessage {
        location: String,
    },
    ResourceNotOwned {
        resource_type: &'static str,
        target_id: u32,
    },
}
