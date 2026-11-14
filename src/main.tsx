import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ContentProvider } from "./admin/store";
import { AuthProvider } from "./account/auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ContentProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ContentProvider>
  </StrictMode>
);