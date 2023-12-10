use std::path::PathBuf;
use clap::Parser;
use camino::Utf8PathBuf;
use flexi_logger::Logger;
use log::{info, error};
use tokio::runtime;
use virtual_whiteboard::{create_api_filter, create_static_filter, create_script_filter};
use warp::{Filter, filters::BoxedFilter, reply::Reply};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short = 'r', long, default_value = ".")]
    board_root: Utf8PathBuf,

    #[arg(short = 's', long = "static-root")]
    static_path: Utf8PathBuf,

    #[arg(short = 'j', long = "script-root")]
    script_root: Utf8PathBuf,

    #[arg(long, default_value_t = true)]
    serve_ts: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _logger = Logger::try_with_env()?
        //.write_mode(WriteMode::Async)
        .start()?;

    let args = Args::parse();


    info!("Program Startup");

    let filter = create_filter(
        args.static_path.into(),
        args.script_root.into(),
        args.serve_ts,
    );

    info!("Building runtime");

    let runtime = runtime::Builder::new_multi_thread()
        .enable_io()
        .enable_time()
        .worker_threads(2)
        .build().map_err(|e| {
            error!("Failed to build Tokio runtime: {}", &e);
            e
        })?;
    
    info!("Successfully constructed Tokio runtime");

    runtime.block_on(async move {
        info!("Starting server");
        warp::serve(filter).bind(([0, 0, 0, 0], 8080)).await
    });

    Ok(())
}

fn create_filter(static_path: PathBuf, script_path: PathBuf, enable_source: bool) -> BoxedFilter<(impl Reply,)> {
    info!("Building filters");
    let index_filter = warp::path("index.html").and(warp::fs::file(static_path.join("index.html")));
    let api_filter = warp::path("api").and(create_api_filter());
    let static_filter = warp::path("static").and(create_static_filter(static_path));
    let script_filter = warp::path("script").and(create_script_filter(script_path, enable_source));
    return api_filter.or(static_filter).or(index_filter).or(script_filter).boxed()
}