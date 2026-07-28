import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import PaywallGate from "./PaywallGate.jsx";
import { AuthProvider } from "./lib/AuthProvider.jsx";
import { supabaseConfigured } from "./lib/supabaseClient.js";
import "./index.css";

function ConfigError() {
  return (
    <div style={{ minHeight: "100vh", background: "#14171C", color: "#EDE7D8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", padding: "2rem", textAlign: "center" }}>
      Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in your environment and rebuild.
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {supabaseConfigured ? (
      <AuthProvider>
        <AuthGate>
          <PaywallGate>
            <App />
          </PaywallGate>
        </AuthGate>
      </AuthProvider>
    ) : (
      <ConfigError />
    )}
  </React.StrictMode>
);
