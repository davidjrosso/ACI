import { Navigate, Route, Routes } from "react-router-dom";
import { useEstado } from "./estado";
import { Layout } from "./componentes/Layout";
import { Login } from "./paginas/Login";
import { Inicio } from "./paginas/Inicio";
import { Noticias } from "./paginas/Noticias";
import { EditorNoticia } from "./paginas/EditorNoticia";
import { Propuestas } from "./paginas/Propuestas";
import { Agenda } from "./paginas/Agenda";
import { Sumados } from "./paginas/Sumados";
import { Sitio } from "./paginas/Sitio";
import { Asistente } from "./paginas/Asistente";
import { Configuracion } from "./paginas/Configuracion";

export function App() {
  const { sesion, catalogos, cargando, puede } = useEstado();

  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!sesion) return <Login />;
  if (!catalogos) return <div className="cargando">Cargando datos de la campaña…</div>;

  // Campaña sin configurar: el comando entra directo al asistente
  if (!catalogos.config.configuracionCompleta && puede("comando")) return <Asistente />;
  if (!catalogos.config.configuracionCompleta) return <div className="cargando">La campaña todavía se está configurando. Volvé a intentar más tarde.</div>;

  const sitio = puede("comando", "comunicacion");
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/agenda" element={<Agenda />} />
        {sitio && <Route path="/noticias" element={<Noticias />} />}
        {sitio && <Route path="/noticias/nueva" element={<EditorNoticia />} />}
        {sitio && <Route path="/noticias/:id" element={<EditorNoticia />} />}
        {sitio && <Route path="/propuestas" element={<Propuestas />} />}
        {sitio && <Route path="/sitio" element={<Sitio />} />}
        {puede("comando", "referente") && <Route path="/sumados" element={<Sumados />} />}
        {puede("comando") && <Route path="/configuracion" element={<Configuracion />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
