pub use super::counter;

/// Creates an atomic counter at each invocation site that evaluates to a new value each time
#[macro_export]
macro_rules! counter {
	($tname:ident) => {
		{
			static COUNTER: std::sync::atomic::$tname = std::sync::atomic::$tname::new(0);
			COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
		}
	}
}