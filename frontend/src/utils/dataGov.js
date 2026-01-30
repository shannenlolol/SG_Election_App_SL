// src/utils/dataGov.js
const API_KEY = import.meta.env.VITE_DGS_API_KEY || "";

function apiOpenHeaders() {
  const headers = {};
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  return headers;
}
function withApiKeyHeaders(extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  return headers;
}

export async function pollDownload(datasetId) {
  const url = `https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`;

  const response = await fetch(url, {
    method: "GET",
    headers: apiOpenHeaders(),
  });

  const json = await response.json();

  if (!response.ok || json.code !== 0) {
    throw new Error(
      json && json.errMsg ? String(json.errMsg) : "poll-download failed",
    );
  }

  if (!json.data || !json.data.url) {
    throw new Error("poll-download did not return a download URL.");
  }

  return String(json.data.url);
}

export async function fetchGeoJsonFromDataset(datasetId) {
  const downloadUrl = await pollDownload(datasetId);
  const proxied = `/api/proxy?url=${encodeURIComponent(downloadUrl)}`;

  const response = await fetch(proxied);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Proxy fetch failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return JSON.parse(text);
}


export async function fetchTextFromDataset(datasetId) {
  const downloadUrl = await pollDownload(datasetId);

  // Go through backend to avoid S3 CORS
  const proxied = `/api/proxy?url=${encodeURIComponent(downloadUrl)}`;

  const response = await fetch(proxied);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proxy fetch failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return await response.text();
}

