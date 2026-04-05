"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),

  // Dialogs / shell
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openPath: (p) => ipcRenderer.invoke("open-path", p),

  // Data
  getTsvPath: () => ipcRenderer.invoke("get-tsv-path"),
  readTsv: (p) => ipcRenderer.invoke("read-tsv", p),

  // Tools
  getDatasetsStatus: () => ipcRenderer.invoke("get-datasets-status"),
  downloadDatasetsCli: () => ipcRenderer.invoke("download-datasets-cli"),
  checkPython: () => ipcRenderer.invoke("check-python"),
  prepareBatches: (opts) => ipcRenderer.invoke("prepare-batches", opts),

  // Downloads
  startDownloads: (opts) => ipcRenderer.invoke("start-downloads", opts),
  stopDownloads: () => ipcRenderer.invoke("stop-downloads"),
  verifyDownloads: (opts) => ipcRenderer.invoke("verify-downloads", opts),

  // Processing
  scanDownloads: (opts) => ipcRenderer.invoke("scan-downloads", opts),
  startProcessing: (opts) => ipcRenderer.invoke("start-processing", opts),
  scanOutputDir: (opts) => ipcRenderer.invoke("scan-output-dir", opts),
  deleteGenomes: (opts) => ipcRenderer.invoke("delete-genomes", opts),
  getGenomeList: (opts) => ipcRenderer.invoke("get-genome-list", opts),

  // Event listeners (main → renderer)
  onLogLine: (cb) => ipcRenderer.on("log-line", (_, d) => cb(d)),
  onGenomeStatus: (cb) => ipcRenderer.on("genome-status", (_, d) => cb(d)),
  onDownloadProgress: (cb) =>
    ipcRenderer.on("download-progress", (_, d) => cb(d)),
  onDownloadsDone: (cb) => ipcRenderer.on("downloads-done", (_, d) => cb(d)),
  onDatasetsProgress: (cb) =>
    ipcRenderer.on("datasets-download-progress", (_, d) => cb(d)),

  // Processing event listeners
  onProcessingStep: (cb) => ipcRenderer.on("processing-step", (_, d) => cb(d)),
  onProcessingFile: (cb) => ipcRenderer.on("processing-file", (_, d) => cb(d)),
  onProcessingLog: (cb) => ipcRenderer.on("processing-log", (_, d) => cb(d)),
  onProcessingDone: (cb) => ipcRenderer.on("processing-done", (_, d) => cb(d)),

  // Remove listeners (call on component unmount)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
