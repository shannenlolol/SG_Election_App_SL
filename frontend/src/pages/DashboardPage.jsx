import React from "react";
import { useEffect } from "react";

const DASH_ORIGIN = "http://localhost:4000"; // change if needed
const DASH_URL = "http://localhost:4000/dash/"; // your iframe src

export default function DashboardPage() {
  const iframeRef = React.useRef(null);
  const [iframeHeight, setIframeHeight] = React.useState(1200);

  useEffect(() => {
    function onMsg(e) {
      if (!e || !e.data) return;

      // Important: ignore messages from other iframes/windows
      if (e.origin !== DASH_ORIGIN) return;

      if (e.data.type !== "DASH_HEIGHT") return;

      const next = Number(e.data.height);
      if (!Number.isFinite(next) || next <= 0) return;

      setIframeHeight((prev) => {
        if (Math.abs(prev - next) <= 2) return prev;
        return next;
      });
    }

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function requestDashHeight() {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Ask Dash to send height (handled by iframe_height.js)
    iframe.contentWindow.postMessage({ type: "DASH_HEIGHT_REQUEST" }, DASH_ORIGIN);
  }

//   return (
//     <div style={{ width: "100%" }}>
//       <iframe
//         ref={iframeRef}
//         src={DASH_URL}
//         title="Dashboard"
//         style={{
//           width: "100%",
//           height: `${iframeHeight}px`,
//           border: "0",
//           display: "block",
//         }}
//         onLoad={() => {
//           // Dash might not be ready immediately; request multiple times
//           requestDashHeight();
//           setTimeout(requestDashHeight, 200);
//           setTimeout(requestDashHeight, 800);
//           setTimeout(requestDashHeight, 1500);
//         }}
//       />
//     </div>
//   );
// }

  return (
    <div className="page-shell">
      {/* <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          Search and compare outcomes across years and constituencies.
        </div>
      </div> */}

      <div className="card-surface">
        <iframe
          ref={iframeRef}
          title="Dash Dashboard"
          src="http://localhost:4000/dash/"
          style={{
            width: "100%",
            height: iframeHeight, // from postMessage
            border: "0",
            display: "block",
            overflow: "hidden",
          }}
                  onLoad={() => {
          // Dash might not be ready immediately; request multiple times
          requestDashHeight();
          setTimeout(requestDashHeight, 200);
          setTimeout(requestDashHeight, 800);
          setTimeout(requestDashHeight, 1500);
        }}
          scrolling="no"
        />
      </div>
    </div>
  );
}
