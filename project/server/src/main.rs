use std::time::Duration;

use camino::Utf8PathBuf;
use clap::Parser;
use flexi_logger::Logger;
use log::{error, info};
use tokio::runtime;
use virtual_whiteboard::{
    board::BoardManager, create_api_filter, create_media_filter, create_script_filter,
    create_static_filter, ConfigurationBuilder, GlobalRes, GlobalResources,
};
use warp::{filters::BoxedFilter, reply::Reply, Filter};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    // #[arg(short = 'r', long, default_value = ".")]
    // board_root: Utf8PathBuf,
    #[arg(short = 's', long = "static-root")]
    static_path: Utf8PathBuf,

    #[arg(short = 'j', long = "script-root")]
    script_root: Utf8PathBuf,

    #[arg(short = 'm', long = "media-root")]
    media_root: Utf8PathBuf,

    #[arg(short = 'b', long = "board-root")]
    board_root: Utf8PathBuf,

    #[arg(long, default_value_t = true)]
    serve_ts: bool,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _logger = Logger::try_with_env()?
        //.write_mode(WriteMode::Async)
        .start()?;

    let args = Args::parse();

    let config = ConfigurationBuilder::default()
        .static_root(args.static_path.into())
        .script_root(args.script_root.into())
        .media_root(args.media_root.into())
        .board_root(args.board_root.clone().into())
        .serve_ts(args.serve_ts)
        .build()
        .unwrap();

    info!("Program Startup");

    info!("Building runtime");

    let runtime = runtime::Builder::new_multi_thread()
        .enable_io()
        .enable_time()
        .worker_threads(2)
        .build()
        .map_err(|e| {
            error!("Failed to build Tokio runtime: {}", &e);
            e
        })?;

    info!("Successfully constructed Tokio runtime");

    runtime.block_on(async move {
        info!("Loading boards");
        // The board manager should stay alive for the lifetime of the program
        let boards = BoardManager::new_debug(&args.board_root.as_std_path());

        let res = GlobalResources::new(boards, config).as_static();

        tokio::task::spawn(async {
            loop {
                info!("Beginning autosave");
                let current_task = tokio::task::spawn(res.boards.autosave());

                tokio::time::sleep(Duration::from_secs(10)).await;

                current_task.await.unwrap_or_else(|e| {
                    error!("Autosave task panicked: {e}");
                });
            }
        });

        let filter = create_filter(res);

        info!("Starting server");
        warp::serve(filter).bind(([0, 0, 0, 0], 8080)).await
    });

    Ok(())
}

fn create_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    info!("Building filters");
    let index_filter =
        warp::path("index.html").and(warp::fs::file(res.config.static_root.join("index.html")));
    let api_filter = warp::path("api").and(create_api_filter(res));
    let static_filter = warp::path("static").and(create_static_filter(res));
    let script_filter = warp::path("script").and(create_script_filter(res));
    let media_filter = warp::path("media").and(create_media_filter(res));

    return api_filter
        .or(static_filter)
        .or(index_filter)
        .or(script_filter)
        .or(media_filter)
        .boxed();
}
