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
    {
      const q = new URLSearchParams(window.location.search);
      const n = (k: string) => Number(q.get(k)) || 0;
      const shift = { start: [n("sx"), n("sy")] as [number, number], end: [n("ex"), n("ey")] as [number, number] };
      ReactDOM.createRoot(document.getElementById("root")!).render(<CaptureDelivery mobile={capture === "mobile"} scale={Number(q.get("scale")) || 1} shift={shift} />);
    },
  );
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
