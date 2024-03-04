//! API routes for file uploads

use std::{
    io,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;
use warp::{
    filters::{
        multipart::{FormData, Part},
        BoxedFilter,
    },
    reply::Reply,
    Filter,
};

use crate::{utils::counter, GlobalRes};

/// Get a semi-unique ID for a file by combining the current time with an execution-unique value
///
/// The only way collisions could occur would be if multiple instances were running in parallel, which would already be a bad idea
fn get_file_id() -> String {
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("This code should not be running before the UNIX epoch")
        .as_micros();
    let count = counter!(AtomicUsize);
    format!("{time}-{count}")
}

async fn try_upload_part(target: &Path, mut part: Part) -> io::Result<String> {
    // Attempt to extract just a filename from the provided input
    let name = part
        .filename()
        .and_then(|n| Path::new(n).file_name())
        .ok_or_else(|| io::Error::other("Unable to extract filename"))?;

    let id = get_file_id();
    let mut path = target.join(&id);
    tokio::fs::create_dir_all(&path).await?;
    // The path returned to the client
    let resource_path = format!(
        "{id}/{}",
        name.to_str()
            .ok_or_else(|| io::Error::other("Unable to convert name to str"))?
    );
    path.push(name);

    let mut file = tokio::fs::File::create(&path).await?;
    while let Some(Ok(mut buf)) = part.data().await {
        file.write_all_buf(&mut buf).await?;
    }

    file.flush().await?;
    file.sync_all().await?;
    return Ok(resource_path);
}

/// Create a filter that receives files and stores them
pub fn create_upload_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    let target = &*res.config.media_root;
    let form_options = warp::multipart::form().max_length(1024 * 1024 * 64);
    warp::path("upload")
        .and(warp::post())
        .and(form_options)
        .and_then(move |mut form: FormData| async move {
            while let Some(Ok(part)) = form.next().await {
                if part.name() == "file" {
                    if let Ok(name) = try_upload_part(target, part).await {
                        return Ok(name);
                    }
                }
            }
            Err(warp::reject())
        })
        .boxed()
}

/// Create a filter for serving uploaded files
pub fn create_media_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    warp::fs::dir(res.config.media_root.to_owned()).boxed()
}
