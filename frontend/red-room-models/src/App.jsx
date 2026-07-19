import { useState } from "react";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import Home from "./components/Home.jsx";
import Marketplace from "./components/Marketplace.jsx";
import PersonaDetail from "./components/PersonaDetail.jsx";
import CreatorStudio from "./components/CreatorStudio.jsx";
import Checkout from "./components/Checkout.jsx";
import TrustPolicy from "./components/TrustPolicy.jsx";

export default function App() {
  const [view, setView] = useState("home");
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [order, setOrder] = useState(null);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const navigate = (next) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectPersona = (id) => {
    setSelectedPersonaId(id);
    navigate("persona");
  };

  const startCheckout = (nextOrder) => {
    setOrder(nextOrder);
    navigate("checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <NavBar view={view} onNavigate={navigate} user={user} onOpenAuth={() => setAuthOpen(true)} />

      <main className="flex-1">
        {view === "home" && <Home onNavigate={navigate} onSelectPersona={selectPersona} />}
        {view === "marketplace" && <Marketplace onSelectPersona={selectPersona} />}
        {view === "persona" && (
          <PersonaDetail
            personaId={selectedPersonaId}
            onBack={() => navigate("marketplace")}
            onCheckout={startCheckout}
          />
        )}
        {view === "studio" && <CreatorStudio />}
        {view === "checkout" && (
          <Checkout order={order} onBack={() => navigate("persona")} onNavigate={navigate} />
        )}
        {view === "policy" && <TrustPolicy />}
      </main>

      <Footer onNavigate={navigate} />

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(u) => {
            setUser(u);
            setAuthOpen(false);
            if (u.role === "creator") navigate("studio");
          }}
        />
      )}
    </div>
  );
}
