import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AppComponent from "./components/App";
import LoginPage from "./components/LoginPage";
import "./styles/style.css";

export { AppComponent as App };

function Root() {
  const [showLogin, setShowLogin] = useState(false);
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
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    setCurrentUser(null);
  };

  if (showLogin && !currentUser) {
    return <LoginPage onLogin={handleLogin} onGoRegister={() => setShowLogin(false)} />;
  }

  return (
    <AppComponent 
      currentUser={currentUser} 
      onLogout={handleLogout} 
      onUpdateUser={handleLogin}
      onGoLogin={() => setShowLogin(true)}
    />
  );
}

createRoot(document.getElementById("root")).render(<Root />);
