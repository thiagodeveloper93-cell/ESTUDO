import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Organization from "@/pages/Organization";
import Attendance from "@/pages/Attendance";
import Vacations from "@/pages/Vacations";
import Recruitment from "@/pages/Recruitment";
import Portal from "@/pages/Portal";

function Protected({ children, adminOnly }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/portal" replace />;
  return <Layout>{children}</Layout>;
}

function Index() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? "/dashboard" : "/portal"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Protected adminOnly><Dashboard /></Protected>} />
            <Route path="/colaboradores" element={<Protected adminOnly><Employees /></Protected>} />
            <Route path="/organizacao" element={<Protected adminOnly><Organization /></Protected>} />
            <Route path="/ponto" element={<Protected><Attendance /></Protected>} />
            <Route path="/ferias" element={<Protected><Vacations /></Protected>} />
            <Route path="/recrutamento" element={<Protected adminOnly><Recruitment /></Protected>} />
            <Route path="/portal" element={<Protected><Portal /></Protected>} />
          </Routes>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
