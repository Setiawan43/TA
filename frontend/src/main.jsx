import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AppComponent from "./components/App";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import "./styles/style.css";

// Re-export App for test compatibility
export { AppComponent as App };

function Root() {
  const [authView, setAuthView] = useState("login");
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      return (user && user.username) ? user : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (user) => {
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("role", user.role);
    localStorage.setItem("userId", String(user.id));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    setCurrentUser(null);
    setAuthView("login");
  };

  if (!currentUser) {
    if (authView === "register") return <RegisterPage onGoLogin={() => setAuthView("login")} />;
    return <LoginPage onLogin={handleLogin} onGoRegister={() => setAuthView("register")} />;
  }

  return <AppComponent currentUser={currentUser} onLogout={handleLogout} onUpdateUser={handleLogin} />;
}

createRoot(document.getElementById("root")).render(<Root />);
