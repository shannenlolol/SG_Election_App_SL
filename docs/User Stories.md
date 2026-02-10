# User Stories — Singapore Election App

## Summary Table

| No. | User Story                             | As a... | I want to...                                                                                                                                               | So that...                                                         |
| --- | -------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Sign In and Maintain Session           | user    | sign in securely and remain signed in across page refreshes                                                                                                | I can use the app without repeatedly logging in                    |
| 2   | Sign Out and End Session               | user    | sign out and have my session cleared/invalidated                                                                                                           | protected pages cannot be accessed until I sign in again           |
| 3   | Navigate Between Pages                 | user    | switch between **Dashboard** and **Map** from the top navigation                                                                                           | I can move quickly between analysis and geographic views           |
| 4   | View Electoral Boundaries on Map       | user    | view constituencies on an interactive map                                                                                                                  | boundaries can be explored visually                                |
| 5   | View Electoral Boundary Details on Map | user    | hover over a constituency to see key details (name, year, type, winner, vote share)                                                               | constituency information can be understood without leaving the map |
| 6   | Filter Map Results                     | user    | filter the map by year, constituency type (SMC/GRC), contesting party, winner party, and/or constituency                                                   | the map shows only the areas I am analysing                        |
| 7   | Reset Map Filters                      | user    | reset all map filters back to defaults                                                                                                                     | I can return to an unfiltered view quickly                         |
| 8   | Automatic Map Focus                    | user    | have the map automatically focus on the selected constituency                                 | the relevant area is visible without manual panning/zooming        |
| 9   | Toggle Simple Map Style                | user    | toggle between **Default** and **Simple** basemap styles                                                                                                   | a more readable map view can be chosen when needed                 |
| 10  | Collapse / Expand Map Filters Sidebar  | user    | collapse the filters sidebar into a compact rail and reopen it                                                                                             | more map space is available when needed                            |
| 11  | View Election Dashboard Search Table   | user    | view a searchable table of constituency results (year, constituency, type, contested, winner, margin)                                                | I can browse and scan results efficiently                          |
| 12  | Filter Dashboard Search Results        | user    | filter the dashboard table by year, contesting party, winner party, constituency type, and constituency                                                    | the table matches what I am analysing                              |
| 13  | View Dashboard Search Result Details   | user    | select a row to open a side panel showing (1) votes-by-party chart, (2) registered vs rejected vs spoilt ballots chart, and (3) candidate lists per party          | I can understand the selected constituency in detail               |
| 14  | Reset Dashboard Search Filters         | user    | reset all dashboard search filters back to defaults                                                                                                        | I can restart analysis quickly without manually clearing filters   |
| 15  | View Election Dashboard Summary        | user    | view overall summary visuals (constituencies won by party; year-by-year constituencies won) and reference tables (election dates; political parties) | I can understand high-level trends and context across years        |

---

## 1. Sign In and Maintain Session

**User Story**
*As a user, I want to sign in securely and remain signed in across page refreshes so that I can use the app without repeatedly logging in.*

**Acceptance Criteria**

* The system shall provide a login form for username and password.
* The system shall validate that required fields are provided before submitting.
* The system shall authenticate against the backend and store a valid session (e.g., token/cookie).
* The system shall keep the user signed in across page refreshes until logout or session expiry.
* If authentication fails, the system shall display a clear error message and not grant access.
* If the backend is unreachable, the system shall display an error and allow the user to retry.

---

## 2. Sign Out and End Session

**User Story**
*As a user, I want to sign out and have my session cleared/invalidated so that protected pages cannot be accessed until I sign in again.*

**Acceptance Criteria**

* The system shall provide a logout action that is accessible when signed in.
* Triggering logout shall remove/clear session credentials on the client (and invalidate on server if implemented).
* After logout, the system shall redirect the user to the login page.
* After logout, protected pages (Dashboard/Map) shall not be accessible without signing in again.
* If the user attempts to access a protected route while signed out, the system shall redirect to login.

---

## 3. Navigate Between Pages

**User Story**
*As a user, I want to switch between Dashboard and Map from the top navigation so that I can move quickly between analysis and geographic views.*

**Acceptance Criteria**

* The system shall display top navigation links for **Dashboard** and **Map**.
* Clicking a navigation link shall route to the corresponding page without a full reload.
* The active page shall be visually indicated in the navigation.
* Navigation to protected pages shall require an authenticated session.
* If navigation fails (e.g., route error), a clear error or fallback shall be displayed.

---

## 4. View Electoral Boundaries on Map

**User Story**
*As a user, I want to view constituencies on an interactive map so that boundaries can be explored visually.*

**Acceptance Criteria**

* The system shall load and render constituency boundaries for the selected year.
* Constituencies shall be displayed as polygon overlays with visible borders.
* The user shall be able to pan and zoom using standard map interactions.
* If boundary data fails to load, the system shall display a clear error and show the basemap only.
* Loading states shall be shown while boundaries are being fetched/rendered.

---

## 5. View Electoral Boundary Details on Map

**User Story**
*As a user, I want to hover over a constituency to see key details (name, year, type, winner, vote share) so that constituency information can be understood without leaving the map.*

**Acceptance Criteria**

* Hovering over a constituency shall show a tooltip/popup containing:

  * Constituency name
  * Election year
  * Constituency type (SMC/GRC)
  * Winner party
  * Vote share breakdown for contesting parties (where available)
* Tooltips/popups shall disappear when the cursor leaves the constituency (or when closed, if click-based).
* If vote share is unavailable (e.g., walkover), the system shall display an appropriate label instead of blank values.
* Tooltip/popup content shall match the currently applied filters and selected year.

---

## 6. Filter Map Results

**User Story**
*As a user, I want to filter the map by year, constituency type (SMC/GRC), contesting party, winner party, and/or constituency so that the map shows only the areas I am analysing.*

**Acceptance Criteria**

* The system shall provide filter controls for:

  * Year
  * Constituency type
  * Contesting party
  * Winner party
  * Constituency
* Changing filters shall update the visible map polygons accordingly.
* The system shall show the number of matched areas (e.g., “Matched areas: X / Y”).
* Filters shall be combinable (multiple filters applied simultaneously).
* If no constituencies match the filters, the system shall show an informative empty state.

---

## 7. Reset Map Filters

**User Story**
*As a user, I want to reset all map filters back to defaults so that I can return to an unfiltered view quickly.*

**Acceptance Criteria**

* The system shall provide a **Reset** control in the map filter panel.
* Clicking reset shall restore all map filters to their default values.
* After reset, all constituencies for the default year scope shall be displayed again.
* Matched areas count shall update immediately after reset.

---

## 8. Automatic Map Focus

**User Story**
*As a user, I want the map to automatically focus on the selected constituency so that the relevant area is visible without manual panning/zooming.*

**Acceptance Criteria**

* When a constituency is selected (e.g., via constituency dropdown or map interaction), the map shall zoom/pan to fit the constituency bounds with padding.
* Focusing shall account for the sidebar width so the constituency is centred within the visible map area.
* If the constituency geometry is unavailable, the system shall display a clear error and avoid incorrect focusing behaviour.
* If multiple constituencies are displayed and none is selected, the system shall not force map focus changes.

---

## 9. Toggle Simple Map Style

**User Story**
*As a user, I want to toggle between Default and Simple basemap styles so that a more readable map view can be chosen when needed.*

**Acceptance Criteria**

* The system shall provide a basemap toggle (e.g., **Default** / **Simple**).
* Switching basemap styles shall update the tile layer without clearing constituency overlays.
* Switching styles shall preserve current filters, current year, and current selection.
* If the selected basemap fails to load, the system shall fall back gracefully and show an error message.

---

## 10. Collapse / Expand Map Filters Sidebar

**User Story**
*As a user, I want to collapse the filters sidebar into a compact rail and reopen it so that more map space is available when needed.*

**Acceptance Criteria**

* The system shall provide a control to collapse/expand the sidebar.
* When collapsed, the sidebar shall reduce to a compact rail while remaining accessible.
* When expanded, all filter controls shall be visible and usable.
* The map shall resize correctly when the sidebar state changes (no broken tiles or incorrect bounds).
* Map focusing behaviour shall reflect the sidebar state.

---

## 11. View Election Dashboard Search Table

**User Story**
*As a user, I want to view a searchable table of constituency results (year, constituency, type, contested, winner, margin) so that I can browse and scan results efficiently.*

**Acceptance Criteria**

* The system shall display a table containing at minimum:

  * Year
  * Constituency
  * Constituency type (SMC/GRC)
  * Contested parties
  * Winner party
  * Margin
* The system shall display the total number of matched entries.
* The table shall support sorting (at least by year and constituency) if enabled in the UI.
* If no entries match the current filters, an informative empty state shall be shown.

---

## 12. Filter Dashboard Search Results

**User Story**
*As a user, I want to filter the dashboard table by year, contesting party, winner party, constituency type, and constituency so that the table matches what I am analysing.*

**Acceptance Criteria**

* The system shall provide filter controls for:

  * Year
  * Contesting party
  * Winner party
  * Constituency type
  * Constituency
* Changing filters shall update the table rows accordingly.
* Filters shall be combinable and applied together.
* The matched entries count shall update when filters change.
* If filters produce zero results, the system shall show an informative empty state.

---

## 13. View Dashboard Search Result Details

**User Story**
*As a user, I want to select a row to open a side panel showing (1) votes-by-party chart, (2) registered vs rejected vs spoilt ballots chart, and (3) candidate lists per party so that I can understand the selected constituency in detail.*

**Acceptance Criteria**

* Selecting a table row shall open a side panel for that constituency and year.
* The side panel shall display:

  * A votes-by-party chart for contesting parties (where available)
  * A chart summarising registered electors vs rejected votes vs spoilt ballot papers (where available)
  * Candidate lists grouped by party
* The side panel shall display the constituency name and year clearly.
* The side panel shall provide a close action that returns the user to the table view.
* If some datasets are missing (e.g., candidates not available), the panel shall show an informative fallback rather than failing.

---

## 14. Reset Dashboard Search Filters

**User Story**
*As a user, I want to reset all dashboard search filters back to defaults so that I can restart analysis quickly without manually clearing filters.*

**Acceptance Criteria**

* The system shall provide a **Reset** control for dashboard search filters.
* Clicking reset shall restore all dashboard search filters to their default values.
* The table shall reload to show the default (unfiltered) results set.
* Matched entries count shall update immediately after reset.
* Any open side panel may either remain open (with the same selection) or close consistently based on defined behaviour, but the behaviour shall be consistent.

---

## 15. View Election Dashboard Summary

**User Story**
*As a user, I want to view overall summary visuals (constituencies won by party; year-by-year constituencies won) and reference tables (election dates; political parties) so that I can understand high-level trends and context across years.*

**Acceptance Criteria**

* The system shall display overall summary visuals including:

  * Constituencies won by party (overall)
  * Year-by-year constituencies won (stacked or grouped by party)
* The system shall display reference tables including:

  * Election dates (e.g., nomination day, polling day)
  * Political parties (abbreviation and full name)
* Summary visuals and tables shall load correctly with clear loading/error states.
* If summary data cannot be loaded, the system shall show a clear error while keeping the rest of the page usable where possible.
