function initContextMenu() {
    blockLibrary.blockTemplates.forEach(createBlockFunction => {
        const shortName = createBlockFunction.name.replace("create", "").replace("Block", "");
        addContextMenuItem(shortName, createBlockFunction);
    });
    mainSVG.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showContextMenu(event);
    });
    document.addEventListener("click", (event) => {
        if (contextMenuOpened && !contextMenuElement.contains(event.target)) {
            hideContextMenu();
        }
    });
}

function showContextMenu(event) {
    contextMenuElement.style.display = "block";
    contextMenuElement.style.top = event.clientY + "px";
    contextMenuElement.style.left = event.clientX + "px";
    contextMenuOpened = true;
}

function hideContextMenu() {
    if (contextMenuElement) {
        contextMenuElement.style.display = "none";
        contextMenuOpened = false;
    }
}

function addContextMenuItem(text, createBlockFunction) {
    const item = document.createElement("div");
    item.className = "context-menu-item";
    item.textContent = text;
    item.addEventListener("click", (event) => {
        event.stopPropagation();
        blockLibrary.addBlock(createBlockFunction.name, event.clientX-100, event.clientY-25);
        hideContextMenu();
    });
    contextMenuElement.appendChild(item);
}   
