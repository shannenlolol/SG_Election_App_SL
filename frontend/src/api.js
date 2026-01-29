const API_BASE = "http://localhost:4000";


export async function apiGet(path) {
  const res = await fetch(`http://localhost:4000${path}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`http://localhost:4000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
