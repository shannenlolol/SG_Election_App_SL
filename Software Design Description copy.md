# Software Design Description

## Sequence Diagrams

The following diagrams show how the **user**, the **React application**, and the **Election Backend APIs** collaborate to implement each feature.

* `App` represents the main React root (`App.jsx`) and shared layout/navigation.
* `RequireAuth` represents the route guard (e.g., `RequireAuth.jsx`) that blocks protected routes when unauthenticated.
* `MapPage` represents the Map route/page (filters + Leaflet map).
* `DashboardPage` represents the Dashboard route/page (search table + filters + side panel + summary).
* `MapView` represents the Leaflet map component used by `MapPage`.
* `ElectionAPI` represents the backend endpoints that read from MySQL (synced from data.gov.sg).

---

| No. | User Story                             | Sequence Diagram Focus                                                                  |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Sign In and Maintain Session           | Login flow; storing session (cookie/token); session persistence after refresh           |
| 2   | Sign Out and End Session               | Logout flow; clearing session; blocking protected routes                                |
| 3   | Navigate Between Pages                 | Client-side routing between Dashboard and Map with auth gating                          |
| 4   | View Electoral Boundaries on Map       | Loading year boundaries and rendering GeoJSON polygons                                  |
| 5   | View Electoral Boundary Details on Map | Hover tooltip reads merged boundary + results summary (winner, vote share)              |
| 6   | Filter Map Results                     | Filters update visible polygons (year/type/parties/constituency)                        |
| 7   | Reset Map Filters                      | Reset restores defaults and redraws full set                                            |
| 8   | Automatic Map Focus                    | Fit bounds to selected constituency with sidebar-aware padding                          |
| 9   | Toggle Simple Map Style                | Swapping basemap tile layer without clearing overlays                                   |
| 10  | Collapse / Expand Map Filters Sidebar  | Sidebar width changes layout; map invalidation; focus padding updates                   |
| 11  | View Election Dashboard Search Table   | Fetching paged/filtered search rows for the table                                       |
| 12  | Filter Dashboard Search Results        | Filter changes trigger refetch and update counts                  |
| 13  | View Dashboard Search Result Details   | Row selection loads detail payload for charts + candidate lists in side panel           |
| 14  | Reset Dashboard Search Filters         | Reset dashboard filters; table reload; consistent side panel behaviour                  |
| 15  | View Election Dashboard Summary        | Loading summary charts + reference tables (dates/parties) with independent error states |

---

## 1. Sign In and Maintain Session

```mermaid
sequenceDiagram
    participant User
    participant LoginPage
    participant App
    participant ElectionAPI as Election API

    User->>LoginPage: Enter username/password + click Sign In
    LoginPage->>LoginPage: Validate required fields

    alt Invalid fields
        LoginPage->>User: Show inline validation errors
    else Valid fields
        LoginPage->>ElectionAPI: POST /auth/login { username, password }
        ElectionAPI-->>LoginPage: 200 OK (Set-Cookie session/token) OR 401

        alt Auth failed
            LoginPage->>User: Show "Invalid credentials" error
        else Auth success
            LoginPage->>App: setAuthState(authenticated=true)
            App->>User: Route to protected page (Dashboard/Map)
        end
    end

    Note over User,App: Page refresh / revisit
    User->>App: Refresh page
    App->>ElectionAPI: GET /auth/me
    ElectionAPI-->>App: 200 OK (user info) OR 401

    alt Session valid
        App->>App: Keep authenticated state
        App->>User: Protected pages remain accessible
    else Session invalid/expired
        App->>App: Clear auth state
        App->>User: Redirect to Login
    end
```

**Explanation:**
A server-issued session (cookie/token) is used so the user remains signed in across refreshes until logout/expiry.

---

## 2. Sign Out and End Session

```mermaid
sequenceDiagram
    participant User
    participant App
    participant RequireAuth
    participant ElectionAPI as Election API

    User->>App: Click Logout
    App->>ElectionAPI: POST /auth/logout
    ElectionAPI-->>App: 200 OK (cookie cleared/invalidated)

    App->>App: Clear client auth state
    App->>User: Redirect to Login

    User->>RequireAuth: Attempt to open /dashboard or /map
    RequireAuth->>ElectionAPI: GET /auth/me
    ElectionAPI-->>RequireAuth: 401 Unauthorized
    RequireAuth->>User: Redirect to Login
```

**Explanation:**
Logout clears session credentials and prevents access to protected routes.

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

**Explanation:**
Navigation is client-side routing; auth gating is applied before protected pages render.

---

## 4. View Electoral Boundaries on Map

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView
    participant ElectionAPI as Election API

    User->>MapPage: Open Map page
    MapPage->>MapPage: Determine selectedYear (default or user-chosen)
    MapPage->>ElectionAPI: GET /map/boundaries?year=YYYY
    ElectionAPI-->>MapPage: 200 OK + GeoJSON FeatureCollection OR error

    alt Load error
        MapPage->>User: Show error + keep basemap only
    else Success
        MapPage->>MapView: boundariesGeoJson prop updated
        MapView->>User: Render constituency polygons + borders
    end
```

**Explanation:**
Map boundaries are fetched for the selected year and rendered as GeoJSON polygons on Leaflet.

---

## 5. View Electoral Boundary Details on Map

```mermaid
sequenceDiagram
    participant User
    participant MapView
    participant MapPage
    participant ElectionAPI as Election API

    Note over MapPage: Preload summary data for the selected year
    MapPage->>ElectionAPI: GET /map/summary?year=YYYY
    ElectionAPI-->>MapPage: 200 OK (winner + vote share per constituency)

    User->>MapView: Hover constituency polygon
    MapView->>MapView: Read boundary properties (name/type)
    MapView->>MapPage: Request tooltip data for constituencyKey
    MapPage->>MapPage: Join boundary + summary data in memory
    MapPage-->>MapView: Tooltip payload (name, year, type, winner, shares)


    MapView->>User: Tooltip shows winner + vote share breakdown

```

**Explanation:**
Hover tooltips are built by combining boundary metadata with year-level results summary.

---

## 6. Filter Map Results

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView

    User->>MapPage: Change filters (year/type/parties/constituency)
    alt Year changed
        MapPage->>MapPage: setSelectedYear(YYYY)
        MapPage->>MapPage: Trigger boundary + summary reload for year
    else Same year
        MapPage->>MapPage: Update filter state only
    end

    MapPage->>MapPage: Apply filter predicate to boundary features
    MapPage->>MapView: filteredGeoJson updated
    MapView->>User: Visible polygons update
    MapPage->>User: Matched areas count updates
```

**Explanation:**
Filters update the displayed set of constituencies; a year change triggers dataset reload.

---

## 7. Reset Map Filters

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView

    User->>MapPage: Click Reset (Map filters)
    MapPage->>MapPage: Restore default filter values
    MapPage->>MapPage: Recompute filteredGeoJson
    MapPage->>MapView: filteredGeoJson updated
    MapView->>User: All default-scope polygons shown again
    MapPage->>User: Matched areas count resets
```

**Explanation:**
Reset restores defaults and redraws the unfiltered map scope.

---

## 8. Automatic Map Focus

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView

    User->>MapPage: Select constituency
    MapPage->>MapPage: Set selectedConstituency
    MapPage->>MapView: focusTarget updated (geometry/bounds + sidebarInsetPx)

    MapView->>MapView: Compute bounds
    MapView->>MapView: fitBounds(bounds, paddingLeft=sidebarInsetPx)
    MapView->>User: Selected constituency centred and visible
```

**Explanation:**
Selecting a constituency triggers `fitBounds`, using sidebar-aware padding so it does not sit under the filters panel.

---

## 9. Toggle Simple Map Style

```mermaid
sequenceDiagram
    participant User
    participant MapPage
    participant MapView

    User->>MapPage: Toggle basemap (Default/Simple)
    MapPage->>MapPage: setBasemapStyle("default" | "simple")
    MapPage->>MapView: basemapStyle prop updated
    MapView->>MapView: Swap TileLayer URL
    MapView->>User: Basemap changes, polygons remain intact
```

**Explanation:**
Basemap toggling swaps the tile source without clearing constituency overlays.

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

**Explanation:**
Sidebar width changes require Leaflet resize invalidation and updated focus padding.

---

## 11. View Election Dashboard Search Table

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Open Dashboard page
    DashboardPage->>DashboardPage: Initialise default filters
    DashboardPage->>ElectionAPI: GET /dashboard/search?year=...&type=...&winner=...&contesting=...&q=...&page=1&pageSize=...
    ElectionAPI-->>DashboardPage: 200 OK + rows + totalCount OR error

    DashboardPage->>User: Render table rows + matched count
```

**Explanation:**
The dashboard table loads from a search endpoint (often backed by `ge_summary`) and shows count + rows.

---

## 12. Filter Dashboard Search Results

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Change dashboard filters
    DashboardPage->>DashboardPage: Update filter state
    DashboardPage->>ElectionAPI: GET /dashboard/search?...updated filters...
    ElectionAPI-->>DashboardPage: 200 OK + updated rows + totalCount
    DashboardPage->>User: Table + matched count update
```

**Explanation:**
Filter changes trigger a new search query to keep the table consistent with analysis intent.

---

## 13. View Dashboard Search Result Details

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Click a table row (year + constituency)
    DashboardPage->>DashboardPage: Open SidePanel (loading state)
    DashboardPage->>ElectionAPI: GET /dashboard/details?year=YYYY&constituency=NAME
    ElectionAPI-->>DashboardPage: 200 OK (partyVotes, electorStats, candidatesByParty) OR partial/missing fields OR error

    DashboardPage->>User: Render votes-by-party chart + elector chart + candidate lists
```

**Explanation:**
Row selection opens a details panel driven by a single consolidated details endpoint.

---

## 14. Reset Dashboard Search Filters

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: Click Reset (Dashboard filters)
    DashboardPage->>DashboardPage: Restore default filter values
    DashboardPage->>ElectionAPI: GET /dashboard/search?...defaults...
    ElectionAPI-->>DashboardPage: 200 OK + default rows + totalCount
    DashboardPage->>User: Table resets to default results
```

**Explanation:**
Reset reloads the default dataset view. 

---

## 15. View Election Dashboard Summary

```mermaid
sequenceDiagram
    participant User
    participant DashboardPage
    participant ElectionAPI as Election API

    User->>DashboardPage: View Summary section
    par Load charts
        DashboardPage->>ElectionAPI: GET /summary/constituencies-won-by-party
        ElectionAPI-->>DashboardPage: 200 OK + chart series OR error
        DashboardPage->>ElectionAPI: GET /summary/year-by-year-wins
        ElectionAPI-->>DashboardPage: 200 OK + chart series OR error
    and Load reference tables
        DashboardPage->>ElectionAPI: GET /reference/election-dates
        ElectionAPI-->>DashboardPage: 200 OK + dates OR error
        DashboardPage->>ElectionAPI: GET /reference/political-parties
        ElectionAPI-->>DashboardPage: 200 OK + parties OR error
    end

    DashboardPage->>User: Render each component with its own loading/error state
```

**Explanation:**
Summary charts and reference tables are best loaded independently so one failing component does not block the rest of the dashboard.

---
