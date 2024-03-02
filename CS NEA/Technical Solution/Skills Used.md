# Data structures
| Structure | Location |
| ---- | ---- |
| Asynchronous Queue | Used in several places:<br>(server) client.rs<br>(server) board/active.rs<br>(client) canvas/Canvas.ts<br>Custom implementation in TypeScript:<br>(client) util/Channel.ts |
| Object-oriented mechanism for automatically propagating change of state | Implemented in:<br>(client) util/State.ts<br>Used throughout most of client |
# Algorithms
| Algorithm | Location |
| ---- | ---- |
| Dynamic generation of objects based on the OOP model | Dynamically choosing a class based on item type<br>(client) canvas/items/ItemBuilder.ts<br>Instantiating property UI classes<br>(client) ui/PropertyEditor.ts |
| Server-side scripting with request and response objects to service a complex client-server model | Used throughout most of the server but particularly (server) client.rs |
| Calling parameterised Web service APIs and parsing JSON to service a complex client-server model | (client) client/HttpApi.ts<br>(client) client/RawClient.ts<br>(server) client.rs to some extent |
# Other techniques
| Technique | Location | Description |
| ---- | ---- | ---- |
| Writing to a temporary file to prevent data loss | (server) board/file.rs | Writing to a temporary file and renaming it over the main file ensures that the saved data is never in an incomplete state |
| Automatically generating bindings for other languages | (server) codegen.rs<br>type definitions in message/\* | To ensure consistency between the client and server code, TypeScript definitions are generated directly from Rust source code |
