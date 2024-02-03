//! Helper functions to generate reject messages

use super::RejectReason;

trait ResourceType {
    const NAME: &'static str;

    fn value(&self) -> u32;
}

macro_rules! resource_types {
    (
		$($target:ty: $name:literal)*
	) => {
        $(
			impl ResourceType for $target {
				const NAME: &'static str = $name;

				fn value(&self) ->  u32 {
					**self
				}
			}
		)*
    };
}

resource_types! {
    crate::message::ItemID: "Item"
    crate::message::PathID: "Path"
}

/// Shorthand for creating a [`RejectReason::ResourceNotOwned`]
#[allow(private_bounds)]
pub fn resource_not_owned<T: ResourceType>(res: T) -> RejectReason {
    RejectReason::ResourceNotOwned {
        resource_type: T::NAME,
        target_id: res.value(),
    }
}

/// Shorthand for creating a [`RejectReason::NonExistentID`]
#[allow(private_bounds)]
pub fn non_existent_id<T: ResourceType>(res: T) -> RejectReason {
    RejectReason::NonExistentID {
        id_type: T::NAME,
        value: res.value(),
    }
}
