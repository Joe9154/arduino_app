function screenToSVGCoords(screenX, screenY) {
    const rect = mainSVG.getBoundingClientRect();
    return {
        x: (screenX - rect.left) / zoomLevel,
        y: (screenY - rect.top) / zoomLevel
    };
}

function startWireDrag(event) {
    const wirePath = createWirePathElement();
    const startCoordinates = screenToSVGCoords(event.clientX, event.clientY);

    const startX = startCoordinates.x;
    const startY = startCoordinates.y;
    const startBlock = getBlockFromElement(event.target);
    const startPin = startBlock.getPinFromElement(event.target);

    if (startPin.connectedToPin) {
        startPin.disconnectFrom(startPin.connectedToPin);
        redrawWires();
    }

    wirePath._onMouseMove = (event) => {
        const endCoordinates = screenToSVGCoords(event.clientX, event.clientY);
        const endX = endCoordinates.x;
        const endY = endCoordinates.y;
        const control1X = (startX + endX) / 2;
        const control1Y = startY;
        const control2X = (startX + endX) / 2;
        const control2Y = endY;
        wirePath.setAttribute("d", `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`);
    };

    wirePath._onMouseUp = (event) => {
        document.removeEventListener("mousemove", wirePath._onMouseMove);
        document.removeEventListener("mouseup", wirePath._onMouseUp);
        wirePath.remove();
        tryToConnectPins(event, startPin);
    };

    document.addEventListener("mousemove", wirePath._onMouseMove);
    document.addEventListener("mouseup", wirePath._onMouseUp);
}


function tryToConnectPins(event, startPin) {
    const endBlock = getBlockFromElement(event.target);
    if (!endBlock) return;

    const endPin = endBlock.getPinFromElement(event.target);
    if (!endPin) return;

    // if (startPin.type === endPin.type) {
    //     console.log("cannot connect pins of the same type");
    //     return;
    // }
    if (startPin.Block === endPin.Block) {
        console.log("cannot connect pins that are in the same block");
        return;
    }
    if (endPin.connectedToPin) {
        endPin.connectedToPin.disconnectFrom(endPin);
    }

    startPin.connectTo(endPin);
    console.log("connected pins", startPin, endPin);
    redrawWires();
}



// TODO Potential future optimization: only redraw wires between the startPin and endPin (right now we redraw all wires between all blocks)
function redrawWires() {
    const wirePaths = document.querySelectorAll(".wire-path");

    wirePaths.forEach(wirePath => {
        wirePath.remove();
    });

    for (const block of blockLibrary.blocks) {
        // since every input can only be connected to one output, we can just loop through the inputs 
        for (const input of block.inputs) {
            if (input.connectedToPin) {
                const startPinElement = input.connectedToPin.HTMLElement;
                const endPinElement = input.HTMLElement;

                const startRect = startPinElement.getBoundingClientRect();
                const endRect = endPinElement.getBoundingClientRect();

                const startCoords = screenToSVGCoords(startRect.left + startRect.width / 2, startRect.top + startRect.height / 2);
                const endCoords = screenToSVGCoords(endRect.left + endRect.width / 2, endRect.top + endRect.height / 2);

                // get center of both pin elements
                const startPinX = startCoords.x;
                const startPinY = startCoords.y;
                const endPinX = endCoords.x;
                const endPinY = endCoords.y;

                const control1X = (startPinX + endPinX) / 2;
                const control1Y = startPinY;
                const control2X = (startPinX + endPinX) / 2;
                const control2Y = endPinY;

                const wirePathElement = createWirePathElement();
                wirePathElement.setAttribute("d", `M ${startPinX} ${startPinY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endPinX} ${endPinY}`);
                wirePathElement.addEventListener("mouseover", () => {
                    startPinElement.style.border = "2px solid black";
                    endPinElement.style.border = "2px solid black";
                });
                wirePathElement.addEventListener("mouseout", () => {
                    startPinElement.style.border = "1px solid #000";
                    endPinElement.style.border = "1px solid #000";
                });

            }
        }
    }
}

function createWirePathElement(){
    const wirePathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wirePathElement.setAttribute("class", "wire-path");
    wirePathElement.setAttribute("stroke", "black");
    wirePathElement.setAttribute("stroke-width", "2");
    wirePathElement.setAttribute("fill", "none");
    wirePathElement.setAttribute("stroke-linecap", "round");
    wirePathElement.setAttribute("d", "")
    mainSVG.appendChild(wirePathElement);
    return wirePathElement;
  }