use std::hash::Hash;

pub use super::counter;

/// Creates an atomic counter at each invocation site that evaluates to a new value each time
#[macro_export]
macro_rules! counter {
    ($tname:ident) => {{
        static COUNTER: std::sync::atomic::$tname = std::sync::atomic::$tname::new(0);
        COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }};
}

#[allow(unused)]
macro_rules! counter_impl {
    ($tname:ident is $pname:ident) => {
        paste::paste! {
            pub struct [<Counter $tname>](std::sync::atomic:: [<Atomic $tname>]);

            impl [<Counter $tname>] {
                pub fn new() -> Self {
                    Self(0.into())
                }

                pub fn next(&self) -> $pname {
                    self.0.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
                }

                pub fn get(&self) -> $pname {
                    self.0.load(std::sync::atomic::Ordering::Relaxed)
                }
            }
        }
    };
}

counter_impl! {U32 is u32}
counter_impl! {U64 is u64}

pub struct ResultIter<T, E, TIter: Iterator<Item = Result<T, E>>>(TIter);

impl<T, E, TIter: Iterator<Item = Result<T, E>>> Iterator for ResultIter<T, E, TIter> {
    type Item = T;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            match self.0.next() {
                Some(Ok(val)) => return Some(val),
                Some(Err(_)) => continue,
                None => return None,
            }
        }
    }
}

pub trait IterExt: Iterator {
    fn filter_ok<T, E>(self) -> ResultIter<T, E, Self>
    where
        Self: Iterator<Item = Result<T, E>> + Sized,
    {
        ResultIter(self)
    }
}

impl<T: Iterator> IterExt for T {}

// struct ErrLogger<T, E, F: Fn(E) -> T>(F);
