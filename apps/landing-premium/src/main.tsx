import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { startSmoothScroll } from "./lib/smoothScroll";
import { startAnalytics } from "./lib/analytics";

startSmoothScroll();
startAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
