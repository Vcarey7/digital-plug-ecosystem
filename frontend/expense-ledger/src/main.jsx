import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import PaywallGate from "./PaywallGate.jsx";
import TermsOfService from "./TermsOfService.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
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

const PUBLIC_ROUTES = ["#/terms", "#/privacy"];

function getRoute() {
  return PUBLIC_ROUTES.includes(window.location.hash) ? window.location.hash : null;
}

function goHome() {
  window.location.hash = "";
}

function Root() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "#/terms") return <TermsOfService onBack={goHome} />;
  if (route === "#/privacy") return <PrivacyPolicy onBack={goHome} />;

  if (!supabaseConfigured) return <ConfigError />;

  return (
    <AuthProvider>
      <AuthGate>
        <PaywallGate>
          <App />
        </PaywallGate>
      </AuthGate>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
