from dash import Dash, html, dcc, dash_table
from dash.dependencies import Input, Output, State
from flask import request
import os
import requests
import plotly.graph_objects as go


BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:4000")

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
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def to_csv(values):
    if not values:
        return ""
    return ",".join([str(v) for v in values])


def safe_pct(value, digits=3):
    if value is None:
        return "—"
    try:
        return f"{float(value):.{digits}f}%"
    except Exception:
        return "—"


def build_vote_bar(parties):
    x = []
    y = []
    hover = []

    for p in parties:
        party = p.get("party") or ""
        vote_count = p.get("vote_count")
        vote_share = p.get("vote_share")
        full_name = p.get("party_full_name") or party

        x.append(party)

        if vote_count is None:
            y.append(0)
        else:
            y.append(int(vote_count))

        if vote_share is None:
            share_txt = "—"
        else:
            share_txt = f"{float(vote_share) * 100:.2f}%"

        hover.append(f"{full_name}<br>Votes: {vote_count}<br>Share: {share_txt}")

    fig = go.Figure(
        data=[
            go.Bar(
                x=x,
                y=y,
                hovertext=hover,
                hoverinfo="text",
            )
        ]
    )
    fig.update_layout(
        title="Votes by party",
        margin=dict(l=20, r=20, t=50, b=30),
        xaxis_title="Party",
        yaxis_title="Votes",
        height=340,
    )
    return fig


def build_elector_pie(elector):
    if not elector:
        fig = go.Figure()
        fig.update_layout(
            title="Elector stats",
            margin=dict(l=20, r=20, t=50, b=30),
            height=340,
        )
        return fig

    registered = elector.get("no_of_registered_electors") or 0
    rejected = elector.get("no_of_rejected_votes") or 0
    spoilt = elector.get("no_of_spoilt_ballot_papers") or 0

    labels = [
        "Registered electors",
        "Rejected votes",
        "Spoilt ballot papers",
    ]
    values = [
        int(registered),
        int(rejected),
        int(spoilt),
    ]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.35,
            )
        ]
    )
    fig.update_layout(
        title="Registered vs rejected vs spoilt",
        margin=dict(l=20, r=20, t=50, b=30),
        height=340,
    )
    return fig


def parse_candidates(parties):
    items = []
    for p in parties:
        party = p.get("party") or ""
        full_name = p.get("party_full_name") or ""
        cand_str = p.get("candidates") or ""
        cand_list = [c.strip() for c in cand_str.split(";") if c.strip()]

        title = party
        if full_name and full_name != party:
            title = f"{party} ({full_name})"

        if cand_list:
            items.append(
                html.Div(
                    [
                        html.Div(title, className="detail-subtitle"),
                        html.Ul([html.Li(c) for c in cand_list], className="detail-list"),
                    ],
                    className="detail-block",
                )
            )
        else:
            items.append(
                html.Div(
                    [
                        html.Div(title, className="detail-subtitle"),
                        html.Div("No candidate names available.", className="muted"),
                    ],
                    className="detail-block",
                )
            )

    if not items:
        return html.Div("No party/candidate data found.", className="muted")

    return html.Div(items)


# ----------------------------
# Dash app (mounted under /dash/)
# ----------------------------
app = Dash(
    __name__,
    requests_pathname_prefix="/dash/",
    routes_pathname_prefix="/dash/",
)
server = app.server


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
        dcc.Interval(id="boot", interval=80, n_intervals=0, max_intervals=1),

        html.Div(id="auth-warning", className="alert", style={"display": "none"}),

        dcc.Store(id="store-options", data=None),
        dcc.Store(id="store-expanded", data=None),

        dcc.Tabs(
            id="tabs",
            value="tab-search",
            children=[
                dcc.Tab(label="Search", value="tab-search"),
                dcc.Tab(label="Summary", value="tab-summary"),
            ],
            className="tabs",
        ),

        html.Div(
            id="tab-content",
            className="tab-content",
        ),
    ],
    className="page",
)


def render_search_tab():
    return html.Div(
        [
            html.Div(
                [
                    html.Div(
                        [
                            html.Label("Year (multi-select)", className="label"),
                            dcc.Dropdown(
                                id="dd-years",
                                options=[],
                                value=[],
                                multi=True,
                                placeholder="All years",
                                className="control",
                            ),
                        ],
                        className="field",
                    ),
                    html.Div(
                        [
                            html.Label("Winner party (optional)", className="label"),
                            dcc.Dropdown(
                                id="dd-winners",
                                options=[],
                                value=[],
                                multi=True,
                                placeholder="All parties",
                                className="control",
                            ),
                        ],
                        className="field",
                    ),
                    html.Div(
                        [
                            html.Label("Constituency type", className="label"),
                            dcc.Checklist(
                                id="ck-types",
                                options=[
                                    {"label": "GRC", "value": "GRC"},
                                    {"label": "SMC", "value": "SMC"},
                                ],
                                value=["GRC", "SMC"],
                                inline=True,
                                className="checklist",
                            ),
                        ],
                        className="field",
                    ),
                    html.Div(
                        [
                            html.Label("Constituency (multi-select)", className="label"),
                            dcc.Dropdown(
                                id="dd-consts",
                                options=[],
                                value=[],
                                multi=True,
                                searchable=True,
                                placeholder="Type to search constituencies…",
                                className="control",
                            ),
                        ],
                        className="field span-2",
                    ),
                    html.Div(
                        [
                            html.Label("Search text (optional)", className="label"),
                            dcc.Input(
                                id="inp-q",
                                type="text",
                                value="",
                                placeholder="Search by constituency name…",
                                className="text-input",
                            ),
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
                            html.Div("Rows matched", className="kpi-title"),
                            html.Div(id="kpi-count", className="kpi-value"),
                            html.Div("After filters", className="kpi-foot"),
                        ],
                        className="kpi",
                    ),
                    html.Div(
                        [
                            html.Div("Average turnout", className="kpi-title"),
                            html.Div(id="kpi-turnout", className="kpi-value"),
                            html.Div("Across matched rows", className="kpi-foot"),
                        ],
                        className="kpi",
                    ),
                    html.Div(
                        [
                            html.Div("Years selected", className="kpi-title"),
                            html.Div(id="kpi-years", className="kpi-value"),
                            html.Div("Filter scope", className="kpi-foot"),
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
                            {"name": "Year", "id": "year"},
                            {"name": "Constituency", "id": "constituency"},
                            {"name": "Constituency Type", "id": "constituency_type"},
                            {"name": "Winner", "id": "winner_party"},
                            {"name": "Margin", "id": "margin_pct"},
                        ],
                        data=[],
                        sort_action="native",
                        page_size=14,
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
                                "if": {"column_id": "margin_pct"},
                                "fontVariantNumeric": "tabular-nums",
                            },
                        ],
                        tooltip_data=[],
                        tooltip_duration=None,
                    )
                ],
                className="panel table-panel",
            ),

            html.Div(
                id="details-panel",
                className="panel details-panel",
                style={"display": "none"},
            ),
        ]
    )


def render_summary_tab():
    return html.Div(
        [
            html.Div(
                [
                    html.Div(
                        [
                            html.Div("Summary", className="title"),
                            html.Div(
                                "Not grouped by constituency. Based on current dataset.",
                                className="subtitle",
                            ),
                        ],
                        className="header-block",
                    )
                ],
                className="panel",
            ),
            html.Div(
                [
                    dcc.Graph(id="g-overall-winners", config={"displayModeBar": False}),
                ],
                className="panel",
            ),
            html.Div(
                [
                    dcc.Graph(id="g-yearly-winners", config={"displayModeBar": False}),
                ],
                className="panel",
            ),
        ]
    )


@app.callback(
    Output("tab-content", "children"),
    Input("tabs", "value"),
)
def switch_tab(tab_value):
    if tab_value == "tab-summary":
        return render_summary_tab()
    return render_search_tab()


# ----------------------------
# Boot: load options
# ----------------------------
@app.callback(
    Output("store-options", "data"),
    Output("auth-warning", "children"),
    Output("auth-warning", "style"),
    Input("boot", "n_intervals"),
)
def boot_load_options(_n):
    try:
        data = backend_get_json("/api/dashboard/options")
        return data, "", {"display": "none"}
    except Exception:
        return None, "Not authenticated. Please log in on the React app and refresh.", {
            "display": "block",
            "marginBottom": "12px",
        }


# ----------------------------
# Populate filters defaults (ALL years selected by default)
# ----------------------------
@app.callback(
    Output("dd-years", "options"),
    Output("dd-years", "value"),
    Output("dd-winners", "options"),
    Output("dd-consts", "options"),
    Input("store-options", "data"),
    State("tabs", "value"),
)
def init_filters(options_data, _tab):
    if not options_data:
        return [], [], [], []

    years = options_data.get("years", [])
    parties = options_data.get("parties", [])
    consts = options_data.get("constituencies", [])

    years_sorted = sorted([int(y) for y in years], reverse=True)
    year_options = [{"label": str(y), "value": int(y)} for y in years_sorted]
    year_default = years_sorted[:]  # select all

    party_options = []
    for p in parties:
        abbr = p.get("abbreviation")
        full_name = p.get("full_name") or ""
        if abbr:
            party_options.append({"label": f"{abbr} — {full_name}", "value": abbr})

    # Constituency dropdown: show "Name (Type, Year)" but value is "Name"
    const_options = []
    for c in consts:
        name = c.get("constituency")
        ctype = c.get("constituency_type")
        year = c.get("year")
        if name:
            label = f"{name} ({ctype}, {year})"
            const_options.append({"label": label, "value": name})

    # de-duplicate by value while keeping first label
    seen = set()
    deduped = []
    for opt in const_options:
        v = opt.get("value")
        if v in seen:
            continue
        seen.add(v)
        deduped.append(opt)

    return year_options, year_default, party_options, deduped


# ----------------------------
# Search + table + KPI + tooltips
# ----------------------------
@app.callback(
    Output("kpi-count", "children"),
    Output("kpi-turnout", "children"),
    Output("kpi-years", "children"),
    Output("tbl", "data"),
    Output("tbl", "tooltip_data"),
    Input("dd-years", "value"),
    Input("dd-winners", "value"),
    Input("ck-types", "value"),
    Input("dd-consts", "value"),
    Input("inp-q", "value"),
    State("store-options", "data"),
)
def update_table(years, winners, types, constituencies, q, options_data):
    if not options_data:
        return "—", "—", "—", [], []

    years = years or []
    winners = winners or []
    types = types or []
    constituencies = constituencies or []
    q = (q or "").strip()

    params = {
        "years": to_csv(years),
        "winners": to_csv(winners),
        "types": to_csv(types),
        "constituencies": to_csv(constituencies),
        "q": q,
    }

    try:
        resp = backend_get_json("/api/dashboard/search", params=params)
        rows = resp.get("rows", [])

        # KPI: count + average turnout
        count = len(rows)

        turnout_vals = []
        for r in rows:
            t = r.get("turnout_pct")
            if t is None:
                continue
            try:
                turnout_vals.append(float(t))
            except Exception:
                pass

        if turnout_vals:
            avg_turnout = sum(turnout_vals) / float(len(turnout_vals))
            turnout_txt = safe_pct(avg_turnout, digits=3)
        else:
            turnout_txt = "—"

        years_txt = str(len(years)) if years else "All"

        # Party tooltip map
        party_map = {}
        for p in options_data.get("parties", []):
            abbr = p.get("abbreviation")
            full_name = p.get("full_name")
            if abbr:
                party_map[str(abbr)] = str(full_name or "")

        # Build DataTable data + tooltip_data
        table_data = []
        tooltip_data = []

        for r in rows:
            year = r.get("year")
            constituency = r.get("constituency") or ""
            ctype = r.get("constituency_type") or ""
            winner = r.get("winner_party") or ""
            margin = r.get("margin_pct")

            table_data.append(
                {
                    "year": year,
                    "constituency": constituency,
                    "constituency_type": ctype,
                    "winner_party": winner,
                    "margin_pct": safe_pct(margin, digits=3),
                }
            )

            winner_full = party_map.get(str(winner), "")
            tooltip_row = {
                "winner_party": {"value": winner_full or winner, "type": "text"},
            }
            tooltip_data.append(tooltip_row)

        return str(count), turnout_txt, years_txt, table_data, tooltip_data

    except Exception:
        return "—", "—", str(len(years) if years else "All"), [], []


# ----------------------------
# Row click expand / collapse
# ----------------------------
@app.callback(
    Output("store-expanded", "data"),
    Input("tbl", "active_cell"),
    State("tbl", "data"),
    State("store-expanded", "data"),
    prevent_initial_call=True,
)
def toggle_expand(active_cell, table_data, expanded_state):
    if not active_cell or not table_data:
        return None

    row_index = active_cell.get("row")
    if row_index is None:
        return None
    if row_index < 0 or row_index >= len(table_data):
        return None

    clicked = table_data[row_index]
    clicked_key = f"{clicked.get('year')}|{clicked.get('constituency')}"

    if expanded_state and expanded_state.get("key") == clicked_key:
        return None

    return {
        "key": clicked_key,
        "year": clicked.get("year"),
        "constituency": clicked.get("constituency"),
    }


@app.callback(
    Output("details-panel", "children"),
    Output("details-panel", "style"),
    Input("store-expanded", "data"),
)
def render_details(expanded_state):
    if not expanded_state:
        return [], {"display": "none"}

    year = expanded_state.get("year")
    constituency = expanded_state.get("constituency")

    if not year or not constituency:
        return [], {"display": "none"}

    try:
        details = backend_get_json(
            "/api/dashboard/details",
            params={"year": year, "constituency": constituency},
        )

        parties = details.get("parties", [])
        elector = details.get("elector", None)

        vote_fig = build_vote_bar(parties)
        elector_fig = build_elector_pie(elector)
        candidates_block = parse_candidates(parties)

        header = html.Div(
            [
                html.Div(
                    f"Details — {constituency} ({year})",
                    className="detail-title",
                ),
                html.Div(
                    "Click the same row again to collapse.",
                    className="muted",
                ),
            ],
            className="detail-header",
        )

        content = html.Div(
            [
                html.Div(
                    [
                        dcc.Graph(
                            figure=vote_fig,
                            config={"displayModeBar": False},
                        )
                    ],
                    className="detail-graph",
                ),
                html.Div(
                    [
                        html.Div("Candidates", className="detail-section-title"),
                        candidates_block,
                    ],
                    className="detail-candidates",
                ),
                html.Div(
                    [
                        dcc.Graph(
                            figure=elector_fig,
                            config={"displayModeBar": False},
                        )
                    ],
                    className="detail-graph",
                ),
            ],
            className="detail-grid",
        )

        return [header, content], {"display": "block"}

    except Exception:
        return [html.Div("Failed to load details.", className="muted")], {"display": "block"}


# ----------------------------
# Summary tab charts (client-side aggregation via /search)
# ----------------------------
@app.callback(
    Output("g-overall-winners", "figure"),
    Output("g-yearly-winners", "figure"),
    Input("tabs", "value"),
)
def build_summary(tab_value):
    if tab_value != "tab-summary":
        fig_empty_1 = go.Figure()
        fig_empty_2 = go.Figure()
        return fig_empty_1, fig_empty_2

    # Pull all rows (no filters) and aggregate
    try:
        resp = backend_get_json("/api/dashboard/search", params={})
        rows = resp.get("rows", [])

        # Overall winners
        overall = {}
        # Yearly winners
        yearly = {}

        for r in rows:
            year = r.get("year")
            winner = r.get("winner_party") or "—"

            overall[winner] = overall.get(winner, 0) + 1

            if year not in yearly:
                yearly[year] = {}
            yearly[year][winner] = yearly[year].get(winner, 0) + 1

        # Overall pie
        labels = list(overall.keys())
        values = [overall[k] for k in labels]

        fig_overall = go.Figure(
            data=[
                go.Pie(
                    labels=labels,
                    values=values,
                    hole=0.35,
                )
            ]
        )
        fig_overall.update_layout(
            title="Overall: constituencies won by party",
            margin=dict(l=20, r=20, t=50, b=30),
            height=360,
        )

        # Yearly stacked bar
        years_sorted = sorted([int(y) for y in yearly.keys()], reverse=True)
        parties = sorted(list(overall.keys()))

        fig_yearly = go.Figure()
        for party in parties:
            y_counts = []
            for y in years_sorted:
                y_counts.append(int(yearly.get(y, {}).get(party, 0)))

            fig_yearly.add_trace(
                go.Bar(
                    name=party,
                    x=[str(y) for y in years_sorted],
                    y=y_counts,
                )
            )

        fig_yearly.update_layout(
            barmode="stack",
            title="Year-by-year: constituencies won (stacked)",
            xaxis_title="Year",
            yaxis_title="Count",
            margin=dict(l=20, r=20, t=50, b=30),
            height=420,
        )

        return fig_overall, fig_yearly

    except Exception:
        fig_overall = go.Figure()
        fig_overall.update_layout(title="Overall: failed to load")

        fig_yearly = go.Figure()
        fig_yearly.update_layout(title="Year-by-year: failed to load")

        return fig_overall, fig_yearly


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8050, debug=False)
