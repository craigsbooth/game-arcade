const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;
const PORT = 3000;

function startServer() {
    return new Promise((resolve) => {
        serverProcess = fork(path.join(__dirname, 'server.js'), [], {
            env: { ...process.env, PORT: String(PORT) },
            silent: true
        });

        serverProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(msg);
            if (msg.includes('Game Arcade Server running')) {
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        // Resolve after timeout in case the message doesn't match
        setTimeout(resolve, 3000);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Game Arcade',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await startServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
