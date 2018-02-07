var editor = ace.edit("editor");
editor.setTheme("ace/theme/opendaydialogue");
editor.session.setMode("ace/mode/opendaydialogue");
editor.session.setUseWrapMode(true);
editor.setShowPrintMargin(false);
editor.on("change", function(e) {
    if(editor.curOp && editor.curOp.command.name) {
        let name = $(mostRecentSelected).children('p').get(0).innerHTML;
        let type = $(mostRecentSelected).parent('ol').children('p').get(0).innerHTML;
        let namespace;
        if(type != "Scripts")
            namespace = $(mostRecentSelected).children('h3').get(0).innerHTML;
        ipcRenderer.sendSync('sync-update-item-text', { name: name, type: type, namespace: namespace, text: editor.getValue()});
        changesMade();
    }
});

function updateHeader(){
    let cursor = editor.getCursorPosition();
    let text = editor.getSelectedText();
    let selected = "";
    if (text.length != 0)
        selected = ` (${text.length} chars selected)`;
    document.querySelector(".editor-header-pos").innerText = `Line ${cursor.row + 1}, Col ${cursor.column + 1}${selected}`; 
}

editor.selection.on("changeCursor", () => {
    updateHeader();
});
editor.selection.on("changeSelection", () => {
    updateHeader();
});

function itemClick(targ){
    let name = $(targ).children('p').get(0).innerHTML;
    let type = $(targ).parent('ol').children('p').get(0).innerHTML;
    let namespace;
    if(type != "Scripts")
        namespace = $(targ).children('h3').get(0).innerHTML;
    if (namespace && namespace != "")
        document.querySelector(".editor-header-current-namespace").innerText = namespace + ".";
    else
        document.querySelector(".editor-header-current-namespace").innerText = "";
    document.querySelector(".editor-header-current-name").innerText = name;
    editor.setValue(ipcRenderer.sendSync('sync-get-item-text', { name: name, namespace: namespace, type: type }), -1);
    showEditor();
};

var mostRecentSelected = undefined;
var mostRecentContext = undefined;
function jqCallbacks(){
    $("#list").selectable({ 
        filter: ' > ol > li:not(:has(p:contains("Create new...")))',
        selected: (ev, ui) => {
            mostRecentSelected = ui.selected;
            itemClick(ui.selected);
        },
        unselected: (ev, ui) => {
            if($('.ui_selected').length == 0)
                hideEditor();
        }
    });
    $('#list > ol > li:not(:has(p:contains("Create new...")))').contextmenu((evt) => {
        let name = $(evt.currentTarget).children('p').get(0).innerHTML;
        let type = $(evt.currentTarget).parent('ol').children('p').get(0).innerHTML;
        let namespace;
        if(type != "Scripts")
            namespace = $(evt.currentTarget).children('h3').get(0).innerHTML;
        mostRecentContext = $(evt.currentTarget).get(0);
        ipcRenderer.send('async-list-node-context', { name: name, namespace: namespace, type: type });
    });
}
$(document).ready(function() {
    jqCallbacks();
});

const { ipcRenderer } = require('electron');

ipcRenderer.on('async-editor-zoom-in', (ev, arg) => {
    if(!editor.isFocused())
        return;
    var size = parseInt(editor.getFontSize(), 10) || 18;
    editor.setFontSize(size + 2);
})
ipcRenderer.on('async-editor-zoom-out', (ev, arg) => {
    if(!editor.isFocused())
        return;
    var size = parseInt(editor.getFontSize(), 10) || 18;
    editor.setFontSize(Math.max(size - 2 || 1));
});
let loaded = false;
ipcRenderer.on('async-project-loaded', (ev, arg) => {
    // Update elements for any new load
    updateTree(arg.currProject);

    // First time load
    if(loaded)
        return;
    loaded = true;
    document.querySelector("#no-project").remove();
    document.querySelector("#list").removeAttribute('style');
});
ipcRenderer.on('async-update-tree', (ev, arg) => {
    updateTree(arg.currProject);
})

ipcRenderer.on('async-item-deleted', (event, arg) => {
    mostRecentContext.remove();
});

editor.commands.addCommands([
    {
        name: "resetFontSize",
        bindKey: {
            win: "Ctrl+0|Ctrl-Numpad0",
            mac: "Command+0|Command-Numpad0"
        },
        exec: editor => {
            editor.setFontSize(18);
        }
    }
]);

function showEditor(){
    editor.clearSelection();
    document.querySelector(".editor-container").setAttribute('style', '');
}

function hideEditor(){
    document.querySelector(".editor-container").setAttribute('style', 'display:none;');
}

function updateTree(proj){
    $("#list").selectable('destroy');
    $('#list > ol > li:not(:has(p:contains("Create new...")))').unbind('contextmenu');
    $('#list > ol > li:not(:has(p:contains("Create new...")))').remove();

    let sceneGroup = $('.list-group > p').filter(':contains("Scenes")').parent().get(0);
    //let sceneAddButton = $('.list-group > p').filter(':contains("Scenes")').parent().children('li').get(0);
    for(var s in proj.scenes){
        if(!proj.scenes.hasOwnProperty(s)) continue;
        var scene = proj.scenes[s];

        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = scene.name;
        let h3 = document.createElement("h3");
        h3.innerText = scene.namespace;
        li.appendChild(p);
        li.appendChild(h3);
        //sceneGroup.insertBefore(li, sceneAddButton);
        sceneGroup.appendChild(li);
    }

    let defGroups = $('.list-group > p').filter(':contains("Definition Groups")').parent().get(0);
    //let defGroupAddButton = $('.list-group > p').filter(':contains("Definition Groups")').parent().children('li').get(0);
    for(var d in proj.definitionGroups){
        if(!proj.definitionGroups.hasOwnProperty(d)) continue;
        var group = proj.definitionGroups[d];

        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = group.name;
        let h3 = document.createElement("h3");
        h3.innerText = group.namespace;
        li.appendChild(p);
        li.appendChild(h3);
        //defGroups.insertBefore(li, defGroupAddButton);
        defGroups.appendChild(li);
    }

    let scriptGroup = $('.list-group > p').filter(':contains("Scripts")').parent().get(0);
    //let scriptAddButton = $('.list-group > p').filter(':contains("Scripts")').parent().children('li').get(0);
    proj.scripts.forEach(script => {
        let li = document.createElement("li");
        li.setAttribute('class', 'list-node');
        let p = document.createElement("p");
        p.innerText = script.name;
        li.appendChild(p);
        //scriptGroup.insertBefore(li, scriptAddButton);
        scriptGroup.appendChild(li);
    });

    jqCallbacks();
}

function changesMade(){
    ipcRenderer.sendSync("sync-changes-made", {});
}