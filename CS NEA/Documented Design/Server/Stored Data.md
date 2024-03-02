## Media files
Media files are saved in the following format to avoid potential clashes:

`<path>/<t>-<n>/<f>`

The segments are as follows:
- `<path>` - storage location as configured when starting the server, not exposed in any way to clients
- `<t>` - timestamp when the file is uploaded
- `<n>` - Number of uploads performed by the current execution of the program, to prevent clashes from simultaneous uploads
- `<f>` - Original name provided by client

This is then served to clients at `/media/<t>-<n>/<f>`

## Board files
Board files are stored in the following JSON format:
```json
{
	"items": [
		{
			"type": "Line"
			// ...
		}
		// ...
	],
	"readonly": true
	// ...
}
```

This is then stored in the location `<path>/<name>.json`, where `<path>` is a part of the program configuration and `<name>` is the board name.

To load boards, the program simply scans all files in the `<path/` directory on startup.

An additional measure is needed when saving boards to ensure integrity - if the program were to be interrupted while writing to a file then the state could be left in an incomplete state. The standard solution for this is to write to a temporary file, and then rename it over the primary file, as on Linux this is guaranteed to a fully atomic operation (see https://man7.org/linux/man-pages/man2/rename.2.html). The Rust standard library also attempts to provide this behaviour where possible (see https://doc.rust-lang.org/std/fs/fn.rename.html).

As such the program writes data to `<path>/<name>.json.swp` before moving it over the previous file.