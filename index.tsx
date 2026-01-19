
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Iniciando aplicação TECHVIEW...");

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Erro crítico: Elemento #root não encontrado no DOM.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Aplicação montada com sucesso.");
  } catch (error) {
    console.error("Erro ao montar a aplicação React:", error);
    rootElement.innerHTML = `<div style="color: white; padding: 20px; font-family: sans-serif;">
      <h1>Erro de Carregamento</h1>
      <p>Ocorreu um erro ao iniciar a aplicação. Verifique o console do navegador.</p>
      <pre style="background: #222; padding: 10px; border-radius: 5px;">${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
  }
}
