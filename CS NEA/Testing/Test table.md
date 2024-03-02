| Test | Expected Result | Actual Result |
| ---- | ---- | ---- |
| Run the server and open the page in a web browser on device A | {1.1} The board should span the whole web page<br>{1.2, 1.3, 1.5} The Tool and View panels should be present<br>{1.4.5} The Properties panel should be disabled |  |
| Select the "Path" tool | {1.4, 3.2.5} The properties panel should appear with a "Stroke" property group |  |
| Change the "Stroke/Width" property to 0.2 and draw a scribble on the canvas | {3.2.5} A path should be drawn along the cursor movement<br>{5.2.2.3} The path item will be selected<br>{1.4.1} The properties of the path should be available |  |
| Change the "Stroke/Colour" property to green | {1.4.1} The changes should be reflected on the board |  |
| Deselect the item and select the "Line" tool | {3.2.3} The stroke property of the tool should be available |  |
| Change the "Stroke/Colour" property to red and draw a line | {2.2.2.1} Line items should work |  |
| Deselect the item and select the "Polygon" tool |  |  |
| Change the "Fill" property to blue |  |  |
| Input some presses and some drags to verify that a new point is created at the end of each mouse action |  |  |
| Click on the start point |  |  |
| Deselect the item and select the "Image" tool |  |  |
| Click the "Select a file" (or equivalent) button in the property and select an image with the system dialogue |  |  |
| Click on the canvas |  |  |
| Move and scale the image |  |  |
| Deselect the item and select the "Text" tool |  |  |
| Click on the canvas |  |  |
| Type into the "Text" property, including multiple lines |  |  |
| Type several combinations of the following sequences:<br>\*text\*<br>\_text\_<br>\~text\~<br>\*\*text\*\* |  |  |
| Deselect the text and select the "Link" tool |  |  |
| Click on the canvas and enter a URL into the "URL" property |  |  |
| Enter a description into the "Link Text" property |  |  |
| Deselect the item and select the "Rectangle" tool |  |  |
| Set the "Width", "Height" and "Stroke" properties |  |  |
| Click on the canvas |  |  |
| Deselect the item and repeat with the "Ellipse" tool |  |  |
| Deselect the item and select the "Selection" tool |  |  |
| Select the path item created earlier |  |  |
| Open the page in a web browser on device B |  |  |
| (A) Edit the stroke of the path item |  |  |
| (A) Add the polygon item to the selection |  |  |
| (B) Attempt to select the polygon item |  |  |
| (A) Move the selection around and edit some of the properties |  |  |
| (A) Deselect the items |  |  |
| (B) Select the items and drag them around |  |  |
| (B) Refresh the page |  |  |
| (A) Select a different item and move it around |  |  |
| (B) Continue moving the previously selected items |  |  |
| Restart the server and refresh both devices |  |  |
|  |  |  |
