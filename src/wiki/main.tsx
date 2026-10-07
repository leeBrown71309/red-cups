import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/buttons.css";
import "./wiki.css";
import { WikiApp } from "./wiki-app";

/**
 * The wiki is a second, standalone page of the game build (see `wiki.html`):
 * it shares the game styles, fonts and data modules but not the game store.
 */
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <WikiApp />
  </React.StrictMode>,
);
