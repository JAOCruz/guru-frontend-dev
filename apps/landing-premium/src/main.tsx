import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { startSmoothScroll } from "./lib/smoothScroll";
import { startAnalytics } from "./lib/analytics";

if (!new URLSearchParams(window.location.search).get("capture")) {
  startSmoothScroll();
  startAnalytics();
}

const capture = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("capture") : null;
if (capture) {
  // dev-only: render the delivery flight for the scroll video (tools/delivery-video)
  import("./three/city/CaptureDelivery").then(({ default: CaptureDelivery }) =>
    ReactDOM.createRoot(document.getElementById("root")!).render(<CaptureDelivery mobile={capture === "mobile"} />),
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
