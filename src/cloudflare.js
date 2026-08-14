import { EMPTY_DATA } from "./constants.js";

const CF_WORKER_URL = "https://bucket.syed-itrath.workers.dev";
const R2_WORKER_URL = "https://bucket.syed-itrath.workers.dev";

async function fetchAppData() {
  const res = await fetch(`${CF_WORKER_URL}/data`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error("Failed to load app data");
  const json = await res.json();
  const payload = json.data ?? json;
  if (!payload || typeof payload !== "object") return EMPTY_DATA;
  return { ...EMPTY_DATA, ...payload };
}

async function uploadFile(file, folder) {
  const safeFolder = folder.replace(/[^a-zA-Z0-9._\-/]/g, "_");
  const safeFile   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key        = `${safeFolder}/${Date.now()}_${safeFile}`;
  const res = await fetch(`${R2_WORKER_URL}/upload/${key}`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "R2 upload failed");
  }
  const { url } = await res.json();
  return url;
}

async function saveAppData(data) {
  const res = await fetch(`${CF_WORKER_URL}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error("Failed to save app data");
}

function isCloudflareConfigured() { return CF_WORKER_URL !== "YOUR_WORKER_URL"; }
function isR2Configured()         { return CF_WORKER_URL !== "YOUR_WORKER_URL"; }

function getPreviewUrl(url) {
  if (!url) return null;
  if (url.includes("1drv.ms") || url.includes("onedrive.live.com")) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  }
  if (url.includes("sharepoint.com")) return url.includes("?") ? url + "&action=embedview" : url + "?action=embedview";
  if (url.includes("drive.google.com")) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  if (url.includes(".r2.dev") || url.includes("workers.dev")) return url;
  return url;
}

export { CF_WORKER_URL, R2_WORKER_URL, fetchAppData, uploadFile, saveAppData, isCloudflareConfigured, isR2Configured, getPreviewUrl };
