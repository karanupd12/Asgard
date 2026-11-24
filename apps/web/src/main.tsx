import type { RuntimeConfig } from "@asgard/shared";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProviders } from "./providers/AppProviders";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Runtime config (chain, contract, gateway) comes from the API, so one build runs anywhere.
async function boot(attempt = 1): Promise<void> {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) throw new Error(`API returned ${r.status}`);
    const cfg = (await r.json()) as RuntimeConfig;
    root.render(
      <StrictMode>
        <AppProviders cfg={cfg}>
          <App />
        </AppProviders>
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <div style={{ padding: 48, fontFamily: "Inter, system-ui", textAlign: "center", color: "#8b8b96" }}>
        <h1 style={{ color: "#ededf0", fontWeight: 600 }}>Asgard is starting up…</h1>
        <p>Waiting for the API ({String((e as Error).message)}). Attempt {attempt}.</p>
      </div>,
    );
    setTimeout(() => boot(attempt + 1), Math.min(1000 * attempt, 5000));
  }
}

boot();
