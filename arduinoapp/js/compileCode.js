async function fetchHexData(code) {
    const response = await fetch("http://localhost:8001/api/compile/", {
        method: "POST",
        body: JSON.stringify({ "arduino_code": code }),
        headers: {
            "Content-Type": "application/json"
        }
    })
    const data = await response.json();
    return data.hex_data;
}

async function compileCode(justPrint = false) {
    const startBlock = blockLibrary.blocks.find(b => b.title === "Start");
    if (!startBlock) {
      console.error("Start block not found");
      return;
    }
    startBlock.arduinoCode(); // need to call this twice to set pinMode()'s
    const code = startBlock.arduinoCode();
    const indentedCode = indentArduinoCode(code);
    console.log(indentedCode);
    if (justPrint) {
      return;
    }
    console.log("Compiling code...");
    compiledCode = await fetchHexData(indentedCode);
    console.log(compiledCode);
    console.log("Code compiled");
  }


  function indentArduinoCode(code) {
    // AI generated
    // First, normalize the code by adding newlines
    // Use a placeholder for } else { to preserve it as a unit
    const placeholder = "___ELSE___";
    let normalized = code
        .replace(/\}\s*else\s*\{/g, placeholder)  // Preserve } else { as unit
        .replace(/\{/g, "{\n")
        .replace(/\}/g, "\n}\n")
        .replace(placeholder, "\n} else {\n")  // Restore } else { with newlines
        .replace(/;/g, ";\n")
        .replace(/\n\s*\n+/g, "\n") // Remove multiple consecutive newlines
        .trim();
    
    const lines = normalized.split("\n");
    let indentLevel = 0;
    const indentSize = 2;
    
    return lines.map(line => {
        const trimmed = line.trim();
        if (trimmed === "") return "";
        
        let currentIndent = indentLevel;
        
        // Handle } else { - should be at same level as the if statement
        if (trimmed === "} else {") {
            // Decrease indent for the closing }, then apply at that level
            indentLevel = Math.max(0, indentLevel - 1);
            currentIndent = indentLevel;
            // Increase indent for content after the opening {
            indentLevel++;
        } else if (trimmed === "}") {
            // Decrease indent before closing brace
            indentLevel = Math.max(0, indentLevel - 1);
            currentIndent = indentLevel;
        } else if (trimmed.endsWith("{") && !trimmed.startsWith("}")) {
            // Increase indent after opening brace
            currentIndent = indentLevel;
            indentLevel++;
        }
        
        // Add current indent to line
        return " ".repeat(currentIndent * indentSize) + trimmed;
    }).filter(line => line !== "").join("\n");
}