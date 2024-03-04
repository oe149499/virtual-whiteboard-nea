/// Creates an atomic counter at each invocation site that evaluates to a new value each time
macro_rules! counter {
    ($tname:ident) => {{
        static COUNTER: std::sync::atomic::$tname = std::sync::atomic::$tname::new(0);
        COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }};
}

pub(crate) use counter;

pub struct CounterU64(std::sync::atomic::AtomicU64);

impl CounterU64 {
    pub fn new() -> Self {
        Self(0.into())
    }

    pub fn next(&self) -> u64 {
        self.0.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    pub fn get(&self) -> u64 {
        self.0.load(std::sync::atomic::Ordering::Relaxed)
    }
}

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
