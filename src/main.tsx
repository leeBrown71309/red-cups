import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Dev-only previews are dropped from the build: `import.meta.env.DEV` is false there.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "history") {
  void import("./dev/history-preview").then(({ HistoryPreview }) => root.render(<HistoryPreview />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
