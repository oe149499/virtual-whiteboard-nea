use camino::Utf8PathBuf;
use clap::Parser;
use itertools::Itertools;
use lazy_static::lazy_static;
use std::fs;
use ts_rs::TS;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]

struct Args {
    #[arg(short = 'o', long = "out-dir")]
    output_root: Utf8PathBuf,

    #[arg(short, long, default_value_t = false)]
    types: bool,

    #[arg(short, long, default_value_t = false)]
    methods: bool,

    #[arg(short = 'c', long = "notify-c", default_value_t = false)]
    notify_c: bool,

    #[arg(short, long, default_value_t = false)]
    dry_run: bool,
}

enum ExportTarget {
    Types,
    Methods,
    NotifyC,
}

impl ExportTarget {
    fn to_str(&self) -> &'static str {
        match self {
            Self::Types => "Types",
            Self::Methods => "Methods",
            Self::NotifyC => "NotifyC",
        }
    }

    fn is_enabled(&self) -> bool {
        match self {
            Self::Types => ARGS.types,
            Self::Methods => ARGS.methods,
            Self::NotifyC => ARGS.notify_c,
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

    let path = ARGS.output_root.join(format!("{}.ts", target.to_str()));

    if ARGS.dry_run {
        println!("======== BEGIN [{}] ========", path,);
        println!("{}", content);
        println!("======== END [{}] ========", path);
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
        use virtual_whiteboard::{canvas as c, canvas::item as i, message as m};
        export_str! {
            [
            //m::MsgRecv,
            //m::MsgSend,
            m::ErrorCode,
            m::Error,
            m::Result,
            m::ClientInfo,
            m::ConnectionInfo,
            m::SessionID,
            m::ClientID,
            m::ItemID,
            m::LocationUpdate,
            m::ItemsDeselected,
            m::BatchChanges,
            m::ClientTable,


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

    let names_import = format!(r#"import type {{ {} }} from "./Types";"#, unsafe {
        names.join(", ")
    });

    #[allow(non_upper_case_globals)] // Static is only used so that it can be modified in the export macro
    static mut methods: Vec<String> = Vec::new();

    let method_export = {
        use virtual_whiteboard::message::method::{self as m, Method};
        export_str! {[
            m::SelectionAddItems,
            m::GetAllClientInfo,
            m::CreateItem,
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

    export(
        ExportTarget::Methods,
        format!(
            r#"// @ts-ignore: Generated code
{}
export type Methods = {{
{}
}};

export const MethodNames: (keyof Methods)[] = [
	{}
];
"#,
            names_import, // Safe because single-threaded
            method_export,
            unsafe { &methods }
                .iter()
                .map(|s| format!("\"{}\"", s))
                .join(", "),
        ),
    );

    #[allow(non_upper_case_globals)] // Static is only used so that it can be modified in the export macro
    static mut notify_c_names: Vec<String> = Vec::new();

    let notify_c_export = {
        use virtual_whiteboard::message::notify_c as c;
        export_str!([
            c::ClientJoined,
            c::ClientConnected,
            c::ItemCreated,
        ] with T : TS => {
            let decl = T::decl();
            let params = decl.splitn(3, ' ').last().unwrap();
            unsafe { notify_c_names.push(T::name()) };
            format!(
                "\t{}: {},",
                T::name(),
                params,
            )
        })
    };

    export(
        ExportTarget::NotifyC,
        format!(
            r#"// @ts-ignore: Generated code
{}
export type NotifyCs = {{
{}
}};

export const NotifyCNames: (keyof NotifyCs)[] = [
	{}
]"#,
            names_import,
            notify_c_export,
            unsafe { &notify_c_names }
                .iter()
                .map(|s| format!("\"{s}\""))
                .join(", "),
        ),
    );
}
