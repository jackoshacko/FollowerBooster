import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css"; // ✅ Tailwind entry point

// DEBUG – proverava da li Vite vidi .env
console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
