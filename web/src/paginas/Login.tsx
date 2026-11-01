import { useState } from "react";
import type { Sesion } from "@territorio/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { Error } from "../componentes/ui";

export function Login() {
  const { ingresar } = useEstado();
  const recordada = (() => {
    try {
      return localStorage.getItem("territorio:campania") ?? "";
    } catch {
      return "";
    }
  })();
  const [campania, setCampania] = useState(new URLSearchParams(location.search).get("c") ?? recordada);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const s = await api.post<Sesion>("/auth/login", { campania: campania.trim().toLowerCase(), email, password });
      try {
        localStorage.setItem("territorio:campania", s.campania.slug);
      } catch {
        /* sin almacenamiento */
      }
      await ingresar(s);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centrado">
      <form className="tarjeta caja-login" onSubmit={enviar}>
        <h1>Territorio</h1>
        <p className="muted">La campaña de tu ciudad, barrio por barrio.</p>
        <Error msg={error} />
        <div className="campo">
          <label htmlFor="c">Código de campaña</label>
          <input id="c" value={campania} onChange={(e) => setCampania(e.target.value)} autoCapitalize="none" autoCorrect="off" required placeholder="ej: demo" />
        </div>
        <div className="campo">
          <label htmlFor="e">Email</label>
          <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="campo">
          <label htmlFor="p">Contraseña</label>
          <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button className="primario bloque" disabled={enviando}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
