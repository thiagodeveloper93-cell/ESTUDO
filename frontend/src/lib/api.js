import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rh_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("rh_token")) {
      localStorage.removeItem("rh_token");
      if (!window.location.pathname.includes("/login")) window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function apiError(e) {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(" ");
  return e.message || "Erro inesperado";
}

export const brl = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
