import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useEstado } from "../estado";
import { IcoAgenda, IcoConfig, IcoMapa, IcoMas, IcoPuerta, IcoReclamos, IcoSalir, IcoTablero, IcoVecinos } from "./iconos";

interface Enlace {
  a: string;
  texto: string;
  ico: ReactNode;
  solo?: Array<"comando" | "referente" | "voluntario">;
}

const ENLACES: Enlace[] = [
  { a: "/", texto: "Tablero", ico: <IcoTablero /> },
  { a: "/mapa", texto: "Mapa", ico: <IcoMapa /> },
  { a: "/timbreo", texto: "Timbreo", ico: <IcoPuerta /> },
  { a: "/vecinos", texto: "Vecinos", ico: <IcoVecinos /> },
  { a: "/reclamos", texto: "Reclamos", ico: <IcoReclamos /> },
  { a: "/agenda", texto: "Agenda", ico: <IcoAgenda /> },
  { a: "/configuracion", texto: "Configuración", ico: <IcoConfig />, solo: ["comando"] },
];

const ROL_LABEL = { comando: "Comando", referente: "Referente", voluntario: "Voluntario/a" };

export function Layout({ children }: { children: ReactNode }) {
  const { sesion, online, pendientes, salir, sincronizarAhora } = useEstado();
  const [mas, setMas] = useState(false);
  const loc = useLocation();
  if (!sesion) return null;
  const rol = sesion.usuario.rol;
  const visibles = ENLACES.filter((e) => !e.solo || e.solo.includes(rol));
  const principales = visibles.slice(0, 4);
  const secundarios = visibles.slice(4);

  const estadoSync = !online ? (pendientes > 0 ? `Sin señal · ${pendientes} por enviar` : "Sin señal") : pendientes > 0 ? `${pendientes} por enviar` : "Al día";

  return (
    <div className="app">
      <header className="encabezado">
        <div className="marca">
          {sesion.campania.candidato}
          <small>
            {sesion.usuario.nombre} · {ROL_LABEL[rol]}
          </small>
        </div>
        <div className="espacio" />
        <button
          className="estado-sync"
          onClick={() => void sincronizarAhora()}
          title={pendientes > 0 ? "Tocá para enviar ahora" : "Todo sincronizado"}
          aria-label={`Estado de sincronización: ${estadoSync}`}
        >
          {online ? (pendientes > 0 ? "⟳ " : "✓ ") : "⚠ "}
          {estadoSync}
        </button>
        <button className="chico-btn" onClick={() => void salir()} aria-label="Cerrar sesión" title="Cerrar sesión">
          <IcoSalir />
        </button>
      </header>

      <nav className="nav-lateral" aria-label="Principal">
        {visibles.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.a === "/"} className={({ isActive }) => (isActive ? "activo" : "")}>
            {e.ico}
            {e.texto}
          </NavLink>
        ))}
      </nav>

      <main className="contenido">{children}</main>

      <nav className="nav-inferior" aria-label="Principal">
        {principales.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.a === "/"} className={({ isActive }) => (isActive ? "activo" : "")} onClick={() => setMas(false)}>
            {e.ico}
            {e.texto}
          </NavLink>
        ))}
        <button className={secundarios.some((s) => loc.pathname.startsWith(s.a)) ? "activo" : ""} onClick={() => setMas((m) => !m)} aria-expanded={mas}>
          <IcoMas />
          Más
        </button>
      </nav>
      {mas && (
        <div className="menu-mas" role="menu">
          {secundarios.map((e) => (
            <NavLink key={e.a} to={e.a} onClick={() => setMas(false)} role="menuitem">
              {e.ico}
              {e.texto}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
