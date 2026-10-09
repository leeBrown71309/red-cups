import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Dev-only previews are dropped from the build: `import.meta.env.DEV` is false there.
if (import.meta.env.DEV) {
  void import("./dev/dev-console").then(({ installDevConsole }) => installDevConsole());
}

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "history") {
  void import("./dev/history-preview").then(({ HistoryPreview }) => root.render(<HistoryPreview />));
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "cards") {
  void import("./dev/card-gallery").then(({ CardGallery }) => root.render(<CardGallery />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
