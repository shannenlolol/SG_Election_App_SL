# Software Design Description

## Sequence Diagrams

The following diagrams show how the **user**, the **React application**, and the **Election Backend APIs** collaborate to implement each feature.

* `App` represents the main React root (`App.jsx`) and shared layout/navigation.
* `RequireAuth` represents the route guard (e.g., `RequireAuth.jsx`) that blocks protected routes when unauthenticated.
* `MapPage` represents the Map route/page (filters + Leaflet map).
* `DashboardPage` represents the Dashboard route/page (search table + filters + side panel + summary).
* `MapView` represents the Leaflet map component used by `MapPage`.
* `ElectionAPI` represents the backend endpoints under `/api/*` that read from MySQL (synced from data.gov.sg).

---

| No. | User Story                             | Sequence Diagram Focus                                                                    |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Sign In and Maintain Session           | Login flow; setting `token` cookie; session persistence after refresh via auth probe      |
| 2   | Sign Out and End Session               | Logout flow; clearing `token` cookie; protected routes blocked after logout               |
| 3   | Navigate Between Pages                 | Client-side routing between Dashboard and Map with auth gating                            |
| 4   | View Electoral Boundaries on Map       | Loading year boundaries via `/api/boundaries` and rendering GeoJSON polygons              |
| 5   | View Electoral Boundary Details on Map | Tooltip uses merged boundary + `/api/boundaries/summary` (winner + vote shares)           |
| 6   | Filter Map Results                     | Filters update visible polygons; year change triggers boundaries + summary reload         |
| 7   | Reset Map Filters                      | Reset restores defaults and redraws full set                                              |
| 8   | Automatic Map Focus                    | Fit bounds to selected constituency with sidebar-aware padding                            |
| 9   | Toggle Simple Map Style                | Swapping basemap tile layer without clearing overlays                                     |
| 10  | Collapse / Expand Map Filters Sidebar  | Sidebar width changes layout; map invalidation; focus padding updates                     |
| 11  | View Election Dashboard Search Table   | Bootstrapping via `/api/dashboard/options`, then loading rows via `/api/dashboard/search` |
| 12  | Filter Dashboard Search Results        | Filter changes trigger refetch from `/api/dashboard/search`                               |
| 13  | View Dashboard Search Result Details   | Row selection loads detail payload via `/api/dashboard/details`                           |
| 14  | Reset Dashboard Search Filters         | Reset filters; table reload; consistent side panel behaviour                              |
| 15  | View Election Dashboard Summary        | Summary uses `/api/dashboard/search` (unfiltered) for aggregation + `/options` for tables |

---

## 1. Sign In and Maintain Session

```mermaid
sequenceDiagram
    participant User
    participant LoginPage
    participant App
    participant ElectionAPI as Election API

    User->>LoginPage: Enter username + password, click Sign In
    LoginPage->>LoginPage: Validate required fields

    alt Invalid fields
        LoginPage->>User: Show validation errors
    else Valid fields
        LoginPage->>ElectionAPI: POST /api/auth/login
        ElectionAPI-->>LoginPage: 200 OK or 401
        Note over ElectionAPI,LoginPage: 200 sets cookie token=<jwt>

        alt Auth failed
            LoginPage->>User: Show "Invalid credentials"
        else Auth success
            LoginPage->>App: setAuthState(authenticated=true)
            App->>User: Route to /dashboard or /map
        end
    end

```

**Explanation:**
A server-issued JWT cookie (`token`) is used so the user remains signed in across refreshes until logout/expiry. Auth state can be restored by calling any protected endpoint (here, `/api/dashboard/options`).

---

## 2. Sign Out and End Session

```mermaid
sequenceDiagram
    participant User
    participant App
    participant RequireAuth
    participant ElectionAPI as Election API

    User->>App: Click Logout
    App->>ElectionAPI: POST /api/auth/logout
    ElectionAPI-->>App: 200 OK
    Note over ElectionAPI,App: Clears cookie token

    App->>App: Clear client auth state
    App->>User: Redirect to Login

    User->>RequireAuth: Open /dashboard or /map
    RequireAuth->>ElectionAPI: GET /api/dashboard/options
    ElectionAPI-->>RequireAuth: 401 Unauthorized
    RequireAuth->>User: Redirect to Login
```

**Explanation:**
Logout clears the `token` cookie, and protected routes are blocked by re-checking authentication via a protected endpoint.

---

## 3. Navigate Between Pages

```mermaid
sequenceDiagram
    participant User
    participant App
    participant RequireAuth
    participant DashboardPage
    participant MapPage

    User->>App: Click "Dashboard" in top nav
    App->>RequireAuth: Check access for /dashboard
    RequireAuth-->>App: Allowed
    App->>DashboardPage: Render Dashboard view

    User->>App: Click "Map" in top nav
    App->>RequireAuth: Check access for /map
    RequireAuth-->>App: Allowed
    App->>MapPage: Render Map view
```

---

## 4. View Electoral Boundaries on Map

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView
    participant ElectionAPI as Election API

    User->>MapPage: Open Map page
    MapPage->>MapPage: Determine selectedYear
    MapPage->>ElectionAPI: GET /api/boundaries?year=YYYY
    ElectionAPI-->>MapPage: 200 OK + GeoJSON FeatureCollection

    MapPage->>MapView: boundariesGeoJson prop updated
    MapView->>User: Render constituency polygons + borders

```

---

## 5. View Electoral Boundary Details on Map

```mermaid
sequenceDiagram
    participant User
    participant MapView
    participant MapPage
    participant ElectionAPI as Election API

    Note over MapPage: Preload results summary for selected year
    MapPage->>ElectionAPI: GET /api/boundaries/summary?year=YYYY
    ElectionAPI-->>MapPage: 200 OK (winnerParty + votePct per party, keyed by boundary name)

    User->>MapView: Hover constituency polygon
    MapView->>MapView: Read boundary properties (e.g., ED_DESC_FU)
    MapView->>MapPage: Request tooltip data for constituencyKey
    MapPage->>MapPage: Join boundary metadata + summary[key] in memory
    MapPage-->>MapView: Tooltip payload (name, year, type, winnerParty, party votePct map)

    MapView->>User: Tooltip shows winner + vote share breakdown
```

---

## 6. Filter Map Results

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView
    participant ElectionAPI as Election API

    User->>MapPage: Change filters (year/type/parties/constituency)

    alt Year changed
        MapPage->>ElectionAPI: GET /api/boundaries?year=YYYY
        ElectionAPI-->>MapPage: 200 OK + GeoJSON
        MapPage->>ElectionAPI: GET /api/boundaries/summary?year=YYYY
        ElectionAPI-->>MapPage: 200 OK + summary
    else Same year
        MapPage->>MapPage: Update filter state only
    end

    MapPage->>MapPage: Apply filter predicate to boundary features (client-side)
    MapPage->>MapView: filteredGeoJson updated
    MapView->>User: Visible polygons update
    MapPage->>User: Matched areas count updates
```

---

## 10. Collapse / Expand Map Filters Sidebar

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView

    User->>MapPage: Click collapse/expand sidebar
    MapPage->>MapPage: setSidebarCollapsed(true/false)
    MapPage->>MapView: sidebarInsetPx updated

```

---

## 11. View Election Dashboard Search Table

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Open Dashboard page
    DashboardPage->>ElectionAPI: GET /api/dashboard/options
    ElectionAPI-->>DashboardPage: 200 OK (years, parties, constituencies, election_dates) OR 401

    DashboardPage->>DashboardPage: Initialise default filters
    DashboardPage->>ElectionAPI: GET /api/dashboard/search?years=...&winners=...&types=...&constituencies=...&contesting=...
    ElectionAPI-->>DashboardPage: 200 OK + rows OR error
    DashboardPage->>User: Render table rows + matched count

```

---

## 12. Filter Dashboard Search Results

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Change dashboard filters
    DashboardPage->>DashboardPage: Update filter state
    DashboardPage->>ElectionAPI: GET /api/dashboard/search?...updated filters...
    ElectionAPI-->>DashboardPage: 200 OK + updated rows
    DashboardPage->>User: Table + matched count update
```

---

## 13. View Dashboard Search Result Details

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Click a table row (year + constituency)
    DashboardPage->>DashboardPage: Open SidePanel (loading state)
    DashboardPage->>ElectionAPI: GET /api/dashboard/details?year=YYYY&constituency=NAME
    ElectionAPI-->>DashboardPage: 200 OK (parties + elector) OR error

    DashboardPage->>User: Render votes-by-party chart + elector chart + candidate lists
```

---

## 14. Reset Dashboard Search Filters

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Click Reset (Dashboard filters)
    DashboardPage->>DashboardPage: Restore default filter values
    DashboardPage->>ElectionAPI: GET /api/dashboard/search?...defaults...
    ElectionAPI-->>DashboardPage: 200 OK + default rows
    DashboardPage->>User: Table resets to default results
```

---

## 15. View Election Dashboard Summary

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Switch to Summary tab
    DashboardPage->>ElectionAPI: GET /api/dashboard/options
    ElectionAPI-->>DashboardPage: 200 OK (election_dates, parties)

    DashboardPage->>ElectionAPI: GET /api/dashboard/search (no filters)
    ElectionAPI-->>DashboardPage: 200 OK + rows

    DashboardPage->>User: Render summary charts + reference tables with loading/error states
```

---
