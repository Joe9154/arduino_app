function getBlockFromElement(element) {
    const blockElement = element.closest(".block");
    if (!blockElement) return null;
    const blockUUID = blockElement.getAttribute("id").replace("block-", "");
    return blockLibrary.blocks.find(block => block.uuid === blockUUID);
}

function getHTMLElementFromUUID(uuid) {
    return document.getElementById(`block-${uuid}`) ?? document.getElementById(`pin-circle-${uuid}`);
}



class Block {
    constructor(title, x = 0, y = 0) {
        this.title = title;
        this.x = x;
        this.y = y;
        this.inputs = [];
        this.outputs = [];
        this.arduinoCode = null;
        this.uuid = crypto.randomUUID();
        this.HTMLElement = null;
    }

    addPin(pin) {
        if (pin.type === "input") {
            this.inputs.push(pin);
        } else if (pin.type === "output") {
            this.outputs.push(pin);
        }
        pin.Block = this;
    }

    createInputFieldHTML(additionalElement) {
        const placeholder = additionalElement.placeholder ?? '';
        const step = additionalElement.step ?? '';
        const selectedValue = additionalElement.selectedValue ?? '';
        const values = additionalElement.values ?? [];

        switch (additionalElement.type) {
            case "number":
                return `<input class="input-number" type="number" value="${values[0]}" placeholder="${placeholder}" step="${step}" />`;
            case "dropdown":
                let htmlString = `<select>`;
                values.forEach(value => {
                    htmlString += `<option value="${value}" ${selectedValue === value ? 'selected' : ''}>${value}</option>`;
                });
                htmlString += `</select>`;
                return htmlString;
            case "text":
                return `<input type="text" value="${values[0]}" placeholder="${placeholder}" />`;
            case "textarea":
                return `<textarea value="${values[0]}" placeholder="${placeholder}">${values[0]}</textarea>`;
        }
    }

    createPinHTML(pin, isOutput = false) {
        const inputFields = pin.additionalElements
            .filter(el => el.typeOfElement === "inputField")
            .map(el => this.createInputFieldHTML(el))
            .join("\n");

        const pinCircle = `<div class="pin-circle" id="pin-circle-${pin.uuid}"></div>`;

        return `
        <div class="input-output" style="display: ${pin.visible ? '' : 'none'};">
            ${isOutput ? inputFields : pinCircle}
            ${isOutput ? '' : inputFields}
            ${pin.title}
            ${isOutput ? pinCircle : ''}
        </div>
     `;
    }


    createHeaderHTML() {
        return `
        <div class="header">
            <span class="header-title">${this.title}</span>
            <span class="header-delete" onclick="blockLibrary.deleteBlock('${this.uuid}')">X</span>
        </div>
        `;
    }

    storeReferences() {
        this.HTMLElement = getHTMLElementFromUUID(this.uuid);
        this.inputs.forEach(input => {
            input.HTMLElement = getHTMLElementFromUUID(input.uuid);
        });
        this.outputs.forEach(output => {
            output.HTMLElement = getHTMLElementFromUUID(output.uuid);
        });
    }

    createHTMLElement() {
        const inputsHTML = this.inputs.map(input => this.createPinHTML(input)).join("\n");
        const outputsHTML = this.outputs.map(output => this.createPinHTML(output, true)).join("\n");
        return `
            <div class="block" id="block-${this.uuid}" style="top: ${this.y}px; left: ${this.x}px;">
                ${this.createHeaderHTML()}
                <div class="content">
                    <div class="inputs-outputs">
                        ${inputsHTML}
                    </div>
                    <div class="inputs-outputs">
                        ${outputsHTML}
                    </div>
                </div>
            </div>
        `;
    }

    makeDraggable() {
        this.HTMLElement.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
                e.stopPropagation();
                return;
            }
            // Store the block's current CSS position
            const initialLeft = parseFloat(this.HTMLElement.style.left) || 0;
            const initialTop = parseFloat(this.HTMLElement.style.top) || 0;

            // Store initial mouse position in canvas coordinates
            const initialMouseX = (e.clientX + window.scrollX) / zoomLevel;
            const initialMouseY = (e.clientY + window.scrollY) / zoomLevel;

            this.HTMLElement._onMouseMove = (e) => {
                // Current mouse position in canvas coordinates
                const mouseX = (e.clientX + window.scrollX) / zoomLevel;
                const mouseY = (e.clientY + window.scrollY) / zoomLevel;

                // Apply delta to initial position
                this.HTMLElement.style.left = (initialLeft + (mouseX - initialMouseX)) + "px";
                this.HTMLElement.style.top = (initialTop + (mouseY - initialMouseY)) + "px";
                redrawWires();
            };

            this.HTMLElement._onMouseUp = (e) => {
                document.removeEventListener("mousemove", this.HTMLElement._onMouseMove);
                document.removeEventListener("mouseup", this.HTMLElement._onMouseUp);
            };

            document.addEventListener("mousemove", this.HTMLElement._onMouseMove);
            document.addEventListener("mouseup", this.HTMLElement._onMouseUp);
        });
    }

    getPinByUUID(uuid) {
        return this.inputs.find(input => input.uuid === uuid) || this.outputs.find(output => output.uuid === uuid);
    }

    getPinFromElement(element) {
        if (!element.classList.contains("pin-circle")) return null;
        const uuid = element.getAttribute("id").replace("pin-circle-", "");
        return this.getPinByUUID(uuid);
    }

    disconnectAllPins() {
        this.inputs.forEach(input => input.connectedToPin && input.disconnectFrom(input.connectedToPin));
        this.outputs.forEach(output => output.connectedToPin && output.disconnectFrom(output.connectedToPin));
    }
}


class Pin {
    constructor(title, type, ...additionalElements) {
        this.title = title;
        this.type = type;
        this.additionalElements = additionalElements;
        this.Block = null;
        this.connectedToPin = null;
        this.connectedToBlock = null;
        this.uuid = crypto.randomUUID();
        this.HTMLElement = null;
        this.visible = true;
    }

    connectTo(pin) {
        if (this.connectedToPin) {
            this.connectedToPin.disconnectFrom(this);
        }
        this.connectedToPin = pin;
        pin.connectedToPin = this;
        this.connectedToBlock = pin.Block;
        pin.connectedToBlock = this.Block;
        this.HTMLElement?.classList.add("connected");
        pin.HTMLElement?.classList.add("connected");
    }

    disconnectFrom(pin) {
        this.connectedToPin = null;
        pin.connectedToPin = null;
        this.connectedToBlock = null;
        pin.connectedToBlock = null;
        this.HTMLElement?.classList.remove("connected");
        pin.HTMLElement?.classList.remove("connected");
    }
}





