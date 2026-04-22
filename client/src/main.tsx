import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import { registerGameEffects } from "./lib/effects/registerGameEffects";

// Wire win/lose effect handlers into the effect registry before mount.
registerGameEffects();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
