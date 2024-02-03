//! API routes for file uploads

use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use futures_util::StreamExt;
use log::debug;
use tokio::io::AsyncWriteExt;
use warp::{
    filters::{multipart::FormData, BoxedFilter},
    reply::Reply,
    Filter,
};

use crate::GlobalRes;

/// Create a filter that receives files and stores them
pub fn create_upload_filter(res: GlobalRes) -> BoxedFilter<(impl Reply,)> {
    let target = &*Box::leak(Box::new(res.config.media_root.to_owned()));
    warp::path("upload")
        .and(warp::post())
        .and(warp::multipart::form())
        .and_then(move |mut form: FormData| async move {
            while let Some(Ok(mut part)) = form.next().await {
                debug!(
                    "{}, {:?}, {:?}",
                    part.name(),
                    part.content_type(),
                    part.filename()
                );
                if part.name() == "file" {
                    let Some(name) = part.filename() else {
                        debug!("no filename");
                        continue;
                    };
                    let Some(name) = Path::new(name).file_name() else {
                        debug!("no resolved filename");
                        continue;
                    };
                    let name = name.to_owned();
                    let time = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
                    let id = format!("{}-{}", time.as_millis(), crate::counter!(AtomicU32));
                    let mut path = target.join(&id);
                    let _ = tokio::fs::create_dir_all(&path).await;
                    path.push(&name);
                    debug!("{path:?}");
                    let Ok(mut file) = tokio::fs::File::create(&path).await else {
                        debug!("failed to open path");
                        continue;
                    };
                    while let Some(Ok(mut buf)) = part.data().await {
                        let _ = file.write_all_buf(&mut buf).await;
                    }
                    let _ = file.flush().await;
                    let _ = file.sync_all().await;
                    return Ok(format!("{id}/{}", name.to_str().unwrap()));
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
