/* Entry point. Side effects only: the bridge boots the classic layer on import,
   and this file mounts React. Everything renderable lives in modules that export
   components alone, so Vite can hot-replace them without a full page reload. */
import { createRoot } from "react-dom/client";
import "./index.css";
import "@/lib/bridge";
import { App } from "@/App";

const container = document.getElementById("root");
// Vite re-runs this module on a hot update; reusing the root avoids orphaning the
// previous tree with its effects and listeners still attached.
const root = (container.__studyHubRoot ||= createRoot(container));
root.render(<App />);
