const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');

const {app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut} = electron;

let mainWindow, mainWindowMenu;
let newProjectWindow, newItemWindow, projectInfoWindow;
let currentProjectFilename = undefined;
let currentProject = undefined;
let madeAnyChanges = false;

function changesMade(){
    if(madeAnyChanges)
        return;
    madeAnyChanges = true;
    mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}*`);
}

function getRootDir(){
    // Convert to .asar path for builds
    return require('app-root-path').toString();
}

ipcMain.on('sync-new-project', (event, arg) => {
    currentProject = {
        name: arg.name,
        author: arg.author,
        info: arg.info,
        scenes: {},
        definitionGroups: {},
        scripts: []
    };
    enableProjectMenus();
    newProjectWindow.hide();
    newProjectWindow.reload();
    mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
    mainWindow.webContents.send('async-project-loaded', { currProject: currentProject });
    changesMade();
    event.returnValue = 0;
});

ipcMain.on('sync-new-scene', (event, arg) => {
    currentProject.scenes[arg.namespace + "." + arg.name] = { name: arg.name, namespace: arg.namespace, text: "// Enter your scene here" };
    mainWindow.webContents.send('async-update-tree', { currProject: currentProject });
    event.returnValue = 0;
    newItemWindow.close();
});

ipcMain.on('sync-new-defgroup', (event, arg) => {
    currentProject.definitionGroups[arg.namespace + "." + arg.name] = { name: arg.name, namespace: arg.namespace, text: "// Enter your definitions here" };
    mainWindow.webContents.send('async-update-tree', { currProject: currentProject });
    event.returnValue = 0;
    newItemWindow.close();
});

ipcMain.on('sync-new-script', (event, arg) => {
    currentProject.scripts.push({ name: arg.name, text: "// Enter your script here" });
    mainWindow.webContents.send('async-update-tree', { currProject: currentProject });
    event.returnValue = 0;
    newItemWindow.close();
});

ipcMain.on('sync-update-project-info', (event, arg) => {
    currentProject.name = arg.name;
    currentProject.author = arg.author;
    currentProject.info = arg.info;
    changesMade();
    projectInfoWindow.close();
    event.returnValue = 0;
});

ipcMain.on('async-list-node-context', (event, arg) => {
    let m = Menu.buildFromTemplate([
        {
            label: 'Rename',
            click(){
                m.closePopup();
            }
        },
        {
            label: 'Delete',
            click(){
                if(arg.type == "Scenes"){
                    delete currentProject.scenes[arg.namespace + "." + arg.name];
                } else if(arg.type == "Definition Groups"){
                    delete currentProject.definitionGroups[arg.namespace + "." + arg.name];
                } else if(arg.type == "Scripts"){
                    delete currentProject.scripts[arg.namespace + "." + arg.name];
                }
                changesMade();
                m.closePopup();
                mainWindow.webContents.send('async-item-deleted', arg);
            }
        }
    ]);
    m.popup();
});

ipcMain.on('sync-changes-made', (event, arg) => {
    changesMade();
    event.returnValue = 0;
})

ipcMain.on('sync-bad-fields-0', (event, arg) => {
    dialog.showMessageBox(newProjectWindow, { title: 'Improper fields', type: 'error', message: 'Name and author fields must be filled!' }, (number, checked) => {});
    event.returnValue = 0;
});

ipcMain.on('sync-bad-fields-1', (event, arg) => {
    dialog.showMessageBox(newProjectWindow, { title: 'Improper fields', type: 'error', message: 'Only A-z, 0-9, _, and . characters can be used in names. They must start with either A-z or _.' }, (number, checked) => {});
    event.returnValue = 0;
});

ipcMain.on('sync-get-item-text', (event, arg) => {
    let txt = "// An error occurred when getting the content of the item.";
    if(arg.type == "Scenes"){
        txt = currentProject.scenes[arg.namespace + "." + arg.name].text;
    } else if(arg.type == "Definition Groups"){
        txt = currentProject.definitionGroups[arg.namespace + "." + arg.name].text;
    } else if(arg.type == "Scripts"){
        currentProject.scripts.forEach(s => {
            if(s.name == arg.name)
                txt = s.text;
        })
    }
    event.returnValue = txt;
});

ipcMain.on('sync-update-item-text', (event, arg) => {
    if(arg.type == "Scenes"){
        currentProject.scenes[arg.namespace + "." + arg.name].text = arg.text;
    } else if(arg.type == "Definition Groups"){
        currentProject.definitionGroups[arg.namespace + "." + arg.name].text = arg.text;
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

ipcMain.on('async-get-project-info', (event, arg) => {
    event.sender.send('async-get-project-info-response', { name: currentProject.name, author: currentProject.author, info: currentProject.info });
});

function enableProjectMenus(){
    mainWindowMenu.items[0].submenu.items[3].enabled = true;
    mainWindowMenu.items[0].submenu.items[4].enabled = true;
    mainWindowMenu.items[0].submenu.items[5].enabled = true;
    mainWindowMenu.items[1].submenu.items[0].enabled = true;
    mainWindowMenu.items[1].submenu.items[1].enabled = true;
    mainWindowMenu.items[1].submenu.items[2].enabled = true;
    mainWindowMenu.items[1].submenu.items[3].enabled = true;
}

String.prototype.replaceAll = function(target, replacement) {
    return this.split(target).join(replacement);
};

const indentString = require('indent-string');

function getAllCode(proj){
    let code = "";

    for(var s in proj.scenes){
        if(!proj.scenes.hasOwnProperty(s)) continue;
        var scene = proj.scenes[s];

        code += `scene ${s}:\n`;
        code += indentString(scene.text.replaceAll("\r", ""), 4) + "\n";
    }

    for(var d in proj.definitionGroups){
        if(!proj.definitionGroups.hasOwnProperty(d)) continue;
        var group = proj.definitionGroups[d];

        code += `definitions ${d}:\n`;
        code += indentString(group.text.replaceAll("\r", ""), 4) + "\n";
    }

    proj.scripts.forEach(script => {
        code += script.text.replaceAll("\r", "") + "\n";
    });

    return code;
}

app.on('ready', () => {
    mainWindow = new BrowserWindow({ show: false, title: 'Open Day Dialogue Editor', width: 800, height: 600 });
    mainWindow.loadURL(url.format({
        pathname: path.join(getRootDir(), '/static/main.html'),
        protocol: 'file:',
        slashes: true
    }));
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
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
    mainWindow.on('close', e => {
        e.preventDefault();
        if (madeAnyChanges){
            dialog.showMessageBox(mainWindow, { title: 'Quit?', type: 'warning', defaultId: 1, buttons: ['Yes', 'No'], message: 'Quit and lose unsaved changes?' }, (number, checked) => {
                if (number == 0)
                    app.exit();
            });
        } else {
            app.exit();
        }
    })
    newProjectWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'New Project', show: false, width: 600, height: 400, resizable: false });
    newProjectWindow.loadURL(url.format({
        pathname: path.join(getRootDir(), '/static/new_project.html'),
        protocol: 'file:',
        slashes: true
    }));
    newProjectWindow.on('close', e => {
        e.preventDefault();
        newProjectWindow.hide();
        newProjectWindow.reload();
    });
    projectInfoWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'Project Info', show: false, width: 600, height: 400, resizable: false });
    mainWindowMenu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    click(){
                        newProjectWindow.setMenu(null);
                        newProjectWindow.show();
                    }
                },
                {
                    label: 'Open Project',
                    accelerator: process.platform == 'darwin' ? 'Command+O' : 'Ctrl+O',
                    click(){
                        dialog.showOpenDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                        filenames => {
                            if (!filenames)
                                return;
                            var file = filenames[0];
                            fs.readFile(file, 'utf-8', (err, data) => {
                                if (err) throw err;
                                currentProjectFilename = file;
                                currentProject = JSON.parse(data);
                                mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                                enableProjectMenus();
                                mainWindow.webContents.send('async-project-loaded', { currProject: currentProject });
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
                        if (!currentProjectFilename){
                            // If the project has not been saved, open save dialog
                            dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                            filename => {
                                if (!filename)
                                    return;
                                currentProjectFilename = filename;
                                fs.writeFile(filename, JSON.stringify(currentProject), err => {
                                    if (err) throw err;
                                });
                                madeAnyChanges = false;
                                mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                            });
                        } else {
                            fs.writeFile(currentProjectFilename, JSON.stringify(currentProject), err => {
                                if (err) throw err;
                            });
                            madeAnyChanges = false;
                            mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                        }
                    }
                },
                {
                    label: 'Save Project As',
                    enabled: false,
                    click(){
                        dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Project', extensions: ['opdap'] } ], properties: ['openFile'] },
                        filename => {
                            if (!filename)
                                return;
                            currentProjectFilename = filename;
                            fs.writeFile(filename, JSON.stringify(currentProject), err => {
                                if (err) throw err;
                            });
                            madeAnyChanges = false;
                            mainWindow.setTitle(`Open Day Dialogue Editor - ${currentProject.name}`);
                            mainWindow.webContents.send('async-project-loaded', { currProject: currentProject });
                        });
                    }
                },
                {
                    label: 'Export Code',
                    accelerator: process.platform == 'darwin' ? 'Command+E' : 'Ctrl+E',
                    enabled: false,
                    click(){
                        dialog.showSaveDialog({ filters: [ { name: 'Open Day Dialogue Script', extensions: ['opda'] } ], properties: ['openFile'] },
                        filename => {
                            if (!filename)
                                return;
                            fs.writeFile(filename, getAllCode(currentProject), err => {
                                if (err) throw err;
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
                        projectInfoWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'Project Info', show: false, width: 600, height: 400, resizable: false });
                        projectInfoWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/project_info.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        projectInfoWindow.setMenu(null);
                        projectInfoWindow.once('ready-to-show', () => {
                            projectInfoWindow.show();
                        });
                    }
                },
                {
                    label: 'Create Scene',
                    accelerator: process.platform == 'darwin' ? 'Alt+S' : 'Alt+S',
                    enabled: false,
                    click(){
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'New Scene', show: false, width: 600, height: 400, resizable: false });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_scene.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                        newItemWindow.once('ready-to-show', () => {
                            newItemWindow.show();
                        });
                    }
                },
                {
                    label: 'Create Definition Group',
                    accelerator: process.platform == 'darwin' ? 'Alt+D' : 'Alt+D',
                    enabled: false,
                    click(){
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'New Definition Group', show: false, width: 600, height: 400, resizable: false });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_defgroup.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                        newItemWindow.once('ready-to-show', () => {
                            newItemWindow.show();
                        });
                    }
                },
                {
                    label: 'Create Script',
                    accelerator: process.platform == 'darwin' ? 'Alt+F' : 'Alt+F',
                    enabled: false,
                    click(){
                        newItemWindow = new BrowserWindow({ parent: mainWindow, modal: true, title: 'New Script', show: false, width: 600, height: 400, resizable: false });
                        newItemWindow.loadURL(url.format({
                            pathname: path.join(getRootDir(), '/static/new_script.html'),
                            protocol: 'file:',
                            slashes: true
                        }));
                        newItemWindow.setMenu(null);
                        newItemWindow.once('ready-to-show', () => {
                            newItemWindow.show();
                        });
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
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