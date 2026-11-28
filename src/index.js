import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Dev only (`npm start`, URL with ?demo): the demo data the tests use, no real account. Stripped from production builds.
const DEMO_SESSIONS = process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).has('demo') ? {
  psicologa: { id: 'u-psi', role: 'psicologa', name: 'Débora Mendonça', email: 'demo@kiwave.test' },
  paciente: { id: 'u-pac', role: 'paciente', name: 'Luiz Mendonça', email: 'paciente@kiwave.test', patientId: 'luiz', psychologistId: 'u-psi' },
} : undefined;

// Demo also previews the 'onda' brand direction (src/styles/wave.css); real accounts keep the current look.
if (DEMO_SESSIONS) document.documentElement.dataset.brand = 'wave';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App initialSessions={DEMO_SESSIONS} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
