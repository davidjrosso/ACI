import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { App } from "./App";
import { ProveedorEstado } from "./estado";
import { ProveedorToast } from "./componentes/ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorToast>
        <ProveedorEstado>
          <App />
        </ProveedorEstado>
      </ProveedorToast>
    </BrowserRouter>
  </StrictMode>,
);
