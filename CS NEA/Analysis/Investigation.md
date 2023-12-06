I decided to build a web app for my project as:
- The system can be used on a variety of devices without needing to build it separately for each one
- Synchronisation between devices already requires some form of networking so I would be using a web server anyway

For the frontend, I have therefore decided to use HTML5+CSS+TypeScript, as HTML+CSS are standard, and TS provides many advantages over plain JS.

For the backend, I will be using Rust with the [Warp](https://docs.rs/warp) web server and [Tokio](https://docs.rs/tokio) runtime as I found these to work well together for other projects.

# Communication
In previous projects I have used either a custom system or the [`serde_json`](https://docs.rs/serde_json) library for serialisation. However, both of these have the issue that parsing and generating messages client-side is error-prone and/or requires repeating the structure of types used in messages. To avoid this, I found [`ts-rs`](https://docs.rs/ts-rs), a Rust library that enables generation of TS type declarations from Rust types, which combined with `serde_json` should enable a seamless programming experience.

# Rendering
In an earlier prototype I used the Canvas API to render the board, however this required manual rendering from basic shapes, and so I plan to use SVG to render the board.