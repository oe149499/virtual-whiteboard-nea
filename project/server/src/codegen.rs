use std::fs;
use itertools::Itertools;
use lazy_static::lazy_static;
use ts_rs::TS;
use camino::Utf8PathBuf;
use clap::{Parser, Arg};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]

struct Args {
	#[arg(short='o', long="out-dir")]
	output_root: Utf8PathBuf,

	#[arg(short, long, default_value_t = false)]
	types: bool,

	#[arg(short, long, default_value_t = false)]
	methods: bool,

	#[arg(short, long, default_value_t = false)]
	dry_run: bool,
}

enum ExportTarget {
	Types,
	Methods,
}

impl ExportTarget {
	fn to_str(&self) -> &'static str {
		match self {
			Self::Types => "Types",
			Self::Methods => "Methods",
		}
	}

	fn is_enabled(&self) -> bool {
		match self {
			Self::Types => ARGS.types,
			Self::Methods => ARGS.methods,			
		}
	}
}

lazy_static! {
	static ref ARGS: Args = Args::parse();
}

fn export(target: ExportTarget, content: String) {
	if !target.is_enabled() {
		return;
	}

	let path = ARGS.output_root.join(
		format!(
			"{}.ts", target.to_str()
		)
	);

	if ARGS.dry_run {
		println!(
			"======== BEGIN [{}] ========",
			path,
		);
		println!(
			"{}", content
		);
		println!(
			"======== END [{}] ========",
			path
		);
	} else {
		fs::write(path, content).unwrap();
	}
}

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
	#[allow(non_upper_case_globals)] // Static is only used so that it can be modified in the export macro
	static mut names: Vec<String> = Vec::new();

	let type_export = {
		use virtual_whiteboard::{
			message      as m,
			canvas       as c,
			canvas::item as i,
		};
		export_str! {
			[
			m::ErrorCode,
			m::Error,
			m::Result,
			m::ClientInfo,
			m::SessionID,
			m::ClientID,
			m::ItemID,
			m::ConnectionInfo,

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
			unsafe { // This is only ever going to run single-threaded so this is OK
				names.push(T::name());
			}
			format!("export {}", T::decl())
		}}
	};

	export(ExportTarget::Types, type_export);
	
	#[allow(non_upper_case_globals)] // Static is only used so that it can be modified in the export macro
	static mut methods: Vec<String> = Vec::new();

	let method_export = {
		use virtual_whiteboard::message::method::{Method, self as m};
		export_str!{[
			m::Connect,
			m::Reconnect,
			m::SelectionAddItems,
		] with T : Method => {
			unsafe { methods.push(T::name()) };
			format!(
				"\t{}: [{{{}}}, {}],",
				T::name(),
				T::ts_params(),
				T::ts_return(),
			)
		}}
	};

	export(ExportTarget::Methods, format!(
		r#"// @ts-ignore: Generated code
import {{ {} }} from "./Types";
export type Methods = {{
{}
}};

export const MethodNames: (keyof Methods)[] = [
	{}
];
"#,
		unsafe { names.join(", ") }, // Safe because single-threaded
		method_export,
		unsafe { &methods }
		.iter()
		.map(|s| format!(
			"\"{}\"", s
		))
		.join(", "),
	))
}