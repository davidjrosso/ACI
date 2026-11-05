import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ROL_LABEL, type Rol } from "@aci/shared";
import { useEstado } from "../estado";
import { IcoAgenda, IcoConfig, IcoGlobo, IcoInicio, IcoMas, IcoNoticias, IcoPropuestas, IcoSalir, IcoVecinos } from "./iconos";

interface Enlace {
  a: string;
  texto: string;
  ico: ReactNode;
  roles: Rol[];
}

/** Menú del módulo 1. Cada rol ve solo lo que usa. */
const ENLACES: Enlace[] = [
  { a: "/", texto: "Inicio", ico: <IcoInicio />, roles: ["comando", "comunicacion", "referente", "voluntario"] },
  { a: "/noticias", texto: "Noticias", ico: <IcoNoticias />, roles: ["comando", "comunicacion"] },
  { a: "/sumados", texto: "Sumados", ico: <IcoVecinos />, roles: ["comando", "referente"] },
  { a: "/agenda", texto: "Agenda", ico: <IcoAgenda />, roles: ["comando", "comunicacion", "referente", "voluntario"] },
  { a: "/propuestas", texto: "Propuestas", ico: <IcoPropuestas />, roles: ["comando", "comunicacion"] },
  { a: "/sitio", texto: "Sitio", ico: <IcoGlobo />, roles: ["comando", "comunicacion"] },
  { a: "/configuracion", texto: "Configuración", ico: <IcoConfig />, roles: ["comando"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { sesion, salir, urlSitio } = useEstado();
  const [mas, setMas] = useState(false);
  const loc = useLocation();
  if (!sesion) return null;
  const rol = sesion.usuario.rol;
  const visibles = ENLACES.filter((e) => e.roles.includes(rol));
  const caben = visibles.length <= 5;
  const principales = caben ? visibles : visibles.slice(0, 4);
  const secundarios = caben ? [] : visibles.slice(4);

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
        <a className="estado-sync" href={urlSitio} target="_blank" rel="noopener" title="Abrir el sitio público">
          Ver sitio ↗
        </a>
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

      <nav className="nav-inferior" aria-label="Principal" style={{ gridTemplateColumns: `repeat(${principales.length + (secundarios.length ? 1 : 0)}, 1fr)` }}>
        {principales.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.a === "/"} className={({ isActive }) => (isActive ? "activo" : "")} onClick={() => setMas(false)}>
            {e.ico}
            {e.texto}
          </NavLink>
        ))}
        {secundarios.length > 0 && (
          <button className={secundarios.some((s) => loc.pathname.startsWith(s.a)) ? "activo" : ""} onClick={() => setMas((m) => !m)} aria-expanded={mas}>
            <IcoMas />
            Más
          </button>
        )}
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
