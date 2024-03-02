The website will need to serve the following components:
- API interfaces
	- Session creation
	- Connecting to a session
	- Uploading files
	- Other misc. information
- Uploaded files
- Static files (HTML, CSS, icons, etc.)
- Compiled JavaScript files
	- During development, the original TypeScript source should also be served to assist with debugging

The following layout will therefore be used:

```
/index.html - alias of /static/index.html
/static/... - maps directly to static files on filesystem
/media/... - Maps to media storage location in program config
/script/... - output JS files
/script/source/... - Original TS files, can be disabled in configuration
[POST] /api/board/<name>/ - open a new session on the specified board
[WS] /api/session/<ID>/ - connect to an opened session
[POST] /api/upload/ - Upload a media file
/api/start_time/ - Get the time the server was launched
```
