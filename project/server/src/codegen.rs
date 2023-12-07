use std::{fs::File, io::Write};
use ts_rs::TS;

macro_rules! export_str {
	( [
		$($type:ty,)*
	] with $param:ident : $ptype:ident => $func:expr ) => {{
		fn export<$param: $ptype>() -> String {
			{
				$func
			}.into()
		}

		[$(export::<$type>()),*].join("\n")
	}}
}

fn main() {
	let type_export = {
		use virtual_whiteboard::{
			message      as m,
			canvas       as c,
			canvas::item as i,
		};
		export_str! {[
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
			i::TagItem,
			i::Item,

			virtual_whiteboard::tags::TagID,
		] with T : TS => {
			format!("export {}", T::decl())
		}}
	};

	let method_export = {
		use virtual_whiteboard::message::method::{Method, self as m};
		export_str!{[
			m::Connect,
			m::Reconnect,
			m::SelectionAddItems,
		] with T : Method => {
			T::ts_decl()
		}}
	};

	println!("{}", method_export);

	let mut args = std::env::args();
	while args.next().expect("Missing 'to' argument (usage '<exec> to <file location>')") != "to" {}
	let mut file = File::create(args.next().unwrap()).unwrap();
	file.write(type_export.as_bytes()).expect("File write failed");
	
}