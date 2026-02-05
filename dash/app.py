from dash import Dash, html, dcc, dash_table
from dash.dependencies import Input, Output, State
from flask import request
import os
import requests
import plotly.graph_objects as go
from dash import callback_context
from dash.exceptions import PreventUpdate
import html as pyhtml

def party_span(abbr, party_map):
    abbr = str(abbr or "").strip()
    if not abbr:
        return "—"
    full = str(party_map.get(abbr, "") or "").strip()

    # Native tooltip
    title = pyhtml.escape(full if full else abbr, quote=True)

    # Visible text
    text = pyhtml.escape(abbr)

    return f"<span class='party-pill' title='{title}'>{text}</span>"

def party_list_spans(abbr_list, party_map):
    if not abbr_list:
        return "—"
    return ", ".join([party_span(a, party_map) for a in abbr_list])

def split_csv_parties(value):
    if value is None:
        return []
    s = str(value).strip()
    if not s:
        return []
    return [p.strip() for p in s.split(",") if p.strip()]

def get_contesting_parties_from_row(row):
    # Try common keys; adjust if your backend uses a different name
    for key in ["contesting_parties", "contesting_party", "parties_contested", "contesting_parties_csv"]:
        if key in row:
            return split_csv_parties(row.get(key))
    return []

def normalise_na(value):
    if value is None:
        return "—"

    s = str(value).strip()
    if s == "":
        return "—"

    if s.lower() in ["na", "n/a", "null", "none", "nan"]:
        return "—"

    return s

ALL_VALUE = "__ALL__"
def normalise_multi(values):
    if values is None:
        return []
    if not isinstance(values, list):
        values = [values]

    # If ALL is selected together with other items, treat as ALL
    if ALL_VALUE in values:
        return [ALL_VALUE]

    return values

def values_for_query(values):
    values = normalise_multi(values)
    if not values or ALL_VALUE in values:
        return []
    return values


PARTY_COLOR_MAP = {
    "PAP": "#E74C3C",  # red
    "WP": "#2E86DE",   # blue
}

DEFAULT_PARTY_COLORS = [
    "#9B59B6", "#1ABC9C", "#F39C12", "#E67E22", "#00B894",
    "#6C5CE7", "#FD79A8", "#A29BFE", "#00CEC9", "#D63031",
]

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:4000")

DEBUG_LOGS = os.getenv("DASH_DEBUG_LOGS", "false").lower() == "true"

def get_party_color(party, used_colors):
    if party in PARTY_COLOR_MAP:
        return PARTY_COLOR_MAP[party]

    for c in DEFAULT_PARTY_COLORS:
        if c not in used_colors and c not in PARTY_COLOR_MAP.values():
            used_colors.add(c)
            return c

    # fallback
    return "#95A5A6"
def apply_dark_layout(fig, title, height):
    fig.update_layout(
        title=dict(
            text=title,
            x=0.02,
            xanchor="left",
            font=dict(size=16, color="rgba(255,255,255,0.90)", weight=700),
        ),
        height=height,
        margin=dict(l=26, r=26, t=58, b=34),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="rgba(255,255,255,0.85)"),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            font=dict(color="rgba(255,255,255,0.75)", size=11),
        ),
    )
    return fig

def log(*args):
    if DEBUG_LOGS:
        print(*args, flush=True)


def backend_get_json(path, params=None):
    url = f"{BACKEND_BASE}{path}"
    incoming_cookies = dict(request.cookies)

    print("\n=== [backend_get_json] ===")
    print("url:", url)
    print("params:", params)
    print("incoming cookie keys:", list(incoming_cookies.keys()))

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

    print("status:", r.status_code)
    print("text head:", (r.text or "")[:300])

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
    fig = go.Figure()

    for p in parties:
        party = p.get("party") or ""
        vote_count = p.get("vote_count")
        vote_share = p.get("vote_share")
        full_name = p.get("party_full_name") or party

        if vote_count is None:
            vote_count = 0
        else:
            vote_count = int(vote_count)

        if vote_share is None:
            share_txt = "—"
        else:
            share_txt = f"{float(vote_share) * 100:.2f}%"

        hover = f"{full_name}<br>Votes: {vote_count}<br>Share: {share_txt}"

        fig.add_trace(
            go.Bar(
                name=party,
                x=[party],
                y=[vote_count],
                hovertext=[hover],
                hoverinfo="text",
            )
        )

    fig.update_layout(
        title="Votes by party",
        margin=dict(l=26, r=26, t=56, b=46),
        height=200,

        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(size=12, color="rgba(255,255,255,0.85)", weight=700),

        barmode="group",
        showlegend=False,

        xaxis=dict(
            title="Party",
            gridcolor="rgba(255,255,255,0.08)",
            zerolinecolor="rgba(255,255,255,0.10)",
            tickfont=dict(color="rgba(255,255,255,0.82)"),
        ),
        yaxis=dict(
            title="Votes",
            gridcolor="rgba(255,255,255,0.08)",
            zerolinecolor="rgba(255,255,255,0.10)",
            tickfont=dict(color="rgba(255,255,255,0.82)"),
        ),
    )

    fig.update_traces(
        hoverlabel=dict(
            bgcolor="rgba(11,18,32,0.98)",
            bordercolor="rgba(255,255,255,0.14)",
            font=dict(color="rgba(255,255,255,0.92)"),
        )
    )

    return fig



def build_elector_pie(elector):
    if not elector:
        fig = go.Figure()
        fig.update_layout(
            height=320,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig

    registered = int(elector.get("no_of_registered_electors") or 0)
    rejected = int(elector.get("no_of_rejected_votes") or 0)
    spoilt = int(elector.get("no_of_spoilt_ballot_papers") or 0)

    labels = [
        "Registered electors",
        "Rejected votes",
        "Spoilt ballot papers",
    ]
    values = [registered, rejected, spoilt]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.42,

                # Only show percent for large slices
                textinfo="percent",
                textposition="inside",
                insidetextorientation="radial",

                # Hide labels for tiny slices
                pull=[0, 0, 0],
                sort=False,

                hovertemplate="%{label}<br>%{value:,}<br>%{percent}<extra></extra>",
            )
        ]
    )

    fig.update_traces(
        textfont=dict(color="rgba(255,255,255,0.92)", size=13),
        marker=dict(
            line=dict(color="rgba(0,0,0,0)", width=0)
        ),
    )

    fig.update_layout(
        title=dict(
            text="Registered vs Rejected vs Spoilt Votes",
            x=0.5,
            y=0.95,
            xanchor="center",
            yanchor="top",
            font=dict(size=16, color="rgba(255,255,255,0.85)", weight=700),
        ),

        height=200,
        margin=dict(l=28, r=140, t=60, b=28),

        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="rgba(255,255,255,0.85)"),

        legend=dict(
            x=1.02,
            y=0.5,
            xanchor="left",
            yanchor="middle",
            bgcolor="rgba(0,0,0,0)",
            font=dict(size=12, color="rgba(255,255,255,0.78)"),
        ),
    )

    return fig



def parse_candidates(parties):
    party_to_candidates = []
    max_len = 0

    def split_candidates(value):
        if value is None:
            return []

        s = str(value).strip()
        if not s:
            return []

        # Support both ";" and "|" delimiters
        raw = []
        for chunk in s.split(";"):
            raw.extend(chunk.split("|"))

        return [c.strip() for c in raw if c.strip()]

    for p in parties:
        party = p.get("party") or ""
        full_name = p.get("party_full_name") or ""
        cand_str = p.get("candidates") or ""
        cand_list = split_candidates(cand_str)

        title = party
        if full_name and full_name != party:
            title = f"{party} ({full_name})"

        party_to_candidates.append((title, cand_list))
        if len(cand_list) > max_len:
            max_len = len(cand_list)

    if not party_to_candidates:
        return html.Div("No party/candidate data found.", className="muted")

    header = html.Tr([html.Th(title) for (title, _lst) in party_to_candidates])

    body_rows = []
    for i in range(max_len):
        row_cells = []
        for (_title, lst) in party_to_candidates:
            val = lst[i] if i < len(lst) else ""
            row_cells.append(html.Td(val))
        body_rows.append(html.Tr(row_cells))

    return html.Div(
        html.Table(
            [html.Thead(header), html.Tbody(body_rows)],
            className="cand-table",
        ),
        className="cand-table-wrap",
    )


# ----------------------------
# Dash app (mounted under /dash/)
# ----------------------------
app = Dash(
    __name__,
    requests_pathname_prefix="/dash/",
    routes_pathname_prefix="/dash/",
    suppress_callback_exceptions=True,
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

def render_search_tab():
    return html.Div(
        [
            html.Div(
                [
                    html.Div(
                        [
                            html.Label("Year", className="label"),
                            dcc.Dropdown(
                                id="dd-years",
                                options=[],
                                value=[],
                                multi=True,
                                placeholder="All years",
                                className="control",
                            ),
                        ],
                        className="field field--year",
                    ),
                    html.Div(
    [
        html.Label("Contesting party", className="label"),
        dcc.Dropdown(
            id="dd-contesting",
            options=[],
            value=[],
            multi=True,
            placeholder="All parties",
            className="control",
        ),
    ],
    className="field field--contesting",
),

                    html.Div(
                        [
                            html.Label("Winner party", className="label"),
                            dcc.Dropdown(
                                id="dd-winners",
                                options=[],
                                value=[],
                                multi=True,
                                placeholder="All parties",
                                className="control",
                            ),
                        ],
                        className="field field--winner",
                    ),
                    html.Div(
    [
        html.Label("Constituency type", className="label"),
        dcc.Dropdown(
            id="dd-types",
            options=[
                {"label": "All types", "value": ALL_VALUE},
                {"label": "GRC", "value": "GRC"},
                {"label": "SMC", "value": "SMC"},
            ],
            value=[],
            multi=True,
            placeholder="All types",
            className="control",
        ),
    ],
    className="field field--type",
),

                    html.Div(
                        [
                            html.Label("Constituency", className="label"),
                            dcc.Dropdown(
                                id="dd-consts",
                                options=[],
                                value=[],
                                multi=True,
                                searchable=True,
                                placeholder="All Constituencies",
                                className="control",
                            ),
                        ],
                        className="field field--const",
                    ),

                ],
                className="panel filters",
            ),

                        html.Div(
                [
                    html.Span("Matched entries: ", className="kpi-line-muted"),
                    html.Span(id="kpi-count", className="kpi-line-strong"),
                ],
                className="kpi-line",
            ),


html.Div(
    [
        html.Div(
            [
                # a padding shell so the table isn't hugging borders
                html.Div(
                    [
                        dash_table.DataTable(
                            id="tbl",
                            columns=[
                                {"name": "Year", "id": "year"},
                                {"name": "Constituency", "id": "constituency"},
                                {"name": "Constituency Type", "id": "constituency_type"},

                                {"name": "Contested", "id": "contested_parties", "presentation": "markdown"},
                                {"name": "Winner", "id": "winner_party", "presentation": "markdown"},

                                {"name": "Margin", "id": "margin_pct"},
                            ],
                            markdown_options={"html": True},

                            data=[],
                            sort_action="native",
                            page_size=14,
                            style_table={"overflowX": "auto"},
                            style_header={
                                "fontWeight": 700,
                                "fontSize": "12px",
                                "backgroundColor": "rgba(15, 10, 49, 0.38)",
                                "borderBottom": "1px solid rgba(255,255,255,0.10)",
                                "color": "rgba(255,255,255,0.85)",
                            },
                            style_cell={
                                "backgroundColor": "rgba(50, 49, 49, 0.78)",
                                "borderBottom": "1px solid rgba(255,255,255,0.10)",
                                "borderLeft": "1px solid rgba(255,255,255,0.10)",
                                "borderRight": "1px solid rgba(255,255,255,0.10)",
                                "borderTop": "none",
                                "color": "rgba(255,255,255,0.88)",

                                # ↓ tighten row height
                                "padding": "4px 10px",
                                "lineHeight": "1.15",
                                "fontSize": "12px",

                                "whiteSpace": "normal",
                                "height": "auto",
                                    "minWidth": "0px",   # important so width rules actually apply
                            },
                            style_cell_conditional=[
                                {"if": {"column_id": "year"}, "width": "60px", "maxWidth": "60px"},
                                {"if": {"column_id": "constituency"}, "width": "140px", "maxWidth": "140px"},
                                {"if": {"column_id": "constituency_type"}, "width": "120px", "maxWidth": "120px"},
                                {"if": {"column_id": "contested_parties"}, "width": "260px", "maxWidth": "260px"},
                                {"if": {"column_id": "winner_party"}, "width": "260px", "maxWidth": "260px"},
                                {"if": {"column_id": "margin_pct"}, "width": "60px", "maxWidth": "60px"},
                            ],
                            css=[
                            # Right-align markdown content inside specific columns
                            {
                                "selector": "td[data-dash-column='contested_parties'] div.dash-cell-value.cell-markdown",
                                "rule": "font-family: inherit; font-size: inherit; font-weight: inherit; line-height: inherit; width: 100%; display: block; text-align: right;",
                            },
                            {
                                "selector": "td[data-dash-column='winner_party'] div.dash-cell-value.cell-markdown",
                                "rule": "font-family: inherit; font-size: inherit; font-weight: inherit; line-height: inherit; width: 100%; display: block; text-align: right; ",
                            },
                        ],
                    )
                    ],
                    className="table-shell",
                )
            ],
            id="left-pane",
            className="split-left",
            # IMPORTANT: default to full width on initial load
            style={"flex": "1 1 100%", "minWidth": "0"},
        ),

        html.Div(
            [
                # Close button exists in the layout always (prevents "nonexistent object" errors)
                html.Button(
    "×",
    id="btn-close-details",
    n_clicks=0,
    className="detail-close-x",
    type="button",
    **{"aria-label": "Close details"},
),


                html.Div(
                    id="details-panel",
                    className="panel details-panel",
                    style={"display": "none"},
                ),
            ],
            id="right-pane",
            className="split-right",
            style={"display": "none", "flex": "1 1 50%", "minWidth": "0"},
        ),
    ],
    id="split-wrap",
    className="split-wrap",
),


        ]
    )


def render_summary_tab():
    return html.Div(
        [
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

# ----------------------------
# Layout
# ----------------------------
app.layout = html.Div(
    [
        dcc.Interval(id="boot", interval=80, n_intervals=0, max_intervals=1),

        html.Div(id="auth-warning", className="alert", style={"display": "none"}),

        dcc.Store(id="store-options", data=None),
        dcc.Store(id="store-expanded", data=None),
        dcc.Store(id="store-active-row", data=None),

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
            children=render_search_tab(),  # IMPORTANT: so tbl exists on initial load
        ),

    ],
    className="page",
)



app.validation_layout = html.Div(
    [
        app.layout,
        render_search_tab(),
        render_summary_tab(),
    ]
)

@app.callback(
    Output("tbl", "style_data_conditional"),
    Input("store-active-row", "data"),
)
def style_selected_row(active_row):
    styles = [
        # keep margin formatting
        {
            "if": {"column_id": "margin_pct"},
            "fontVariantNumeric": "tabular-nums",
        },
    ]

    if isinstance(active_row, int) and active_row >= 0:
        selected_bg = "rgba(50, 49, 49, 0.38)"
        selected_border = "1px solid rgba(33,212,253,0.35)"

        # whole row selected
        styles.insert(
            0,
            {
                "if": {"row_index": active_row},
                "backgroundColor": selected_bg,
                "border": selected_border,
                "color": "rgba(255,255,255,0.98)",
            },
        )

        # disable hover effect for the selected row by forcing same styles on hover
        styles.insert(
            1,
            {
                "if": {"state": "hover", "row_index": active_row},
                "backgroundColor": selected_bg,
                "border": selected_border,
                "color": "rgba(255,255,255,0.98)",
            },
        )


    return styles

@app.callback(
    Output("tab-content", "children"),
    Input("tabs", "value"),
)
def switch_tab(tab_value):
    if tab_value == "tab-summary":
        return render_summary_tab()
    return render_search_tab()

@app.callback(
    Output("store-expanded", "data"),
    Output("store-active-row", "data"),
    Input("tbl", "active_cell"),
    Input("btn-close-details", "n_clicks"),
    Input("boot", "n_intervals"),
    State("tbl", "data"),
    State("store-expanded", "data"),
    prevent_initial_call=False,
)
def manage_expansion(active_cell, close_clicks, boot_intervals, table_data, expanded_state):
    ctx = callback_context
    if not ctx.triggered:
        raise PreventUpdate

    trigger_id = ctx.triggered[0]["prop_id"].split(".")[0]

    # 1) On boot: always start collapsed
    if trigger_id == "boot":
        return None, None

    # 2) Close button: collapse + clear active row
    if trigger_id == "btn-close-details":
        if not close_clicks:
            raise PreventUpdate
        return None, None

    # 3) Table click: expand/collapse based on clicked row
    if trigger_id == "tbl":
        # When layout changes, Dash sometimes emits active_cell=None briefly.
        # Ignore that (do NOT collapse).
        if not active_cell:
            raise PreventUpdate

        if not table_data:
            raise PreventUpdate

        row_index = active_cell.get("row")
        if row_index is None:
            raise PreventUpdate

        if row_index < 0 or row_index >= len(table_data):
            raise PreventUpdate

        clicked = table_data[row_index]
        clicked_key = f"{clicked.get('year')}|{clicked.get('constituency')}"

        # Click same expanded row -> collapse
        if expanded_state and expanded_state.get("key") == clicked_key:
            return None, None

        # Expand new row
        return (
            {
                "key": clicked_key,
                "year": clicked.get("year"),
                "constituency": clicked.get("constituency"),
            },
            int(row_index),
        )

    raise PreventUpdate

@app.callback(
    Output("right-pane", "style"),
    Output("left-pane", "style"),
    Input("store-expanded", "data"),
)
def toggle_split_layout(expanded_state):
    if not expanded_state:
        return (
            {"display": "none", "flex": "1 1 0%", "minWidth": "0"},
            {"flex": "1 1 100%", "width": "100%", "minWidth": "0"},
        )

    return (
        {"display": "block", "flex": "1 1 50%", "width": "50%", "minWidth": "0"},
        {"flex": "1 1 50%", "width": "50%", "minWidth": "0"},
    )

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
    Output("dd-winners", "value"),
    Output("dd-contesting", "options"),   # NEW
    Output("dd-contesting", "value"),     # NEW
    Output("dd-consts", "options"),
    Output("dd-consts", "value"),
    Input("store-options", "data"),
    State("tabs", "value"),
)
def init_filters(options_data, _tab):
    if not options_data:
        return [], [ALL_VALUE], [], [ALL_VALUE], [], [ALL_VALUE], [], [ALL_VALUE]

    years = options_data.get("years", [])
    parties = options_data.get("parties", [])
    consts = options_data.get("constituencies", [])

    years_sorted = sorted([int(y) for y in years], reverse=True)
    year_options = [{"label": "All years", "value": ALL_VALUE}]
    year_options.extend([{"label": str(y), "value": int(y)} for y in years_sorted])

    party_options = [{"label": "All parties", "value": ALL_VALUE}]
    for p in parties:
        abbr = p.get("abbreviation")
        full_name = p.get("full_name") or ""
        if abbr:
            party_options.append({"label": f"{abbr} — {full_name}", "value": abbr})

    # NEW: contesting uses the same options as party dropdown
    contesting_options = list(party_options)

    const_options = [{"label": "All Constituencies", "value": ALL_VALUE}]
    for c in consts:
        name = c.get("constituency")
        if name:
            const_options.append({"label": str(name), "value": str(name)})

    seen = set()
    deduped = []
    for opt in const_options:
        v = opt.get("value")
        if v in seen:
            continue
        seen.add(v)
        deduped.append(opt)

    return (
        year_options, [],
        party_options, [],
        contesting_options, [],   # NEW
        deduped, []
    )

# ----------------------------
# Search + table + KPI 
# ----------------------------
@app.callback(
    Output("kpi-count", "children"),
    Output("tbl", "data"),
    Input("dd-years", "value"),
    Input("dd-winners", "value"),
    Input("dd-contesting", "value"),
    Input("dd-types", "value"),
    Input("dd-consts", "value"),
    State("store-options", "data"),
)
def update_table(years, winners, contesting, types, constituencies, options_data):
    if not options_data:
        return "—", []

    years = normalise_multi(years or [])
    winners = normalise_multi(winners or [])
    contesting = normalise_multi(contesting or [])
    types = normalise_multi(types or [])
    constituencies = normalise_multi(constituencies or [])

    years_for_query = values_for_query(years)
    winners_for_query = values_for_query(winners)
    contesting_for_query = values_for_query(contesting)
    types_for_query = values_for_query(types)
    consts_for_query = values_for_query(constituencies)

    params = {
        "years": to_csv(years_for_query),
        "winners": to_csv(winners_for_query),
        "types": to_csv(types_for_query),
        "constituencies": to_csv(consts_for_query),

        # optional backend support later; harmless now
        "contesting": to_csv(contesting_for_query),
    }

    try:
        resp = backend_get_json("/api/dashboard/search", params=params)
        rows = resp.get("rows", []) or []

        # --- Client-side filter: contesting party ---
        if contesting_for_query:
            wanted = set(str(x) for x in contesting_for_query)
            filtered = []

            for r in rows:
                contested_list = get_contesting_parties_from_row(r)
                contested_set = set(str(p) for p in contested_list)

                # keep row if ANY selected party contested here
                if contested_set.intersection(wanted):
                    filtered.append(r)

            rows = filtered

        party_map = {}
        for p in options_data.get("parties", []):
            abbr = p.get("abbreviation")
            full_name = p.get("full_name")
            if abbr:
                party_map[str(abbr)] = str(full_name or "")

        # KPI count (AFTER filtering)
        count = len(rows)

        # average turnout (AFTER filtering)
        turnout_vals = []
        for r in rows:
            t = r.get("turnout_pct")
            if t is None:
                continue
            try:
                turnout_vals.append(float(t))
            except Exception:
                pass

        # (you can display turnout somewhere later if you want)
        # turnout_txt = safe_pct(sum(turnout_vals)/len(turnout_vals), 3) if turnout_vals else "—"

        table_data = []

        for r in rows:
            year = r.get("year")
            constituency = r.get("constituency") or ""
            ctype = normalise_na(r.get("constituency_type"))
            winner = r.get("winner_party") or ""
            margin = r.get("margin_pct")

            contested_list = get_contesting_parties_from_row(r)

            table_data.append(
                {
                    "year": year,
                    "constituency": constituency,
                    "constituency_type": ctype,
                    "contested_parties": party_list_spans(contested_list, party_map),
                    "winner_party": party_span(winner, party_map),
                    "margin_pct": safe_pct(margin, digits=3),
                }
            )

        return str(len(rows)), table_data


    except Exception:
        return "—", []


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
                    f"{constituency} ({year})",
                    className="detail-title",
                ),
            ],
            className="detail-header detail-header--with-close",
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
                    className="detail-card",
                ),

                html.Div(
                    [
                        dcc.Graph(
                            figure=elector_fig,
                            config={"displayModeBar": False},
                        )
                    ],
                    className="detail-card",
                ),

                html.Div(
                    [
                        html.Div("Candidates", className="detail-section-title"),
                        candidates_block,
                    ],
                    className="detail-card",
                ),
            ],
            className="detail-stack",
        )


        return [header, content], {"display": "block"}

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("\n=== [render_details] FAILED ===")
        print("year:", year, "constituency:", constituency)
        print(tb)

        return [
            html.Div("Failed to load details.", className="muted"),
            html.Pre(str(e), className="muted", style={"whiteSpace": "pre-wrap"}),
        ], {"display": "block"}


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
        # Overall winners (count of constituencies won)
        overall = {}
        yearly = {}

        for r in rows:
            year = r.get("year")
            winner = r.get("winner_party") or "—"

            overall[winner] = overall.get(winner, 0) + 1

            if year not in yearly:
                yearly[year] = {}
            yearly[year][winner] = yearly[year].get(winner, 0) + 1

        # --- Overall: ranked horizontal bar (replaces pie) ---
        overall_items = sorted(overall.items(), key=lambda kv: kv[1], reverse=True)

        # Optional: keep top N to reduce clutter
        TOP_N = 12
        shown = overall_items[:TOP_N]
        others = overall_items[TOP_N:]

        labels = [k for (k, _v) in shown]
        values = [int(v) for (_k, v) in shown]

        if others:
            labels.append("Others")
            values.append(sum(int(v) for (_k, v) in others))

        used = set()
        bar_colors = []
        for p in labels:
            if p == "Others":
                bar_colors.append("rgba(255,255,255,0.28)")
            else:
                bar_colors.append(get_party_color(p, used))

        fig_overall = go.Figure(
            data=[
                go.Bar(
                    x=values,
                    y=labels,
                    orientation="h",
                    marker=dict(color=bar_colors),
                    hovertemplate="%{y}<br>Constituencies won: %{x}<extra></extra>",
                )
            ]
        )

        fig_overall.update_layout(
            yaxis=dict(autorange="reversed"),
            xaxis=dict(
                title="Constituencies won",
                gridcolor="rgba(255,255,255,0.08)",
                zerolinecolor="rgba(255,255,255,0.10)",
            ),
            yaxis_title="Party",
        )
        apply_dark_layout(fig_overall, "Overall: constituencies won by party", height=380)


        # Yearly stacked bar
        years_sorted = sorted([int(y) for y in yearly.keys()], reverse=True)
        parties = sorted(list(overall.keys()))

        # better ordering: show PAP/WP first in legend, then others alphabetically
        parties_sorted = []
        for p in ["PAP", "WP"]:
            if p in parties:
                parties_sorted.append(p)
        for p in parties:
            if p not in parties_sorted:
                parties_sorted.append(p)

        used = set()
        fig_yearly = go.Figure()

        for party in parties_sorted:
            y_counts = []
            for y in years_sorted:
                y_counts.append(int(yearly.get(y, {}).get(party, 0)))

            color = get_party_color(party, used)

            fig_yearly.add_trace(
                go.Bar(
                    name=party,
                    x=[str(y) for y in years_sorted],
                    y=y_counts,
                    marker=dict(color=color),
                    hovertemplate=f"{party}<br>Year: %{{x}}<br>Count: %{{y}}<extra></extra>",
                )
            )

        fig_yearly.update_layout(
            barmode="stack",
            xaxis=dict(
                title="Year",
                gridcolor="rgba(255,255,255,0.08)",
                zerolinecolor="rgba(255,255,255,0.10)",
            ),
            yaxis=dict(
                title="Constituencies won",
                gridcolor="rgba(255,255,255,0.08)",
                zerolinecolor="rgba(255,255,255,0.10)",
            ),
        )
        apply_dark_layout(fig_yearly, "Year-by-year: constituencies won", height=420)

        return fig_overall, fig_yearly

    except Exception:
        fig_overall = go.Figure()
        fig_overall.update_layout(title="Overall: failed to load")

        fig_yearly = go.Figure()
        fig_yearly.update_layout(title="Year-by-year: failed to load")

        return fig_overall, fig_yearly


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8050, debug=False)
