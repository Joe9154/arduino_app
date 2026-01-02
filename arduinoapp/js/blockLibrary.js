class BlockLibrary {

    addBlock(name, ...args) {
        if (name === "createStartBlock" && this.blocks.filter(b => b.title === "Start").length > 0) {
            console.error("Only one start block can be added!");
            return;
        }
        const func = this.blockTemplates.find(func => func.name === name);
        const block = func(...args);
        this.initBlock(block);
        return block;
    }

    initBlock(block) {
        this.blocks.push(block);
        const blockHTML = block.createHTMLElement();
        // we need to use insertAdjacentHTML because we want to insert the HTML string at the end of the container, and not replace it
        // replacing it invalidates stored HTMLElement references
        // (instead of container.innerHTML += this.generateHTMLString())
        document.querySelector(".container").insertAdjacentHTML("beforeend", blockHTML);
        block.storeReferences();
        block.makeDraggable();
        block.HTMLElement.querySelectorAll(".pin-circle").forEach(pinCircle => {
            pinCircle.addEventListener("mousedown", (event) => {
                event.stopPropagation();
                startWireDrag(event);
            });
        });
    }

    deleteBlock(blockUUID) {
        console.log("deleting block", blockUUID);
        const block = this.blocks.find(b => b.uuid === blockUUID);
        block.disconnectAllPins();
        this.blocks = this.blocks.filter(b => b !== block);
        getHTMLElementFromUUID(blockUUID).remove();
        redrawWires();
    }


    constructor() {
        this.blocks = [];
        this.pinModes = {};

        this.blockTemplates = [

            function createValueBlock(x = 0, y = 0, title = "Value", type = "text", value = "") {
                let valueBlock = new Block(title, x, y);
                let outputValuePin = new Pin(`Value`, "output", { typeOfElement: "inputField", type: type, values: [value], placeholder: "Value" });
                if (type === "number") outputValuePin.additionalElements[0].step = 1;
                valueBlock.addPin(outputValuePin);
                valueBlock.arduinoCode = () => `${outputValuePin.HTMLElement.parentElement.querySelector("input").value}`;
                return valueBlock;
            },

            function createTextValueBlock(x = 0, y = 0, value = "") {
                const createValueBlock = blockLibrary.blockTemplates.find(func => func.name === "createValueBlock");
                return createValueBlock(x, y, "Text Value", "text", value);
            },

            function createNumberValueBlock(x = 0, y = 0, value = 0) {
                const createValueBlock = blockLibrary.blockTemplates.find(func => func.name === "createValueBlock");
                return createValueBlock(x, y, "Number Value", "number", value);
            },



            function createDelayBlock(x = 0, y = 0, delay = 1000) {
                let delayBlock = new Block("Delay", x, y);
                let inputExecPin = new Pin("Execution", "input");
                let inputDelayPin = new Pin("Delay", "input", { typeOfElement: "inputField", type: "number", values: [delay], placeholder: "Delay", step: 1 });
                let outputExecPin = new Pin("Execution", "output");
                delayBlock.addPin(inputExecPin);
                delayBlock.addPin(inputDelayPin);
                delayBlock.addPin(outputExecPin);
                delayBlock.getPinDelayValue = () => inputDelayPin.HTMLElement.parentElement.querySelector("input").value;
                delayBlock.arduinoCode = () => {
                    if (inputDelayPin.connectedToBlock) {
                        const delayValue = inputDelayPin.connectedToBlock.arduinoCode().replace(/[^0-9]/g, '');
                        return `delay(${delayValue}); ${outputExecPin.connectedToBlock?.arduinoCode() ?? ""}`;
                    } else {
                        return `delay(${delayBlock.getPinDelayValue()}); ${outputExecPin.connectedToBlock?.arduinoCode() ?? ""}`;
                    };
                }
                return delayBlock;
            },

            function createPrintLineBlock(x = 0, y = 0) {
                let printLineBlock = new Block("Print Line", x, y);
                let inputExecPin = new Pin("Execution", "input");
                let inputValuePin = new Pin("Value", "input");
                let outputExecPin = new Pin("Execution", "output");
                let outputResultPin = new Pin("Result", "output");
                printLineBlock.addPin(inputExecPin);
                printLineBlock.addPin(inputValuePin);
                printLineBlock.addPin(outputExecPin);
                printLineBlock.addPin(outputResultPin);
                printLineBlock.arduinoCode = () => `Serial.println(${inputValuePin.connectedToBlock?.arduinoCode() ?? ""}); ${outputExecPin.connectedToBlock?.arduinoCode() ?? ""}`;
                return printLineBlock;
            },

            function createIfBlock(x = 0, y = 0) {
                let ifBlock = new Block("If", x, y);
                let inputExec = new Pin("Execution", "input");
                let inputCondition = new Pin("Condition", "input");
                let outputTrue = new Pin("True", "output");
                let outputFalse = new Pin("False", "output");
                ifBlock.addPin(inputExec);
                ifBlock.addPin(inputCondition);
                ifBlock.addPin(outputTrue);
                ifBlock.addPin(outputFalse);
                ifBlock.arduinoCode = () => "if (" + (inputCondition.connectedToBlock?.arduinoCode() ?? "") + ") {" +
                    (outputTrue.connectedToBlock?.arduinoCode() ?? "") +
                    "} else {" +
                    (outputFalse.connectedToBlock?.arduinoCode() ?? "") +
                    "}";
                return ifBlock;
            },

            function createStartBlock(x = 0, y = 0) {
                let startBlock = new Block("Start", x, y);
                let outputExec = new Pin("Execution", "output");
                startBlock.addPin(outputExec);
                startBlock.arduinoCode = () => {
                    const pinModes = Object.entries(blockLibrary.pinModes)
                        .map(([pin, mode]) => `pinMode(${pin}, ${mode});`);
                    return `void setup() {Serial.begin(9600); ${pinModes.join("\n")} ${outputExec.connectedToBlock?.arduinoCode() ?? ""}} void loop() {}`;
                };
                return startBlock;
            },

            function createDigitalWriteBlock(x = 0, y = 0, title = "Digital Write", pin = "13", value = 'HIGH') {
                let digitalWriteBlock = new Block(title, x, y);
                let inputExecPin = new Pin("Execution", "input");
                let inputPin = new Pin(`Pin`, "input", { typeOfElement: "inputField", type: "number", values: [pin], placeholder: "Pin", step: 1 });
                let inputValue = new Pin("Value", "input", { typeOfElement: "inputField", type: "dropdown", values: ['HIGH', 'LOW'], selectedValue: value, placeholder: "Value" });
                let outputExecPin = new Pin("Execution", "output");
                digitalWriteBlock.addPin(inputExecPin);
                digitalWriteBlock.addPin(inputPin);
                digitalWriteBlock.addPin(inputValue);
                digitalWriteBlock.addPin(outputExecPin);
                digitalWriteBlock.getPinNumberValue = () => inputPin.HTMLElement.parentElement.querySelector("input").value;
                digitalWriteBlock.getPinValue = () => inputValue.HTMLElement.parentElement.querySelector("select").value;
                digitalWriteBlock.arduinoCode = () => {
                    const pinNumber = inputPin.connectedToBlock?.arduinoCode().replace(/[^0-9]/g, '') ?? digitalWriteBlock.getPinNumberValue();
                    if (inputExecPin.connectedToBlock) {
                        blockLibrary.pinModes[pinNumber] = "OUTPUT";
                    }
                    return `digitalWrite(${pinNumber}, ${inputValue.connectedToBlock?.arduinoCode() ?? digitalWriteBlock.getPinValue() === 'HIGH' ? 'HIGH' : 'LOW'}); ${outputExecPin.connectedToBlock?.arduinoCode() ?? ""}`;
                };
                return digitalWriteBlock;
            },

            function createTurnOnPinBlock(x = 0, y = 0, pin = "13") {
                const createDigitalWriteBlock = blockLibrary.blockTemplates.find(func => func.name === "createDigitalWriteBlock");
                let turnOnPinBlock = createDigitalWriteBlock(x, y, "Turn On Pin", pin, "HIGH");
                turnOnPinBlock.title = "Turn On Pin";
                turnOnPinBlock.inputs[2].visible = false;
                return turnOnPinBlock;
            },

            function createTurnOffPinBlock(x = 0, y = 0, pin = "13") {
                const createDigitalWriteBlock = blockLibrary.blockTemplates.find(func => func.name === "createDigitalWriteBlock");
                let turnOffPinBlock = createDigitalWriteBlock(x, y, "Turn Off Pin", pin, "LOW");
                turnOffPinBlock.title = "Turn Off Pin";
                turnOffPinBlock.inputs[2].visible = false;
                return turnOffPinBlock;
            },

            function createCustomCodeBlock(x = 0, y = 0, code = "") {
                let customCodeBlock = new Block("Custom Code", x, y);
                let inputExecPin = new Pin("Execution", "input");
                let inputCodePin = new Pin("Code", "input", { typeOfElement: "inputField", type: "textarea", values: [code], placeholder: "Code" });
                let outputExecPin = new Pin("Execution", "output");
                customCodeBlock.addPin(inputExecPin);
                customCodeBlock.addPin(inputCodePin);
                customCodeBlock.addPin(outputExecPin);
                customCodeBlock.arduinoCode = () => {
                    return inputCodePin.connectedToBlock?.arduinoCode() ?? inputCodePin.HTMLElement.parentElement.querySelector("textarea").value;
                };
                return customCodeBlock;
            },

            function createGetValueBlock(x = 0, y = 0, pin = "0") {
                let pinNumber = pin.startsWith("A") ? parseInt(pin.replace(/[^0-9]/g, '')) + 14 : pin;
                let getValueBlock = new Block("Get Value", x, y);
                let inputPin = new Pin("Pin", "input", { typeOfElement: "inputField", type: "number", values: [pinNumber], placeholder: "Pin", step: 1 });
                let outputResult = new Pin("Result", "output");
                getValueBlock.addPin(inputPin);
                getValueBlock.addPin(outputResult);
                getValueBlock.getPinNumberValue = () => inputPin.HTMLElement.parentElement.querySelector("input").value;
                getValueBlock.arduinoCode = () => {
                    const pinNumber = inputPin.connectedToBlock?.arduinoCode().replace(/[^0-9]/g, '') ?? getValueBlock.getPinNumberValue();
                    if (pinNumber >= 14) {
                        return `analogRead(${pinNumber})`;
                    } else {
                        return `digitalRead(${pinNumber})`;
                    }
                };
                return getValueBlock;
            },

            function createWhileBlock(x = 0, y = 0, title = "While", condition = "") {
                let whileBlock = new Block(title, x, y);
                let inputExecPin = new Pin("Execution", "input");
                let inputConditionPin = new Pin("Condition", "input", { typeOfElement: "inputField", type: "text", values: [condition], placeholder: "Condition" });
                let inputBodyPin = new Pin("Body", "input");
                let outputExecPin = new Pin("Execution", "output");
                whileBlock.addPin(inputExecPin);
                whileBlock.addPin(inputConditionPin);
                whileBlock.addPin(inputBodyPin);
                whileBlock.addPin(outputExecPin);

                whileBlock.getConditionValue = () =>
                    inputConditionPin.connectedToBlock
                        ? inputConditionPin.connectedToBlock.arduinoCode()
                        : inputConditionPin.HTMLElement.parentElement.querySelector("input").value;

                whileBlock.arduinoCode = () => {
                    const condition = whileBlock.getConditionValue();
                    const bodyCode = inputBodyPin.connectedToBlock?.arduinoCode() ?? "";
                    // string might have trailing ';'; remove for body
                    let cleanedBody = bodyCode.trim().replace(/;$/, "");
                    // Only add semicolon for statements, not control structures (which end with })
                    let needsSemicolon = cleanedBody && !cleanedBody.endsWith("}");
                    let whileStatement = `while (${condition}) {\n${cleanedBody ? "  " + cleanedBody + (needsSemicolon ? ";" : "") : ""}\n}\n`;
                    // Append next block if connected on Execution output
                    return whileStatement + (outputExecPin.connectedToBlock?.arduinoCode() ?? "");
                };

                return whileBlock;
            },

            function createRepeatForeverBlock(x = 0, y = 0) {
                const createWhileBlock = blockLibrary.blockTemplates.find(func => func.name === "createWhileBlock");
                let repeatForeverBlock = createWhileBlock(x, y, "Repeat Forever", "1");
                repeatForeverBlock.inputs[1].visible = false;
                return repeatForeverBlock;
            },

            function createCompareBlock(x = 0, y = 0, operator = "==") {
                let compareBlock = new Block("Compare", x, y);
                let inputA = new Pin("A", "input");
                let inputB = new Pin("B", "input");
                let inputOperator = new Pin("", "input", { typeOfElement: "inputField", type: "dropdown", values: ['==', '!=', '>', '<', '>=', '<='], selectedValue: operator, placeholder: "Operator" });
                let outputResult = new Pin("Result", "output");
                compareBlock.addPin(inputA);
                compareBlock.addPin(inputOperator);
                compareBlock.addPin(inputB);
                compareBlock.addPin(outputResult);
                compareBlock.getOperatorValue = () => inputOperator.HTMLElement.parentElement.querySelector("select").value;
                compareBlock.arduinoCode = () => {
                    return `${inputA.connectedToBlock?.arduinoCode()} ${compareBlock.getOperatorValue() ?? operator} ${inputB.connectedToBlock?.arduinoCode()}`;
                };
                return compareBlock;
            }

        ];
    }





}