use std::{marker::PhantomData, fs::File, io::Write};
use itertools::Itertools;
use ts_rs::{TS, ExportError};

trait Exporter where Self : 'static {
	fn export_to_string(&self) -> Result<String, ExportError>;
	fn decl(&self) -> String;
}
struct _Exporter<T:TS>(PhantomData<T>);

impl<T:TS> _Exporter<T> {
	fn new() -> Box<Self> {
		Box::new(Self(PhantomData))
	}
}

impl<T: TS + 'static> Exporter for _Exporter<T> {
	fn export_to_string(&self) -> Result<String, ExportError> where Self : 'static {
		T::export_to_string()
	}

	fn decl(&self) -> String {
		T::decl()
	}
}

macro_rules! export {
	[ $( $x:ty ),* $(,)? ] => {
		vec![
			$(
				_Exporter::<$x>::new(),
			)*
		]
	};
}

macro_rules! parse_lines {
	([$($acc:tt)*], $export:ident, $type:ty; $($rest:tt)*) => (parse_lines!([$($acc)*,  $export::<$type>()], $export, $($rest)*));
	([$($acc:tt)*], $export:ident, $e:expr; $($rest:tt)*) => (parse_lines!([$($acc)*, $e.to_string()], $export, $($rest)*));
	([$($acc:tt)*], $export:ident, ) => ([$($acc)*])
}

macro_rules! export_str {
	( [
		$($type:ty,)*
	] with $param:ident => $func:expr ) => {{
		fn export<$param : TS>() -> String {
			{
				$func
			}.into()
		}

		[$(export::<$type>()),*].join("\n")
	}}
}

fn main() {
	use virtual_whiteboard::{
		message      as m,
		canvas       as c,
		canvas::item as i,
	};
	let to_export = export_str! {[
		m::ErrorCode,
		m::Error,
		m::Result,
		m::ClientInfo,
		m::SessionID,
		m::ClientID,
		m::ItemID,

		c::Point,
		c::Color,
		c::Stroke,
		c::Angle,
		c::Transform,
		c::Spline,

		i::RectangleItem,
		i::EllipseItem,
		i::LineItem,
		i::PolygonItem,
		i::PathItem,
		i::ImageItem,
		i::TextItem,
		i::LinkItem,
		i::Item,

	] with T => {
		format!("export {}", T::decl())
	}};
	let mut args = std::env::args();
	while args.next().expect("Missing 'to' argument (usage '<exec> to <file location>')") != "to" {}
	let mut file = File::create(args.next().unwrap()).unwrap();
	file.write(to_export.as_bytes()).expect("File write failed");
	
}