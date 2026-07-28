import { useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { useModels } from "./hooks/useModels.js";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import Home from "./components/Home.jsx";
import Marketplace from "./components/Marketplace.jsx";
import PersonaDetail from "./components/PersonaDetail.jsx";
import CreatorStudio from "./components/CreatorStudio.jsx";
import MyModels from "./components/MyModels.jsx";
import Checkout from "./components/Checkout.jsx";
import TrustPolicy from "./components/TrustPolicy.jsx";

export default function App() {
  const auth = useAuth();
  const { models, findModel } = useModels();
  const [view, setView] = useState("home");
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [order, setOrder] = useState(null);
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
      <NavBar view={view} onNavigate={navigate} auth={auth} onOpenAuth={() => setAuthOpen(true)} />

      <main className="flex-1">
        {view === "home" && (
          <Home onNavigate={navigate} onSelectPersona={selectPersona} models={models} />
        )}
        {view === "marketplace" && <Marketplace onSelectPersona={selectPersona} models={models} />}
        {view === "persona" && (
          <PersonaDetail
            personaId={selectedPersonaId}
            findModel={findModel}
            onBack={() => navigate("marketplace")}
            onCheckout={startCheckout}
          />
        )}
        {view === "studio" && (
          <CreatorStudio auth={auth} onOpenAuth={() => setAuthOpen(true)} onNavigate={navigate} />
        )}
        {view === "my-models" && <MyModels auth={auth} onNavigate={navigate} />}
        {view === "checkout" && (
          <Checkout
            order={order}
            auth={auth}
            findModel={findModel}
            onBack={() => navigate("persona")}
            onNavigate={navigate}
          />
        )}
        {view === "policy" && <TrustPolicy />}
      </main>

      <Footer onNavigate={navigate} />

      {authOpen && <AuthModal auth={auth} onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
