#![cfg(feature = "codegen")]
use camino::Utf8PathBuf;
use clap::Parser;
use itertools::Itertools;
use lazy_static::lazy_static;
use std::fs;
use ts_rs::TS;
use virtual_whiteboard::message::{
    iterate::IterateSpec, method::MethodSpec, notify_c::NotifyCSpec,
};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]

struct Args {
    #[arg(short = 'o', long = "out-dir")]
    output_root: Utf8PathBuf,

    #[arg(short = 't', long, default_value_t = false)]
    types: bool,

    #[arg(short = 'm', long, default_value_t = false)]
    methods: bool,

    #[arg(short = 'c', long = "notify-c", default_value_t = false)]
    notify_c: bool,

    #[arg(short = 'i', long = "iterate", default_value_t = false)]
    iterate: bool,

    #[arg(short = 'd', long, default_value_t = false)]
    dry_run: bool,
}

enum ExportTarget {
    Types,
    Methods,
    NotifyC,
    Iterate,
}

impl ExportTarget {
    fn to_str(&self) -> &'static str {
        match self {
            Self::Types => "Types",
            Self::Methods => "Methods",
            Self::NotifyC => "NotifyC",
            Self::Iterate => "Iterate",
        }
    }

    fn is_enabled(&self) -> bool {
        match self {
            Self::Types => ARGS.types,
            Self::Methods => ARGS.methods,
            Self::NotifyC => ARGS.notify_c,
            Self::Iterate => ARGS.iterate,
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
            m::ErrorCode,
            m::Error,
            m::Result,
            m::ClientInfo,
            m::ConnectionInfo,
            m::SessionID,
            m::ClientID,
            m::ItemID,
            m::LocationUpdate,
            m::BatchChanges,


            c::Point,
            c::Color,
            c::Stroke,
            c::Angle,
            c::Transform,
            c::SplineNode,
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

    let method_export = {
        use virtual_whiteboard::message::method::*;
        export_str! {[
            SelectionAddItems,
            SelectionRemoveItems,
            EditBatchItems,
            EditSingleItem,
            DeleteItems,
            CreateItem,
            BeginPath,
            ContinuePath,
            EndPath,
            GetAllItemIDs,
            GetAllClientInfo,
        ] with T : TS => {
            T::decl()
        }}
    };

    export(
        ExportTarget::Methods,
        format!(
            r#"// @ts-ignore: Generated code
{names_import}

{}

export {}

export const MethodNames: (keyof MethodSpec)[] = [
	{}
];
"#,
            method_export,
            MethodSpec::decl(),
            MethodSpec::NAMES
                .iter()
                .map(|s| format!("\"{}\"", s))
                .join(", "),
        ),
    );

    let notify_c_export = {
        use virtual_whiteboard::message::notify_c::*;
        export_str!([
            ClientJoined,
            ClientConnected,
            ClientDisconnected,
            ClientExited,
            SelectionItemsAdded,
            SelectionItemsRemoved,
            SelectionMoved,
            BatchItemsEdited,
            SingleItemEdited,
            ItemsDeleted,
            ItemCreated,
            PathStarted,
        ] with T : TS => {
            T::decl()
        })
    };

    export(
        ExportTarget::NotifyC,
        format!(
            r#"// @ts-ignore: Generated code
{}

{}

export {}

export const NotifyCNames: (keyof NotifyCSpec)[] = [
	{}
]"#,
            names_import,
            notify_c_export,
            NotifyCSpec::decl(),
            NotifyCSpec::NAMES
                .iter()
                .map(|s| format!("\"{s}\""))
                .join(", ")
        ),
    );

    let iterate_export = {
        use virtual_whiteboard::message::iterate::*;
        export_str!([
            GetPartialItems,
            GetFullItems,
            GetActivePath,
            Count,
        ] with T : TS => {
            T::decl()
        })
    };

    export(
        ExportTarget::Iterate,
        format!(
            r#"// @ts-ignore: Generated code
{}

{}

export {}

export const IterateNames: (keyof IterateSpec)[] = [
    {}
]"#,
            names_import,
            iterate_export,
            IterateSpec::decl(),
            IterateSpec::NAMES
                .iter()
                .map(|n| format!("\"{n}\""))
                .join(", "),
        ),
    )
}
