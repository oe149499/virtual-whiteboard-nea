use clap::Parser;
use camino::Utf8PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short = 'r', long, default_value = ".")]
    board_root: Utf8PathBuf,
}

fn main() {
    let args = Args::parse();
    dbg!(args);
}
