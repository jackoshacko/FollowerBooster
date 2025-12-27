// client/src/App.jsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import AppLayout from "./layouts/AppLayout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";

// auth
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import NoAccess from "./pages/NoAccess.jsx";

// app pages
import Dashboard from "./pages/Dashboard.jsx";
import Services from "./pages/Services.jsx";
import CreateOrder from "./pages/CreateOrder.jsx";
import Orders from "./pages/Orders.jsx";
import Wallet from "./pages/Wallet.jsx";

// admin pages
import AdminServices from "./pages/admin/AdminServices.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminTransactions from "./pages/admin/AdminTransactions.jsx";
import PayPalAdmin from "./pages/admin/PayPalAdmin.jsx";

function AdminGuard() {
  return (
    <RequireAdmin>
      <Outlet />
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/no-access" element={<NoAccess />} />

      {/* PROTECTED APP */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* default */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* user */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="services" element={<Services />} />
        <Route path="create-order" element={<CreateOrder />} />
        <Route path="orders" element={<Orders />} />
        <Route path="wallet" element={<Wallet />} />

        {/* ADMIN (only /admin/*) */}
        <Route path="admin" element={<AdminGuard />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="paypal" element={<PayPalAdmin />} />
        </Route>
      </Route>

      {/* fallback */}
      <Route path="*" element={<div className="p-6">404</div>} />
    </Routes>
  );
}

