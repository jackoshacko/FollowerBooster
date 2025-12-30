// client/src/App.jsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// layouts
import PublicLayout from "./layouts/PublicLayout.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

// guards
import RequireAuth from "./components/RequireAuth.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";

// public pages
import HomePublic from "./pages/HomePublic.jsx";
import ServicesPublic from "./pages/ServicesPublic.jsx";
import Faq from "./pages/Faq.jsx";
import Contact from "./pages/Contact.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import Refund from "./pages/Refund.jsx";

// auth pages
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";

// private pages
import Dashboard from "./pages/Dashboard.jsx";
import Services from "./pages/Services.jsx";
import CreateOrder from "./pages/CreateOrder.jsx";
import Orders from "./pages/Orders.jsx";
import Wallet from "./pages/Wallet.jsx";
import NoAccess from "./pages/NoAccess.jsx";

// admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminServices from "./pages/admin/AdminServices.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminTransactions from "./pages/admin/AdminTransactions.jsx";

export default function App() {
  return (
    <Routes>
      {/* ===================== PUBLIC ===================== */}
      <Route element={<PublicLayout />}>
        <Route index element={<HomePublic />} />
        <Route path="/services" element={<ServicesPublic />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/contact" element={<Contact />} />

        {/* legal */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/refund" element={<Refund />} />

        {/* auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>

      {/* ===================== PRIVATE PANEL (/app/...) ===================== */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* /app -> /app/dashboard */}
        <Route index element={<Navigate to="dashboard" replace />} />

        {/* user */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="services" element={<Services />} />
        <Route path="create-order" element={<CreateOrder />} />
        <Route path="orders" element={<Orders />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="no-access" element={<NoAccess />} />

        {/* ===================== ADMIN (/app/admin/...) ===================== */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <Outlet />
            </RequireAdmin>
          }
        >
          {/* /app/admin -> /app/admin/dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="transactions" element={<AdminTransactions />} />
        </Route>
      </Route>

      {/* ===================== COMPAT REDIRECTS (optional but useful) ===================== */}
      {/* If something still links to old routes, we redirect to the new /app/... paths */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/create-order" element={<Navigate to="/app/create-order" replace />} />
      <Route path="/orders" element={<Navigate to="/app/orders" replace />} />
      <Route path="/wallet" element={<Navigate to="/app/wallet" replace />} />
      <Route path="/no-access" element={<Navigate to="/app/no-access" replace />} />

      {/* ===================== FALLBACK ===================== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
