const fetch = require("node-fetch");

const DATA_GOV_POLL = "https://api-open.data.gov.sg/v1/public/api/datasets";
const API_KEY = process.env.DGS_API_KEY || "";

async function pollDownloadUrl(datasetId) {
  const url = `${DATA_GOV_POLL}/${datasetId}/poll-download`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`data.gov.sg poll-download failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const signedUrl = json && json.data && json.data.url;

  if (!signedUrl) {
    throw new Error("data.gov.sg poll-download returned no URL.");
  }

  return signedUrl;
}

async function fetchGeoJsonFromSignedUrl(signedUrl) {
  const res = await fetch(signedUrl, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`signed download failed: ${res.status} ${text}`);
  }

  return await res.json();
}

module.exports = {
  pollDownloadUrl,
  fetchGeoJsonFromSignedUrl,
};
