const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 2987;
const API_URL = `http://127.0.0.1:${PORT}`;

let backendProcess = null;

function getAppRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
}

function getPythonPath(appRoot) {
  const isWin = process.platform === "win32";
  const fs = require("fs");
  if (isWin) {
    const dotVenvPy = path.join(appRoot, ".venv", "Scripts", "python.exe");
    const venvPy = path.join(appRoot, "venv", "Scripts", "python.exe");
    if (fs.existsSync(dotVenvPy)) return dotVenvPy;
    if (fs.existsSync(venvPy)) return venvPy;
    return "python";
  }
  const dotVenvPy = path.join(appRoot, ".venv", "bin", "python");
  const venvPy = path.join(appRoot, "venv", "bin", "python");
  if (fs.existsSync(dotVenvPy)) return dotVenvPy;
  if (fs.existsSync(venvPy)) return venvPy;
  return "python3";
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const appRoot = getAppRoot();
    const pythonCmd = getPythonPath(appRoot);
    const args = ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(PORT)];

    let stderr = "";
    backendProcess = spawn(pythonCmd, args, {
      cwd: appRoot,
      stdio: "pipe",
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    backendProcess.stderr?.on("data", (d) => {
      stderr += d.toString();
      process.stdout.write(d.toString());
    });
    backendProcess.stdout?.on("data", (d) => process.stdout.write(d.toString()));
    backendProcess.on("error", (err) => {
      reject(new Error(`Backend failed to start: ${err.message}. Make sure Python is installed and in your PATH. Run "npm start" from the terminal to see details.`));
    });
    backendProcess.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        console.error("Backend exited with code", code, "\n", stderr);
      }
    });

    waitForServer(resolve, reject, stderr);
  });
}

function waitForServer(resolve, reject, stderrRef, attempts = 0) {
  const maxAttempts = 50;
  if (attempts >= maxAttempts) {
    reject(new Error("Backend did not respond in time. Check that port 2987 is free and run \"npm start\" from the project folder to see errors."));
    return;
  }
  const req = http.get(API_URL, (res) => {
    if (res.statusCode === 200) resolve();
    else setTimeout(() => waitForServer(resolve, reject, stderrRef, attempts + 1), 200);
  });
  req.on("error", () => setTimeout(() => waitForServer(resolve, reject, stderrRef, attempts + 1), 200));
  req.setTimeout(500, () => {
    req.destroy();
    setTimeout(() => waitForServer(resolve, reject, stderrRef, attempts + 1), 200);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: process.platform === "win32",
    backgroundColor: "#faf5f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadURL(API_URL);
  win.once("ready-to-show", () => win.show());

  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media") callback(true);
    else callback(false);
  });

  win.on("closed", () => {
    stopBackend();
  });
}

app.whenReady().then(() => {
  startBackend()
    .then(createWindow)
    .catch((err) => {
      console.error(err.message);
      dialog.showErrorBox("Saiborg could not start", err.message);
      app.quit();
    });
});

app.on("window-all-closed", () => {
  stopBackend();
  app.quit();
});

app.on("before-quit", stopBackend);

ipcMain.on("window:minimize", (e) => e.sender.getBrowserWindow().minimize());
ipcMain.on("window:maximize", (e) => {
  const w = e.sender.getBrowserWindow();
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on("window:close", (e) => e.sender.getBrowserWindow().close());
