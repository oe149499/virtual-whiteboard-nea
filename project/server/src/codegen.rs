#![cfg(feature = "codegen")]
use camino::Utf8PathBuf;
use clap::Parser;
use itertools::Itertools;
use lazy_static::lazy_static;
use std::{format, fs, string::String};
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

fn make_spec_export<Spec: TS>(type_imports: &str, exports: String, names: Vec<String>) -> String {
    let spec_name = Spec::name();
    let spec_export = Spec::decl();
    let names_str = names.iter().map(|s| format!("\"{s}\"")).join(", ");
    format!(
        r#"
// @ts-ignore this is generated code
{type_imports}

{exports}

export {spec_export}

export const {spec_name}Names: (keyof {spec_name})[] = {{
    {names_str}
}};
"#
    )
}

macro_rules! export_scanner {
    ( [
        $($type:ty,)*
    ] with $param:ident => $func:expr) => {{
        fn scan<$param: TS>() -> String {$func}

        let mut items = Vec::new();

        let str_data = [$(
            {
                items.push(<$type>::name());
                scan::<$type>()
            }
        ),*].join("\n");

        (str_data, items)
    }}
}

fn main() {
    let (type_export, names) = {
        use virtual_whiteboard::{
            canvas as c, canvas::item as i, message as m, message::reject as r,
        };
        export_scanner! {
                [
                m::ErrorCode,
                m::Error,
                m::Result,
                m::ClientInfo,
                m::ClientState,
                m::ConnectionInfo,
                m::SessionID,
                m::ClientID,
                m::ItemID,
                m::PathID,
                m::LocationUpdate,
                m::BatchChanges,
                r::RejectLevel,
                r::RejectMessage,
                r::RejectReason,

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
            ] with T =>format!("export {}", T::decl())
        }
    };

    export(ExportTarget::Types, type_export);

    let names_import = format!(r#"import type {{ {} }} from "./Types";"#, names.join(", "));

    let (method_export, method_names) = {
        use virtual_whiteboard::message::method::*;
        export_scanner! {[
            SelectionAddItems,
            SelectionRemoveItems,
            SelectionMove,
            EditBatchItems,
            EditSingleItem,
            DeleteItems,
            CreateItem,
            BeginPath,
            ContinuePath,
            EndPath,
            GetAllItemIDs,
            GetAllClientIDs,
            GetClientState,
        ] with T => T::decl()}
    };

    export(
        ExportTarget::Methods,
        make_spec_export::<MethodSpec>(&names_import, method_export, method_names),
    );

    let (notify_c_export, notify_c_names) = {
        use virtual_whiteboard::message::notify_c::*;
        export_scanner!([
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
        ] with T => T::decl())
    };

    export(
        ExportTarget::NotifyC,
        make_spec_export::<NotifyCSpec>(&names_import, notify_c_export, notify_c_names),
    );

    let (iterate_export, iterate_names) = {
        use virtual_whiteboard::message::iterate::*;
        export_scanner!([
            GetPartialItems,
            GetFullItems,
            GetActivePath,
        ] with T => T::decl())
    };

    export(
        ExportTarget::Iterate,
        make_spec_export::<IterateSpec>(&names_import, iterate_export, iterate_names),
    );
}
