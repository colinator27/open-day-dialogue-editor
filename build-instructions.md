## Build instructions

### Before you begin
Make sure you have already ran `npm install` in the root directory, so that all of the necessary modules are usable.
It is also recommended that `npm start` works (launches the program, etc.) before you try as well.

Also, as you should expect, it is recommended you have at *least* 1 GB of storage. You may even need more in some cases.

### Steps

1. Install electron-packager for CLI usage, if you do not have it already.
    * `npm install electron-packager -g`

2. Build using electron-packager.
    * For Windows, 32-bit and 64-bit, where `[version]` is the app version (ex. `0.9.2`).
        * `electron-packager . "Open Day Dialogue Editor" --app-copyright="colinator27 and contributors" --app-version=[version] --arch=ia32,x64 --asar --icon="./icons/app.ico" --out="./builds/" --overwrite --platform=win32`
    * For Mac, 32-bit and 64-bit, where `[version]` is the app version (ex. `0.9.2`).
	    * `electron-packager . "Open Day Dialogue Editor" --app-copyright="colinator27 and contributors" --app-version=[version] --arch=ia32,x64 --asar --icon="./icons/app.icns" --out="./builds/" --overwrite --platform=darwin`

### Note
The compiled binaries you create should *not* be distributed unless given explicit permission. However, you can do as much as you want with it as long as it is only for personal use.