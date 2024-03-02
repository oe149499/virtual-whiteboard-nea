Interactions between the server and the client can be divided into three categories:
- Method - The client wishes to perform some action or fetch some data and receive the response immediately
- Iterate - The client wishes to receive some data which is either too large to send in one message or not immediately available
- Notify-C - The server has an event to relay to clients
- Reject - A client has submitted an invalid request such as editing a non-existent item
	- This could either be sent as a warning or require the request to be cancelled

The first two cases require some system to match replies to requests, which can be implemented by having the client include some unique ID in each request, which is included in response packet(s). The other information needed, alongside the request parameters, is the kind of request and the name of the target.

This can be expressed in the following format:

```json
{
	"protocol": "Method",
	"name": "DoAThing",
	"id": 123,
	"param": "thing",
}
{
	"protocol": "Iterate",
	"name": "Count",
	"id": 27,
	"countTo": 4,
},
```

Which would lead to a response looking like:

```json
{
	"protocol": "Response-Part",
	"id": 27,
	"complete": false,
	"part": 0,
	"items": [0, 1]
}
{
	"protocol": "Response",
	"id": 123,
	"thing": "value"
}
{
	"protocol": "Response-Part",
	"id": 27,
	"complete": true,
	"part": 2,
	"items": [4]
}
{
	"protocol": "Response-Part",
	"id": 27,
	"complete": false,
	"part": 1,
	"items": [2, 3]
}
```

The other cases are simpler, simply consisting of messages of the form:

```json
{
	"protocol": "Notify-C",
	"name": "Hello",
	"param": "arg",
	// ...
}
{
	"protocol": "Reject",
	"requestProtocol": "Method",
	"requestId": 12,
	"level": "Warning",
	"reason": "..."
}
{
	"protocol": "Reject",
	"requestProtocol": "Iterate",
	"requestId": 127,
	"level": "Error",
	"reason": "..."
}
```
