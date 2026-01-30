from dash import Dash, html, dcc, dash_table
from dash.dependencies import Input, Output, State
import os
import requests
from flask import request

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:4000")

# ----------------------------
# Production-friendly logging
# ----------------------------
DEBUG_LOGS = os.getenv("DASH_DEBUG_LOGS", "false").lower() == "true"


def log(*args):
    if DEBUG_LOGS:
        print(*args, flush=True)


def backend_get_json(path, params=None):
    url = f"{BACKEND_BASE}{path}"
    incoming_cookies = dict(request.cookies)

    r = requests.get(
        url,
        params=params,
        cookies=incoming_cookies,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        },
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


# ----------------------------
# Dash app (mounted under /dash/)
# ----------------------------
app = Dash(
    __name__,
    requests_pathname_prefix="/dash/",
    routes_pathname_prefix="/dash/",
)
server = app.server

# No-cache + allow iframe embedding from React
@server.after_request
def add_headers(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"

    resp.headers["Content-Security-Policy"] = (
        "frame-ancestors http://localhost:5173 http://127.0.0.1:5173"
    )
    if "X-Frame-Options" in resp.headers:
        del resp.headers["X-Frame-Options"]
    return resp


# ----------------------------
# Layout
# ----------------------------
app.layout = html.Div(
    [
        dcc.Interval(id="boot", interval=50, n_intervals=0, max_intervals=1),

        # Keep warning but make it "in-theme"
        html.Div(id="auth-warning", className="alert", style={"display": "none"}),

        # html.Div(
        #     [
        #         html.Div(
        #             [
        #                 html.Div("Polling Dashboard", className="title"),
        #                 html.Div(
        #                     "Search and compare outcomes across years and constituencies.",
        #                     className="subtitle",
        #                 ),
        #             ]
        #         ),
        #         html.Div(
        #             [
        #                 html.Span("Powered by Dash", className="chip"),
        #             ],
        #             className="header-right",
        #         ),
        #     ],
        #     className="header",
        # ),

        html.Div(
            [
                html.Div(
                    [
                        html.Label("Year", className="label"),
                        dcc.Dropdown(
                            id="dd-year",
                            placeholder="Select year...",
                            clearable=False,
                            className="control",
                        ),
                    ],
                    className="field",
                ),
                html.Div(
                    [
                        html.Label("Winner party", className="label"),
                        dcc.Dropdown(
                            id="dd-party",
                            options=[{"label": "All parties", "value": "All"}],
                            value="All",
                            clearable=False,
                            className="control",
                        ),
                    ],
                    className="field",
                ),
                html.Div(
                    [
                        html.Label("Constituency", className="label"),
                        dcc.Dropdown(
                            id="dd-const",
                            placeholder="Type to search constituencies...",
                            clearable=True,
                            className="control",
                        ),
                        # html.Div(
                        #     "Start typing to filter, or leave empty to search all.",
                        #     className="hint",
                        # ),
                    ],
                    className="field span-2",
                ),
            ],
            className="panel filters",
        ),

        html.Div(
            [
                html.Div(
                    [
                        html.Div("Constituencies counted", className="kpi-title"),
                        html.Div(id="kpi-count", className="kpi-value"),
                        html.Div("Matched after filters", className="kpi-foot"),
                    ],
                    className="kpi",
                ),
                html.Div(
                    [
                        html.Div("Average turnout", className="kpi-title"),
                        html.Div(id="kpi-turnout", className="kpi-value"),
                        html.Div("Across filtered constituencies", className="kpi-foot"),
                    ],
                    className="kpi",
                ),
                html.Div(
                    [
                        html.Div("Year", className="kpi-title"),
                        html.Div(id="kpi-year", className="kpi-value"),
                        html.Div("Selected election year", className="kpi-foot"),
                    ],
                    className="kpi",
                ),
            ],
            className="kpi-grid",
        ),

        html.Div(
            [
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
                    style_header={
                        "fontWeight": 700,
                        "backgroundColor": "rgba(255,255,255,0.04)",
                        "borderBottom": "1px solid rgba(255,255,255,0.10)",
                        "color": "rgba(255,255,255,0.85)",
                    },
                    style_cell={
                        "backgroundColor": "rgba(0,0,0,0)",
                        "borderBottom": "1px solid rgba(255,255,255,0.06)",
                        "color": "rgba(255,255,255,0.88)",
                        "padding": "12px 12px",
                        "fontSize": "13px",
                        "whiteSpace": "normal",
                        "height": "auto",
                    },
                    style_data_conditional=[
                        {
                            "if": {"row_index": "odd"},
                            "backgroundColor": "rgba(255,255,255,0.02)",
                        },
                        {
                            "if": {"state": "active"},
                            "border": "1px solid rgba(33,212,253,0.45)",
                        },
                        {
                            "if": {"column_id": "margin"},
                            "fontVariantNumeric": "tabular-nums",
                        },
                    ],
                )
            ],
            className="panel table-panel",
        ),

        # Hidden store: list of constituencies for current year
        dcc.Store(id="store-const", data=[]),
    ],
    className="page",
)


# ----------------------------
# Callbacks
# ----------------------------
@app.callback(
    Output("dd-year", "options"),
    Output("dd-year", "value"),
    Output("auth-warning", "children"),
    Output("auth-warning", "style"),
    Input("boot", "n_intervals"),
)
def load_years(_n):
    try:
        data = backend_get_json("/api/dashboard/years")
        years = data.get("years", [])
        options = [{"label": str(y), "value": int(y)} for y in years]
        default_year = int(years[0]) if years else None
        return options, default_year, "", {"display": "none"}
    except Exception:
        return [], None, "Not authenticated. Please log in on the React app and refresh.", {
            "display": "block",
            "marginBottom": "12px",
        }


@app.callback(
    Output("store-const", "data"),
    Output("dd-const", "options"),
    Input("dd-year", "value"),
)
def load_constituencies(year):
    if not year:
        return [], []
    try:
        data = backend_get_json("/api/dashboard/constituencies", params={"year": year})
        consts = data.get("constituencies", [])
        options = [{"label": c, "value": c} for c in consts]
        return consts, options
    except Exception:
        return [], []


@app.callback(
    Output("kpi-count", "children"),
    Output("kpi-turnout", "children"),
    Output("kpi-year", "children"),
    Output("tbl", "data"),
    Input("dd-year", "value"),
    Input("dd-party", "value"),
    Input("dd-const", "value"),
)
def update_dashboard(year, party, constituency):
    if not year:
        return "—", "—", "—", []

    party_val = party or "All"
    q_val = (constituency or "").strip()

    try:
        summary = backend_get_json(
            "/api/dashboard/summary",
            params={"year": year, "party": party_val, "q": q_val},
        )
        rows = backend_get_json(
            "/api/dashboard/rows",
            params={"year": year, "party": party_val, "q": q_val},
        )

        count = summary.get("electionsCount", 0)
        turnout = summary.get("turnoutPct", 0)

        table_data = []
        for r in rows.get("rows", []):
            table_data.append(
                {
                    "constituency": r.get("constituency", ""),
                    "type": r.get("type", ""),
                    "winner": r.get("winner", ""),
                    "margin": f"{float(r.get('marginPct', 0)):.3f}%",
                    "top_parties": "  ".join(r.get("topParties", [])),
                }
            )

        return str(count), f"{float(turnout):.3f}%", str(year), table_data

    except Exception:
        return "—", "—", str(year), []


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8050, debug=False)
