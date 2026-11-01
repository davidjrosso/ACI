import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useEstado } from "./estado";
import { Layout } from "./componentes/Layout";
import { Login } from "./paginas/Login";
import { Tablero } from "./paginas/Tablero";
import { Timbreo } from "./paginas/Timbreo";
import { Vecinos } from "./paginas/Vecinos";
import { VecinoDetalle } from "./paginas/VecinoDetalle";
import { Reclamos } from "./paginas/Reclamos";
import { Agenda } from "./paginas/Agenda";
import { Asistente } from "./paginas/Asistente";
import { Configuracion } from "./paginas/Configuracion";

// El mapa (Leaflet) se carga aparte para que la app abra rápido en el celular
const Mapa = lazy(() => import("./paginas/Mapa"));

export function App() {
  const { sesion, catalogos, cargando } = useEstado();

  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!sesion) return <Login />;
  if (!catalogos) return <div className="cargando">Cargando datos de la campaña…</div>;

  const rol = sesion.usuario.rol;
  // Campaña sin configurar: el comando entra directo al asistente
  if (!catalogos.config.configuracionCompleta && rol === "comando") return <Asistente />;
  if (!catalogos.config.configuracionCompleta)
    return <div className="cargando">La campaña todavía se está configurando. Volvé a intentar más tarde.</div>;

  return (
    <Layout>
      <Suspense fallback={<div className="cargando">Cargando…</div>}>
        <Routes>
          <Route path="/" element={<Tablero />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/timbreo" element={<Timbreo />} />
          <Route path="/vecinos" element={<Vecinos />} />
          <Route path="/vecinos/nuevo" element={<VecinoDetalle />} />
          <Route path="/vecinos/:id" element={<VecinoDetalle />} />
          <Route path="/reclamos" element={<Reclamos />} />
          <Route path="/agenda" element={<Agenda />} />
          {rol === "comando" && <Route path="/configuracion" element={<Configuracion />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
