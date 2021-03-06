const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');

const {app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut} = electron;

// Different electron window handles
let mainWindow, mainWindowMenu;
let newProjectWindow, newItemWindow, projectInfoWindow, editWindow;

// The filename of the current project file
let currentProjectFilename = undefined;

// The current project data
let currentProject = undefined;

// Whether or not the project had been modified since the last save
let madeAnyChanges = false;

// Whether or not to use modal windows
let useModal = (process.platform != 'darwin');

// Whether or not the window can be interacted with (used primarily on non-Windows platform)
let mainWindowIgnore = false;

// Makes the window ignore mouse events if necessary, primarily on a non-Windows platform
BrowserWindow.prototype.setClickInteraction = function(ignore){
    if(!useModal){
        this.setIgnoreMouseEvents(ignore);
    }
    mainWindowIgnore = ignore;
}

// When called, indicates that the project has been modified since the last save
function changesMade(){
    madeAnyChanges = true;
    mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}*`);
}

function getRootDir(){
    // Convert to .asar path for builds
    return require('app-root-path').toString() + "/app";
}

// Verifies that the project is not corrupt
function verifyProjectIntegrity(proj, special = false /* one-case scenario, typically for early deserialization */){
    // Check that the base fields exist
    if (proj.name == undefined || proj.author == undefined || proj.info == undefined || !proj.scenes || !proj.definitionGroups || !proj.scripts)
        return false;

    if(!special){
        // Check scenes
        if(proj.scenes === null || typeof proj.scenes !== 'object')
            return false;
        for(var s in proj.scenes){
            if(!proj.scenes.hasOwnProperty(s)) continue;
            let scene = proj.scenes[s];
            if (!scene.name || scene.namespace == undefined || scene.text == undefined)
                return false;
        }

        // Check defintion groups
        if(proj.definitionGroups === null || typeof proj.definitionGroups !== 'object')
            return false;
        for(var d in proj.definitionGroups){
            if(!proj.definitionGroups.hasOwnProperty(d)) continue;
            let group = proj.definitionGroups[d];
            if (!group.name || group.namespace == undefined || group.text == undefined)
                return false;
        }
    }

    // Check scripts
    if (!Array.isArray(proj.scripts))
        return false;
    proj.scripts.forEach(script => {
        if (!script.name || script.text == undefined)
            return false;
    });

    return true;
}

// Properly serializes the JSON, in order
function getProjectJSON(){
    let out = Object.assign({}, currentProject);

    // Convert scenes to array
    out.scenes = [];
    for(var s in currentProject.scenes){
        if(!currentProject.scenes.hasOwnProperty(s)) continue;
        let scene = currentProject.scenes[s];
        out.scenes.push({ key: s, name: scene.name, namespace: scene.namespace, text: scene.text });
    }

    // Convert def groups to array
    out.definitionGroups = [];
    for(var d in currentProject.definitionGroups){
        if(!currentProject.definitionGroups.hasOwnProperty(d)) continue;
        let group = currentProject.definitionGroups[d];
        out.definitionGroups.push({ key: d, name: group.name, namespace: group.namespace, text: group.text });
    }

    return JSON.stringify(out, null, 1);
}

// Properly de-serializes the JSON, in order
function makeProjectFromJSON(json){
    let raw;
    try {
        raw = JSON.parse(json);
    } catch (e){
        return {};
    }
    if(!verifyProjectIntegrity(raw, true))
        return {};
    let out = Object.assign({}, raw);

    // Convert scene array to an object
    out.scenes = {};
    for(let i = 0; i < raw.scenes.length; i++){
        if (raw.scenes[i].key == undefined || raw.scenes[i].name == undefined || raw.scenes[i].namespace == undefined || raw.scenes[i].text == undefined)
            return {};
        out.scenes[raw.scenes[i].key] = { name: raw.scenes[i].name, namespace: raw.scenes[i].namespace, text: raw.scenes[i].text };
    }

    // Convert def group array to an object
    out.definitionGroups = {};
    for(let i = 0; i < raw.definitionGroups.length; i++){
        if (raw.definitionGroups[i].key == undefined || raw.definitionGroups[i].name == undefined || raw.definitionGroups[i].namespace == undefined || raw.definitionGroups[i].text == undefined)
            return {};
        out.definitionGroups[raw.definitionGroups[i].key] = { name: raw.definitionGroups[i].name, namespace: raw.definitionGroups[i].namespace, text: raw.definitionGroups[i].text };
    }

    return out;
}

// Checks if an item exists in the current project with a full name/key
function doesItemExist(fullName){
    for(var s in currentProject.scenes){
        if(!currentProject.scenes.hasOwnProperty(s)) continue;
        if(s == fullName)
            return true;
    }
    for(var d in currentProject.definitionGroups){
        if(!currentProject.definitionGroups.hasOwnProperty(d)) continue;
        if(d == fullName)
            return true;
    }
    return false;
}

function alertBoxItemExists(){
    dialog.showMessageBox(newItemWindow, { title: 'Improper fields', type: 'error', message: 'An item with that name in that namespace already exists.' }, (number, checked) => {});
}

function updateProjectTree(){
    mainWindow.webContents.send('async-update-tree', { currProject: JSON.stringify(currentProject) });
}

// Create a new project
ipcMain.on('sync-new-project', (event, arg) => {
    // Initialize a blank project object
    currentProject = {
        name: arg.name,
        author: arg.author,
        info: arg.info,
        scenes: {},
        definitionGroups: {},
        scripts: []
    };
    currentProjectFilename = undefined;

    // Enable menus, change title, hide new project window
    enableProjectMenus();
    newProjectWindow.close();

    // Note this next line is kind of useless but we'll keep it here
    mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
    
    // Update the tree, etc.
    mainWindow.webContents.send('async-project-loaded', { currProject: JSON.stringify(currentProject) });

    // There are new unsaved changes
    changesMade();

    event.returnValue = 0;
});

// Returns the full name for a project tree item, dealing with namespaces
function itemFullName(arg){
    return (arg.namespace != null && arg.namespace != "") ? (arg.namespace + "." + arg.name) : arg.name;
}

// Create a new scene
ipcMain.on('sync-new-scene', (event, arg) => {
    // Confirm that the item doesn't already exist
    if(doesItemExist(itemFullName(arg))){
        alertBoxItemExists();
        event.returnValue = 1;
        return;
    }

    // Create a new scene with default content
    currentProject.scenes[itemFullName(arg)] = { name: arg.name, namespace: arg.namespace, text: "// Enter your scene here" };
    
    updateProjectTree();
    changesMade();

    newItemWindow.close();
    event.returnValue = 0;
});

// Create a new definition group
ipcMain.on('sync-new-defgroup', (event, arg) => {
    // Confirm that the item doesn't already exist
    if(doesItemExist(itemFullName(arg))){
        alertBoxItemExists();
        event.returnValue = 1;
        return;
    }

    // Create a new definition group with default content
    currentProject.definitionGroups[itemFullName(arg)] = { name: arg.name, namespace: arg.namespace, text: "// Enter your definitions here" };
    
    // Update the project tree
    updateProjectTree();
    changesMade();
    newItemWindow.close();
    event.returnValue = 0;
});

// Create a new script
ipcMain.on('sync-new-script', (event, arg) => {
    // Duplicate names don't matter, because the script names are never used

    // Create a new script with default content
    currentProject.scripts.push({ name: arg.name, text: "// Enter your script here" });
    
    updateProjectTree();
    changesMade();

    newItemWindow.close();
    event.returnValue = 0;
});

// When updating the project info
ipcMain.on('sync-update-project-info', (event, arg) => {
    // Update each field
    currentProject.name = arg.name;
    currentProject.author = arg.author;
    currentProject.info = arg.info;

    changesMade();

    projectInfoWindow.close();
    event.returnValue = 0;
});

let editLastNode = undefined;
ipcMain.on('sync-item-edit', (event, arg) => {
    editWindow.close();
    if(editLastNode.type == "Scenes"){
        // Get the old and new keys 
        let old_key = itemFullName(editLastNode);
        let new_key = itemFullName(arg);

        // Figure out the order
        let scenes_old = Object.assign({}, currentProject.scenes);
        let i = 0;
        let insert_index = -1;
        for(var s in currentProject.scenes){
            if(!currentProject.scenes.hasOwnProperty(s)) continue;
            if(s == old_key)
                insert_index = i;
            i++;
        }

        // Move the property
        currentProject.scenes = {};
        i = 0;
        for (var s in scenes_old){
            if(!scenes_old.hasOwnProperty(s)) continue;
            if(i == insert_index){
                // Configure the new property
                currentProject.scenes[new_key] = scenes_old[old_key];
                currentProject.scenes[new_key].name = arg.name;
                currentProject.scenes[new_key].namespace = arg.namespace;
            } else {
                // Copy the old property over
                currentProject.scenes[s] = scenes_old[s];
            }
            i++;
        }
    } else if(editLastNode.type == "Definition Groups"){
        // Get the old and new keys 
        let old_key = itemFullName(editLastNode);
        let new_key = itemFullName(arg);

        // Figure out the order
        let defgroups_old = Object.assign({}, currentProject.definitionGroups);
        let i = 0;
        let insert_index = -1;
        for(var s in currentProject.definitionGroups){
            if(!currentProject.definitionGroups.hasOwnProperty(s)) continue;
            if(s == old_key)
                insert_index = i;
            i++;
        }

        // Move the property
        currentProject.definitionGroups = {};
        i = 0;
        for (var s in defgroups_old){
            if(!defgroups_old.hasOwnProperty(s)) continue;
            if(i == insert_index){
                // Configure the new property
                currentProject.definitionGroups[new_key] = defgroups_old[old_key];
                currentProject.definitionGroups[new_key].name = arg.name;
                currentProject.definitionGroups[new_key].namespace = arg.namespace;
            } else {
                // Copy the old property over
                currentProject.definitionGroups[s] = defgroups_old[s];
            }
            i++;
        }
    } else if(editLastNode.type == "Scripts"){
        for(let i = 0; i < currentProject.scripts.length; i++){
            if(currentProject.scripts[i].name == editLastNode.name){
                currentProject.scripts[i].name = arg.name;
            }
        }
    }
    updateProjectTree();
    changesMade();
});

// Context menu when (right) clicking on item in tree
ipcMain.on('async-list-node-context', (event, arg) => {
    let m = Menu.buildFromTemplate([
        {
            label: 'Edit',
            click(){
                editLastNode = arg;
                editWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, title: 'Edit item', show: false, width: 600, height: 200, resizable: false });
                mainWindow.setClickInteraction(true);
                editWindow.on('closed', () => {
                    editWindow = undefined;
                    mainWindow.setClickInteraction(false);
                });
                editWindow.webContents.once('dom-ready', () => {
                    editWindow.show();
                    editWindow.webContents.send('data', { name: arg.name, namespace: arg.namespace });
                });
                editWindow.loadURL(url.format({
                    pathname: path.join(getRootDir(), '/static/edit.html'),
                    protocol: 'file:',
                    slashes: true
                }));
                editWindow.setMenu(null);
                m.closePopup();
            }
        },
        {
            label: 'Delete',
            click(){
                let fullname = itemFullName(arg);
                mainWindow.setClickInteraction(true);
                dialog.showMessageBox(mainWindow, { title: 'Delete item?', type: 'warning', defaultId: 1, buttons: ['Yes', 'No'], message: `Are you sure you want to delete item "${fullname}" permanently?` }, (number, checked) => {
                    mainWindow.setClickInteraction(false);
                    if (number == 0){
                        if(arg.type == "Scenes"){
                            delete currentProject.scenes[itemFullName(arg)];
                        } else if(arg.type == "Definition Groups"){
                            delete currentProject.definitionGroups[itemFullName(arg)];
                        } else if(arg.type == "Scripts"){
                            for(let i = 0; i < currentProject.scripts.length; i++){
                                if(currentProject.scripts[i].name == arg.name){
                                    currentProject.scripts.splice(i, 1);
                                    break;
                                }
                            }
                        }
                        changesMade();
                        mainWindow.webContents.send('async-item-deleted', arg);
                    }
                });
                m.closePopup();
            }
        }
    ]);
    m.popup();
});

// Called when the project tree's order has been changed.
// Makes the order of the tree in the memory-held
// project instance become what is desired.
ipcMain.on('sync-tree-reorder', (event, arg) => {
    if(arg.type == "Scenes"){
        let oldItems = currentProject.scenes;
        let newItems = {};
        for(let i = 0; i < arg.order.length; i++){
            newItems[arg.order[i]] = oldItems[arg.order[i]];
        }
        currentProject.scenes = newItems;
    } else if(arg.type == "Definition Groups"){
        let oldItems = currentProject.definitionGroups;
        let newItems = {};
        for(let i = 0; i < arg.order.length; i++){
            newItems[arg.order[i]] = oldItems[arg.order[i]];
        }
        currentProject.definitionGroups = newItems;
    } else if(arg.type == "Scripts"){
        let oldItems = {};
        for(let i = 0; i < currentProject.scripts.length; i++){
            oldItems[currentProject.scripts[i].name] = currentProject.scripts[i];
        }
        let newItems = [];
        for(let i = 0; i < arg.order.length; i++){
            newItems[i] = oldItems[arg.order[i]];
        }
        currentProject.scripts = newItems;
    }
    event.returnValue = 0;
});

// Called when new unsaved changes are made
ipcMain.on('sync-changes-made', (event, arg) => {
    changesMade();
    event.returnValue = 0;
});

// Displays an error about blank fields
ipcMain.on('sync-bad-fields-0', (event, arg) => {

    const msg = 'All necessary fields must be filled!';
    const title = 'Improper fields';

    if(newProjectWindow != undefined && newProjectWindow.isVisible()){
        newProjectWindow.setClickInteraction(true);
        dialog.showMessageBox(newProjectWindow, { title: title, type: 'error', message: msg + '\nName and author must be given.' }, (number, checked) => {
            newProjectWindow.setClickInteraction(false);
        });
    } else if(editWindow != undefined && editWindow.isVisible()){
        editWindow.setClickInteraction(true);
        dialog.showMessageBox(editWindow, { title: title, type: 'error', message: msg }, (number, checked) => {
            editWindow.setClickInteraction(false);
        });
    } else if(projectInfoWindow != undefined && projectInfoWindow.isVisible()){
        projectInfoWindow.setClickInteraction(true);
        dialog.showMessageBox(projectInfoWindow, { title: title, type: 'error', message: msg }, (number, checked) => {
            projectInfoWindow.setClickInteraction(false);
        });
    } else {
        newItemWindow.setClickInteraction(true);
        dialog.showMessageBox(newItemWindow, { title: title, type: 'error', message: msg }, (number, checked) => {
            newItemWindow.setClickInteraction(false);
        });
    }
    event.returnValue = 0;
});

// Displays an error of invalid characters used in a name/identifier
ipcMain.on('sync-bad-fields-1', (event, arg) => {
    mainWindow.setClickInteraction(true);

    const msg = 'Invalid identifier!\n\nOnly "A-z", "0-9", "_", "@", and "." characters can be used in names.\nThey must start with "A-z", "@", or "_".\n"@" can only be placed at the beginning, and is used to allow keywords.\nKeywords without a prepended "@" are not allowed.';
    const title = 'Improper fields';

    if (editWindow != undefined && editWindow.isVisible()){
        dialog.showMessageBox(editWindow, { title: title, type: 'error', message: msg }, (number, checked) => {
            mainWindow.setClickInteraction(false);
        });
    } else {
        dialog.showMessageBox(newItemWindow, { title: title, type: 'error', message: msg }, (number, checked) => {
            mainWindow.setClickInteraction(false);
        });
    }
    event.returnValue = 0;
});

// Gets the text content of an item
// Used to display text on the text editor
ipcMain.on('sync-get-item-text', (event, arg) => {
    let txt = "// An error occurred when getting the content of the item.";
    if(arg.type == "Scenes"){
        txt = currentProject.scenes[itemFullName(arg)].text;
    } else if(arg.type == "Definition Groups"){
        txt = currentProject.definitionGroups[itemFullName(arg)].text;
    } else if(arg.type == "Scripts"){
        currentProject.scripts.forEach(s => {
            if(s.name == arg.name)
                txt = s.text;
        })
    }
    event.returnValue = txt;
});

// Updates the text content of an item (in the project data/memory)
ipcMain.on('sync-update-item-text', (event, arg) => {
    if(arg.type == "Scenes"){
        currentProject.scenes[itemFullName(arg)].text = arg.text;
    } else if(arg.type == "Definition Groups"){
        currentProject.definitionGroups[itemFullName(arg)].text = arg.text;
    } else if(arg.type == "Scripts"){
        for (var index in currentProject.scripts){
            if(currentProject.scripts[index].name == arg.name){
                currentProject.scripts[index].text = arg.text;
                break;
            }
        }
    }
    event.returnValue = 0;
});

// Returns project info data
ipcMain.on('async-get-project-info', (event, arg) => {
    event.sender.send('async-get-project-info-response', { name: currentProject.name, author: currentProject.author, info: currentProject.info });
});

// Enables certain application menu options once a project is loaded
function enableProjectMenus(){
    // Could use loops, but this could technically be more efficient
    mainWindowMenu.items[0].submenu.items[3].enabled = true;
    mainWindowMenu.items[0].submenu.items[4].enabled = true;
    mainWindowMenu.items[0].submenu.items[5].enabled = true;
    mainWindowMenu.items[1].submenu.items[0].enabled = true;
    mainWindowMenu.items[1].submenu.items[1].enabled = true;
    mainWindowMenu.items[1].submenu.items[2].enabled = true;
    mainWindowMenu.items[1].submenu.items[3].enabled = true;
}

// Replaces all instances of a sub-string in a string
String.prototype.replaceAll = function(target, replacement) {
    return this.split(target).join(replacement);
};

// Code that formats the whole project as valid Open Day Dialogue code
const indentString = require('indent-string');
function getAllCode(proj){
    let code = "";

    // Write scenes
    for(var s in proj.scenes){
        if(!proj.scenes.hasOwnProperty(s)) continue;
        var scene = proj.scenes[s];

        code += `scene ${s}:\n`;
        code += indentString(scene.text.replaceAll("\r", ""), 4, { includeEmptyLines: true }) + "\n";
    }

    // Write defintion groups
    for(var d in proj.definitionGroups){
        if(!proj.definitionGroups.hasOwnProperty(d)) continue;
        var group = proj.definitionGroups[d];

        code += `definitions ${d}:\n`;
        code += indentString(group.text.replaceAll("\r", ""), 4, { includeEmptyLines: true }) + "\n";
    }

    // Write scripts at the end. No need for special indenting.
    proj.scripts.forEach(script => {
        code += script.text.replaceAll("\r", "") + "\n";
    });

    return code;
}

app.on('ready', () => {
    // Show the main widnow
    mainWindow = new BrowserWindow({ show: false, fullscreenable: false, title: 'Open Day Dialogue Editor', width: 1280, height: 720 });
    mainWindow.loadURL(url.format({
        pathname: path.join(getRootDir(), '/static/main.html'),
        protocol: 'file:',
        slashes: true
    }));
    mainWindow.webContents.once('dom-ready', () => {
        mainWindow.show();
    });

    // Register zooming in and out shortcuts for the text editor
    globalShortcut.register('CommandOrControl+=', () => {
        if(!mainWindow.isFocused())
            return;
        mainWindow.webContents.send('async-editor-zoom-in', {});
    });
    globalShortcut.register('CommandOrControl+-', () => {
        if(!mainWindow.isFocused())
            return;
        mainWindow.webContents.send('async-editor-zoom-out', {});
    });

    // Confirm that the app should close
    mainWindow.on('close', e => {
        e.preventDefault();
        if (madeAnyChanges){
            // Display quit message box, if the current project has not been saved
            // since the last modification.
            mainWindow.setClickInteraction(true);
            dialog.showMessageBox(mainWindow, { title: 'Quit?', type: 'warning', defaultId: 1, buttons: ['Yes', 'No'], message: 'Quit and lose unsaved changes?' }, (number, checked) => {
                mainWindow.setClickInteraction(false);
                if (number == 0)
                    app.exit();
            });
        } else {
            // No unsaved changes are left on the project, so it's okay to close.
            app.exit();
        }
    })
   
    // Setup the main application menu
    mainWindowMenu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    click(){
                        if (mainWindowIgnore)
                            return;

                        newProjectWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, fullscreenable: false, title: 'New Project', show: false, width: 600, height: 400, resizable: false });
                        newProjectWindow.webContents.once('dom-ready', () => {
                            newProjectWindow.show();
                            mainWindow.setClickInteraction(true);
                            newProjectWindow.on('close', e => {
                                mainWindow.setClickInteraction(false);
                            });
                        });
                        newProjectWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_project.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newProjectWindow.setMenu(null);
                    }
                },
                {
                    label: 'Open Project',
                    accelerator: process.platform == 'darwin' ? 'Command+O' : 'Ctrl+O',
                    click(){
                        if (mainWindowIgnore)
                            return;

                        mainWindow.setClickInteraction(true);
                        dialog.showOpenDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                        filenames => {
                            mainWindow.setClickInteraction(false);
                            if (!filenames)
                                return;
                            var file = filenames[0];
                            fs.readFile(file, 'utf-8', (err, data) => {
                                if (err) throw err;

                                // Parse the JSON
                                let proj = makeProjectFromJSON(data);

                                // Verify that the project is valid
                                if (!verifyProjectIntegrity(proj)){
                                    dialog.showMessageBox(mainWindow, { title: 'Failed to open project', type: 'error', message: 'The project file you attempted to open is corrupt.' }, (number, checked) => {});
                                    return;
                                }

                                // Update variables, set title, enable menus, etc.
                                currentProjectFilename = file;
                                currentProject = proj;
                                mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                                enableProjectMenus();

                                // Reload project
                                mainWindow.webContents.send('async-project-loaded', { currProject: JSON.stringify(currentProject) });
                            });
                        });
                    }
                },
                {
                    label: 'Quit',
                    accelerator: process.platform == 'darwin' ? 'Command+Shift+Q' : 'Ctrl+Shift+Q',
                    click(){
                        mainWindow.close();
                    }
                },
                {
                    label: 'Save Project',
                    enabled: false,
                    accelerator: process.platform == 'darwin' ? 'Command+S' : 'Ctrl+S',
                    click(){
                        if (mainWindowIgnore)
                            return;

                        // If the project has not been saved, open save dialog to choose the new file to create.
                        // Otherwise, save the file.
                        if (!currentProjectFilename){
                            mainWindow.setClickInteraction(true);
                            dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                            filename => {
                                mainWindow.setClickInteraction(false);

                                if (!filename)
                                    return;
                                
                                // Update the filename so the program saves to the correct file from now on
                                currentProjectFilename = filename;

                                // Write the JSON to the file
                                fs.writeFile(filename, getProjectJSON(), err => {
                                    if (err) throw err;
                                });

                                // No new unsaved changes
                                madeAnyChanges = false;
                                mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                            });
                        } else {
                            // Write the JSON to the file
                            fs.writeFile(currentProjectFilename, getProjectJSON(), err => {
                                if (err) throw err;
                            });

                            // No new unsaved changes
                            madeAnyChanges = false;
                            mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                        }
                    }
                },
                {
                    label: 'Save Project As',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;
                            
                        // Open the save dialog
                        mainWindow.setClickInteraction(true);
                        dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                        filename => {
                            mainWindow.setClickInteraction(false);

                            if (!filename)
                                return;

                            // Update the filename so the program saves to the correct file from now on
                            currentProjectFilename = filename;

                            // Write the JSON to the file
                            fs.writeFile(filename, getProjectJSON(), err => {
                                if (err) throw err;
                            });

                            // No new unsaved changes
                            madeAnyChanges = false;
                            mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);

                            // Reload the project
                            mainWindow.webContents.send('async-project-loaded', { currProject: JSON.stringify(currentProject) });
                        });
                    }
                },
                {
                    label: 'Export Code',
                    accelerator: process.platform == 'darwin' ? 'Command+E' : 'Ctrl+E',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;

                        // Open save dialog for where the file should be output
                        mainWindow.setClickInteraction(true);
                        dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Script', extensions: ['opda'] } ], properties: ['openFile'] },
                        filename => {
                            mainWindow.setClickInteraction(false);

                            if (!filename)
                                return;

                            // Write the code to the file
                            fs.writeFile(filename, getAllCode(currentProject), err => {
                                if (err) throw err;
                            });

                            mainWindow.setClickInteraction(true);
                            dialog.showMessageBox(mainWindow, { title: 'Completed', type: 'info', message: 'Exported code successfully.' }, (number, checked) => {
                                mainWindow.setClickInteraction(false);
                            });
                        });
                    }
                }
            ]
        },
        {
            label: 'Project',
            enabled: false,
            submenu: [
                {
                    label: 'View Info',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;

                        // Show the window
                        projectInfoWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, fullscreenable: false, title: 'Project Info', show: false, width: 600, height: 400, resizable: false });
                        mainWindow.setClickInteraction(true);
                        projectInfoWindow.webContents.once('dom-ready', () => {
                            projectInfoWindow.show();
                            projectInfoWindow.on('closed', e => {
                                projectInfoWindow = undefined;
                                mainWindow.setClickInteraction(false);
                            });
                        });
                        projectInfoWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/project_info.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        projectInfoWindow.setMenu(null);
                    }
                },
                {
                    label: 'Create Scene',
                    accelerator: process.platform == 'darwin' ? 'Alt+S' : 'Alt+S',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;

                        // Show the window
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, fullscreenable: false, title: 'New Scene', show: false, width: 600, height: 400, resizable: false });
                        mainWindow.setClickInteraction(true);
                        newItemWindow.webContents.once('dom-ready', () => {
                            newItemWindow.show();
                            newItemWindow.on('closed', e => {
                                newItemWindow = undefined;
                                mainWindow.setClickInteraction(false);
                            });
                        });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_scene.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                    }
                },
                {
                    label: 'Create Definition Group',
                    accelerator: process.platform == 'darwin' ? 'Alt+D' : 'Alt+D',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;

                        // Show the window
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, fullscreenable: false, title: 'New Definition Group', show: false, width: 600, height: 400, resizable: false });
                        mainWindow.setClickInteraction(true);
                        newItemWindow.webContents.once('dom-ready', () => {
                            newItemWindow.show();
                            newItemWindow.on('closed', e => {
                                newItemWindow = undefined;
                                mainWindow.setClickInteraction(false);
                            });
                        });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_defgroup.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                    }
                },
                {
                    label: 'Create Script',
                    accelerator: process.platform == 'darwin' ? 'Alt+F' : 'Alt+F',
                    enabled: false,
                    click(){
                        if (mainWindowIgnore)
                            return;
                            
                        // Show the window
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: useModal, fullscreenable: false, title: 'New Script', show: false, width: 600, height: 400, resizable: false });
                        mainWindow.setClickInteraction(true);
                        newItemWindow.webContents.once('dom-ready', () => {
                            newItemWindow.show();
                            newItemWindow.on('closed', e => {
                                newItemWindow = undefined;
                                mainWindow.setClickInteraction(false);
                            });
                        });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_script.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click(){
                        if (mainWindowIgnore)
                            return;

                        mainWindow.setClickInteraction(true);
                        dialog.showMessageBox(mainWindow, { title: 'About', type: 'info', message: 'Open Day Dialogue - by colinator27 and contributors\n\nGitHub repository (editor): https://github.com/colinator27/open-day-dialogue-editor\nGitHub repository (compiler): https://github.com/colinator27/open-day-dialogue-compiler\nGitHub repository (interpreters): https://github.com/colinator27/open-day-dialogue-interpreters' }, (number, checked) => {
                            mainWindow.setClickInteraction(false);
                        });
                    }
                },
                {
                    label: 'Open Developer Tools',
                    accelerator: process.platform == 'darwin' ? 'Command+Shift+I' : 'Ctrl+Shift+I',
                    click(){
                        mainWindow.webContents.openDevTools();
                    }
                }
            ]
        }
    ]);
    Menu.setApplicationMenu(mainWindowMenu);
});