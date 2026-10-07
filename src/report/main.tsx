import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/buttons.css";
import "./report.css";
import { ReportApp } from "./report-app";

/**
 * The reporting page is a third, standalone page of the game build (see
 * `feedback.html`): it shares the game styles and the wiki's catalogue but
 * not the game store.
 */
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <ReportApp />
  </React.StrictMode>,
);
