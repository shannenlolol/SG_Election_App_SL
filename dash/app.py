from dash import Dash, html, dcc, dash_table, no_update
from dash.dependencies import Input, Output
import os
import requests
from flask import request, jsonify
import traceback

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:4000")

def log(*args):
    print(*args, flush=True)

def backend_get_json(path, params=None):
    url = f"{BACKEND_BASE}{path}"

    log("\n=== [backend_get_json] START ===")
    log("[backend_get] url:", url)
    log("[backend_get] params:", params)
    log("[backend_get] dash request.method:", request.method)
    log("[backend_get] dash request.path:", request.path)
    log("[backend_get] dash request.full_path:", getattr(request, "full_path", ""))

    # More reliable than manually forwarding Cookie header string
    incoming_cookies = dict(request.cookies)
    log("[backend_get] incoming cookie keys:", list(incoming_cookies.keys()))
    log("[backend_get] has token cookie:", ("token" in incoming_cookies))

    try:
        r = requests.get(
            url,
            params=params,
            cookies=incoming_cookies,  # IMPORTANT
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
            },
            timeout=10,
        )

        log("[backend_get] status:", r.status_code)
        log("[backend_get] content-type:", r.headers.get("Content-Type"))

        if r.status_code != 200:
            log("[backend_get] body (first 500):", r.text[:500])

        r.raise_for_status()

        data = r.json()
        if isinstance(data, dict):
            log("[backend_get] json keys:", list(data.keys()))
        else:
            log("[backend_get] json type:", type(data))

        log("=== [backend_get_json] END ===\n")
        return data

    except Exception as e:
        log("[backend_get] EXCEPTION:", repr(e))
        log(traceback.format_exc())
        log("=== [backend_get_json] END (ERROR) ===\n")
        raise


app = Dash(
    __name__,
    requests_pathname_prefix="/dash/",
    routes_pathname_prefix="/dash/",
)
server = app.server


@server.before_request
def log_incoming_request():
    log("---- DASH INCOMING REQUEST ----")
    log("method:", request.method)
    log("path:", request.path)
    log("host:", request.host)
    log("origin:", request.headers.get("Origin"))
    log("referer:", request.headers.get("Referer"))

    cookie_header = request.headers.get("Cookie", "")
    log("cookie header (first 200):", cookie_header[:200] + ("..." if len(cookie_header) > 200 else ""))
    log("parsed cookies keys:", list(request.cookies.keys()))
    log("has token cookie:", "token" in request.cookies)
    log("---- END DASH INCOMING ----")


# Important: stop caching for Dash endpoints (prevents confusing 304 behaviour)
@server.after_request
def add_headers(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"

    # Allow embedding in http://localhost:5173/dashboard
    resp.headers["Content-Security-Policy"] = "frame-ancestors http://localhost:5173 http://127.0.0.1:5173"
    if "X-Frame-Options" in resp.headers:
        del resp.headers["X-Frame-Options"]

    return resp


@server.route("/dash/_debug")
def dash_debug():
    return jsonify({
        "dash_received_cookie_header": request.headers.get("Cookie", ""),
        "dash_received_cookies": dict(request.cookies),
    })


log("DASH APP BOOTED: app.py loaded")
log("DASH CONFIG: BACKEND_BASE =", BACKEND_BASE)


app.layout = html.Div(
    [
        # Fires exactly once on load (iframe or direct)
        dcc.Interval(id="boot", interval=50, n_intervals=0, max_intervals=1),

        # Visible debug panel (so you can confirm callback ran)
        html.Pre(
            id="debug-panel",
            style={
                "display": "block",
                "margin": "10px 0 14px 0",
                "padding": "10px 12px",
                "borderRadius": "10px",
                "background": "#f7f7f8",
                "border": "1px solid #e5e7eb",
                "color": "#111827",
                "fontSize": "12px",
                "whiteSpace": "pre-wrap",
            },
            children="Debug: waiting for boot callback...",
        ),

        html.Div(
            id="auth-warning",
            style={"display": "none"},
        ),

        html.Div(
            [
                html.H1("Polling Dashboard", style={"margin": "0 0 4px 0"}),
                html.Div(
                    "Search and compare outcomes across years and constituencies.",
                    style={"color": "#667085", "marginBottom": "18px"},
                ),
            ],
            style={"marginBottom": "10px"},
        ),

        html.Div(
            [
                html.Div(
                    [
                        html.Label("Year", className="field-label"),
                        dcc.Dropdown(id="dd-year", placeholder="Select year...", clearable=False),
                    ],
                    className="field",
                ),
                html.Div(
                    [
                        html.Label("Winner party", className="field-label"),
                        dcc.Dropdown(
                            id="dd-party",
                            options=[{"label": "All parties", "value": "All"}],
                            value="All",
                            clearable=False,
                        ),
                    ],
                    className="field",
                ),
                html.Div(
                    [
                        html.Label("Search constituency", className="field-label"),
                        dcc.Input(id="q", placeholder="e.g., Ang Mo Kio", className="text-input"),
                    ],
                    className="field",
                ),
            ],
            className="filters",
        ),

        html.Div(
            [
                html.Div([html.Div("Constituencies counted", className="kpi-title"),
                          html.Div(id="kpi-count", className="kpi-value")], className="kpi-card"),
                html.Div([html.Div("Average turnout", className="kpi-title"),
                          html.Div(id="kpi-turnout", className="kpi-value")], className="kpi-card"),
                html.Div([html.Div("Year", className="kpi-title"),
                          html.Div(id="kpi-year", className="kpi-value")], className="kpi-card"),
            ],
            className="kpis",
        ),

        dash_table.DataTable(
            id="tbl",
            columns=[
                {"name": "Constituency", "id": "constituency"},
                {"name": "Type", "id": "type"},
                {"name": "Winner", "id": "winner"},
                {"name": "Margin", "id": "margin"},
                {"name": "Top parties", "id": "top_parties"},
            ],
            data=[],
            sort_action="native",
            page_size=12,
            style_table={"overflowX": "auto"},
            style_header={"fontWeight": 700},
        ),
    ],
    className="page",
)


@app.callback(
    Output("dd-year", "options"),
    Output("dd-year", "value"),
    Output("auth-warning", "children"),
    Output("auth-warning", "style"),
    Output("debug-panel", "children"),
    Input("boot", "n_intervals"),
)
def load_years(n):
    log("[load_years] fired boot:", n)

    try:
        data = backend_get_json("/api/dashboard/years")
        years = data.get("years", [])
        options = [{"label": str(y), "value": int(y)} for y in years]
        default_year = int(years[0]) if years else None

        msg = (
            "Boot callback ran.\n"
            f"Years received: {years}\n"
            f"Default year: {default_year}\n"
            f"Cookie keys seen by Dash: {list(request.cookies.keys())}\n"
        )
        log("[load_years] years:", years, "default:", default_year)
        return options, default_year, "", {"display": "none"}, msg

    except Exception as e:
        log("[load_years] ERROR:", repr(e))

        msg = (
            "Boot callback ran but FAILED.\n"
            f"Error: {repr(e)}\n"
            f"Cookie keys seen by Dash: {list(request.cookies.keys())}\n"
            f"BACKEND_BASE: {BACKEND_BASE}\n"
        )

        return [], None, "Not authenticated. Please log in on the React app and refresh.", {
            "display": "block",
            "margin": "12px 0",
            "padding": "12px 14px",
            "borderRadius": "10px",
            "background": "#fff3cd",
            "border": "1px solid #ffeeba",
            "color": "#664d03",
            "fontWeight": 600,
        }, msg


@app.callback(
    Output("kpi-count", "children"),
    Output("kpi-turnout", "children"),
    Output("kpi-year", "children"),
    Output("tbl", "data"),
    Input("dd-year", "value"),
    Input("dd-party", "value"),
    Input("q", "value"),
)
def update_dashboard(year, party, q):
    log("[update_dashboard] fired:", year, party, q)
    log("[update_dashboard] cookie keys:", list(request.cookies.keys()))

    if not year:
        return "—", "—", "—", []

    party_val = party or "All"
    q_val = (q or "").strip()

    try:
        summary = backend_get_json("/api/dashboard/summary", params={"year": year, "party": party_val, "q": q_val})
        rows = backend_get_json("/api/dashboard/rows", params={"year": year, "party": party_val, "q": q_val})

        count = summary.get("electionsCount", 0)
        turnout = summary.get("turnoutPct", 0)

        table_data = []
        for r in rows.get("rows", []):
            table_data.append({
                "constituency": r.get("constituency", ""),
                "type": r.get("type", ""),
                "winner": r.get("winner", ""),
                "margin": f"{float(r.get('marginPct', 0)):.3f}%",
                "top_parties": "  ".join(r.get("topParties", [])),
            })

        return str(count), f"{float(turnout):.3f}%", str(year), table_data

    except Exception as e:
        log("[update_dashboard] ERROR:", repr(e))
        return "—", "—", str(year), []


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8050, debug=False)
