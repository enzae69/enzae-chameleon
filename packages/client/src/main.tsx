import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Note: no <StrictMode> — it double-invokes effects in dev, which would
// double-initialise the Colyseus connection and the WebGL canvas.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
