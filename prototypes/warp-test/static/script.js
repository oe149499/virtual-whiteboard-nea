const container = document.querySelector("#grid-container");
function createButton(x, y) {
	let button = document.createElement("button");
	button.className = "grid-button";
	button.style = `grid-row: ${x+1}; grid-column: ${y+1}`
	button.onclick = () => {buttonPress(x, y);};
	container.appendChild(button);
	return button;
}

buttons = {}
function btnId(x, y) {
	return `(${x} ${y})`;
}
function getBtn(x,y) {
	return buttons[btnId(x,y)];
}
function setBtn(x,y,v) {
	buttons[btnId(x,y)] = v;
}

for (let x=0; x<10; x++) {
	for (let y=0; y<10; y++) {
		setBtn(x, y, createButton(x,y));
	}
}

function buttonPress(x, y) {
	let cls = getBtn(x,y).classList;
	if (cls.contains("active")) {
		cls.remove("active");
		ws.send(`INACTIVE ${btnId(x,y)}`);
	}
	else {
		cls.add("active");
		ws.send(`ACTIVE ${btnId(x,y)}`);
	}
}





const ws = new WebSocket(`ws://${window.location.host}/ws`);
ws.addEventListener("message", (event) => {
	let dataSplit = event.data.split(/ (.*)/s);
	let cmd = dataSplit[0];
	let param = dataSplit[1];
	switch (cmd) {
		case "ACTIVE":
			buttons[param].classList.add("active");
			break;
		case "INACTIVE":
			buttons[param].classList.remove("active");
			break;
	}
});
