use std::path::PathBuf;
use clap::Parser;
use camino::Utf8PathBuf;
use tokio::runtime;
use virtual_whiteboard::{create_api_filter, create_static_filter};
use warp::{Filter, filters::BoxedFilter, reply::Reply};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short = 'r', long, default_value = ".")]
    board_root: Utf8PathBuf,

    #[arg(short, long = "static")]
    static_path: Utf8PathBuf,
}

fn main() {
    let args = Args::parse();
    let filter = create_filter(
        args.static_path.into(),
    );
    let runtime = runtime::Builder::new_multi_thread()
        .enable_io()
        .enable_time()
        .worker_threads(2)
        .build().expect("Failed to build Tokio runtime");

    runtime.block_on(async move {
        warp::serve(filter).bind(([0, 0, 0, 0], 8080)).await
    })
}

fn create_filter(static_path: PathBuf) -> BoxedFilter<(impl Reply,)> {
    let api_filter = warp::path("api").and(create_api_filter());
    let static_filter = warp::path("static").and(create_static_filter(static_path));
    return api_filter.or(static_filter).boxed()
}