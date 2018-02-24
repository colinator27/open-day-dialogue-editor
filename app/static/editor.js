const { ipcRenderer } = require('electron');

// Easy way to store very simple data for an item
class SimpleItemData { 
    constructor(fullName, type){
        this.fullName = fullName;
        this.type = type;
    }
    get key(){
        return Symbol.for(`pairKey[${this.fullName}:${this.type}]`);
    }
}

// Start the editor, configure
var editor = ace.edit("editor");
editor.setTheme("ace/theme/opendaydialogue");
editor.getSession().setMode("ace/mode/opendaydialogue");
editor.getSession().setUseWrapMode(true);
editor.setFontSize(12);
editor.setShowPrintMargin(false);

// When text is updated by user, update the content in the project
editor.on("change", function(e) {
    if(editor.curOp && editor.curOp.command.name) {
        let name = $(mostRecentSelected).children('p').get(0).innerHTML;
        let type = $(mostRecentSelected).parent('div').parent('ol').children('p').get(0).innerHTML;
        let namespace;
        if(type != "Scripts")
            namespace = $(mostRecentSelected).children('h3').get(0).innerHTML;
        ipcRenderer.sendSync('sync-update-item-text', { name: name, type: type, namespace: namespace, text: editor.getValue()});
        changesMade();
    }
});

// Add the command for resetting the font size in the code editor
editor.commands.addCommands([
    {
        name: "resetFontSize",
        bindKey: {
            win: "Ctrl+0|Ctrl-Numpad0",
            mac: "Command+0|Command-Numpad0"
        },
        exec: editor => {
            resetZoom();
        }
    }
]);

// Makes the editor visible, clears selection
function showEditor(){
    editor.clearSelection();
    document.querySelector(".editor-container").setAttribute('style', '');
}

// Hides the editor from view
function hideEditor(){
    document.querySelector(".editor-container").setAttribute('style', 'display:none;');
}

// Update the code editor's header
function updateHeader(){
    // Get the cursor and selection data
    let cursor = editor.getCursorPosition();
    let text = editor.getSelectedText();
    
    // If there is a selection, add that text to the header
    let selected = "";
    if (text.length != 0)
        selected = ` (${text.length} chars selected)`;

    // Update the element
    document.querySelector(".editor-header-pos").innerHTML = `Line ${cursor.row + 1}, Col ${cursor.column + 1}${selected}`; 
}

// On cursor movement and selection changes, update the header 
editor.selection.on("changeCursor", () => {
    updateHeader();
});
editor.selection.on("changeSelection", () => {
    updateHeader();
});

// When an item is clicked, update the code editor
let lastUndoKey;
function itemClick(targ){
    // Get the name and type
    let name = $(targ).children('p').get(0).innerText;
    let type = $(targ).parent('div').parent('ol').children('p').get(0).innerText;

    // Get the namespace, which doesn't apply to scripts
    let namespace;
    if(type != "Scripts")
        namespace = $(targ).children('h3').get(0).innerText;

    // Get the undo key
    let undoKey = new SimpleItemData((namespace && namespace != "") ? (namespace + "." + name) : name, type).key;
    if(undoKey != lastUndoKey)
        lastUndoKey = undoKey;

    // Set the namespace text if it applies
    if (namespace && namespace != "")
        document.querySelector(".editor-header-current-namespace").innerText = namespace + ".";
    else
        document.querySelector(".editor-header-current-namespace").innerText = "";

    // Set the name text
    document.querySelector(".editor-header-current-name").innerText = name;
    
    // Setting it to null seems to actually work, instead of creating a new one? Not sure.
    editor.getSession().setUndoManager(null);

    // Update the text editor's code contents, reset cursor position
    editor.setValue(ipcRenderer.sendSync('sync-get-item-text', { name: name, namespace: namespace, type: type }), -1);

    // Make the editor visible
    showEditor();
};

function nodeSelected(ev){
    // Set the target node for later use
    mostRecentSelected = ev.currentTarget;

    // Run the event for this item click (opens code editor)
    itemClick(ev.currentTarget);
}

function nodeUnselected(){
    // If there is no other item selected, hide the editor when unselected
    if($('.ui_selected').length == 0)
        hideEditor();
}

var mostRecentSelected = undefined;
var mostRecentContext = undefined;
var jqueryBoundYet = false;
function jqCallbacks(){
    // Make the tree items draggable
    $("#list > ol > div").sortable({
        filter: ' > li',
        scroll: true,
        scrollSensitivity: 100,
        axis: "y",
        cursor: "move",
        tolerance: "pointer",
        start: function(ev, ui) {
            $("#list > ol > div").addClass("sorting");
        },
        stop: function(ev, ui){
            $("#list > ol > div").removeClass("sorting");

            // Update the tree's order in the project
            let type = $(ev.target).parent('ol').children('p').get(0).innerText;

            // Put the order of elements into an array, by name
            let newOrder = [];
            $(ev.target).children('li').each((index, item) => {
                if(type == "Scripts"){
                    newOrder.push($(item).children('p').get(0).innerText);
                } else {
                    let namespace = $(item).children('h3').get(0).innerText;
                    let name = $(item).children('p').get(0).innerText;
                    let final = (namespace != "" ? (namespace + "." + name) : name);
                    newOrder.push(final);
                }
            });

            // Push the new order to the core
            ipcRenderer.sendSync('sync-tree-reorder', { type: type, order: newOrder });

            // New unsaved changes
            changesMade();
        }
    });

    // Make the tree items selectable
    $("#list").selectable({ 
        filter: ' > ol > div > li',
        unselected: (ev, ui) => { 
            nodeUnselected();
        }
    });

    $("#list").on("click", " > ol > div > li", function (e) {
        if (!e.metaKey) {
            $("#list > ol > div > li").removeClass("ui-selected");
            $(this).addClass("ui-selected");
            nodeSelected(e);
        } else {
            if ($(this).hasClass("ui-selected")) {
                $(this).removeClass("ui-selected");
            } else {
                $(this).addClass("ui-selected");
                nodeSelected(e);
            }
        }
    });

    // Allow the tree items to have context menus
    $('#list > ol > div > li').contextmenu((evt) => {
        // Get the name and type
        let name = $(evt.currentTarget).children('p').get(0).innerText;
        let type = $(evt.currentTarget).parent('div').parent('ol').children('p').get(0).innerText;

        // If it's not a script, get the namespace
        let namespace;
        if(type != "Scripts")
            namespace = $(evt.currentTarget).children('h3').get(0).innerText;

        // Set the target node for later use (if the item is deleted, edited, etc.)
        mostRecentContext = $(evt.currentTarget).get(0);

        // Open the context menu
        ipcRenderer.send('async-list-node-context', { name: name, namespace: namespace, type: type });
    });
    
    jqueryBoundYet = true;
}

function unbindJQuery(){
    if(!jqueryBoundYet)
        return;
    $("#list").selectable('destroy');
    $("#list > ol > div").sortable('destroy');
    $('#list > ol > div > li').unbind('contextmenu');
    $('#list > ol > div > li').remove();
}

// Once the document is ready, initialize the JQuery callbacks, setup button events etc.
$(document).ready(function() {
    jqCallbacks();
    document.querySelector("#zoom-in").addEventListener("click", zoomIn);
    document.querySelector("#zoom-out").addEventListener("click", zoomOut);
    document.querySelector("#zoom-reset").addEventListener("click", resetZoom);
});

// Zoom the editor in and out
function zoomIn(){
    var size = parseInt(editor.getFontSize(), 10) || 12;
    editor.setFontSize(size + 2);
}
function zoomOut(){
    var size = parseInt(editor.getFontSize(), 10) || 12;
    editor.setFontSize(Math.max(size - 2 || 1));
}
function resetZoom(){
    editor.setFontSize(12);
}

ipcRenderer.on('async-editor-zoom-in', (ev, arg) => {
    if(!editor.isFocused())
        return;
    zoomIn();
})
ipcRenderer.on('async-editor-zoom-out', (ev, arg) => {
    if(!editor.isFocused())
        return;
    zoomOut();
});

// When a project is newly-loaded
let loaded = false;
ipcRenderer.on('async-project-loaded', (ev, arg) => {
    // Update elements in the tree
    updateTree(JSON.parse(arg.currProject));
    hideEditor();
    lastUndoKey = undefined;

    if(loaded)
        return;

    // First time load, perform special actions (making project editor visible, removing no open project message, etc.)
    loaded = true;
    document.querySelector("#no-project").remove();
    document.querySelector("#list").removeAttribute('style');
});

// Whenever the project's tree gets updated
ipcRenderer.on('async-update-tree', (ev, arg) => {
    hideEditor();
    lastUndoKey = undefined;
    updateTree(JSON.parse(arg.currProject));
})

// Delete the latest context menu node
ipcRenderer.on('async-item-deleted', (event, arg) => {
    if($(mostRecentContext).hasClass("ui-selected"))
        nodeUnselected();

    // Remove element
    mostRecentContext.remove();
});

function updateTree(proj){
    // Unbind JQuery events
    unbindJQuery();

    // Create new scene elements
    let sceneGroup = $('.list-group > p').filter(':contains("Scenes")').parent().children('div').get(0);
    for(var s in proj.scenes){
        if(!proj.scenes.hasOwnProperty(s)) continue;
        var scene = proj.scenes[s];

        // Construct an element
        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = scene.name;
        let h3 = document.createElement("h3");
        h3.innerText = scene.namespace;
        li.appendChild(p);
        li.appendChild(h3);
        sceneGroup.appendChild(li);
    }

    // Create new definition group elements
    let defGroups = $('.list-group > p').filter(':contains("Definition Groups")').parent().children('div').get(0);
    for(var d in proj.definitionGroups){
        if(!proj.definitionGroups.hasOwnProperty(d)) continue;
        var group = proj.definitionGroups[d];

        // Construct an element
        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = group.name;
        let h3 = document.createElement("h3");
        h3.innerText = group.namespace;
        li.appendChild(p);
        li.appendChild(h3);
        defGroups.appendChild(li);
    }

    // Create new script elements
    let scriptGroup = $('.list-group > p').filter(':contains("Scripts")').parent().children('div').get(0);
    proj.scripts.forEach(script => {
        // Construct an element
        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = script.name;
        li.appendChild(p);
        scriptGroup.appendChild(li);
    });

    // Initialize new JQuery events for the new elements
    jqCallbacks();
}

// When changes are made, notify the main program
function changesMade(){
    ipcRenderer.sendSync("sync-changes-made", {});
}