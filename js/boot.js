"use strict";
/* ---------- início ---------- */
Store.subscribe(() => { if (!document.querySelector(".overlay")) render(); else { renderClientPicker(); renderDbStatus(); } });
const startHash = (location.hash || "").slice(1);
UI.view = ALL.some(s => s.id === startHash) ? startHash : "inicio";
render();
Store.init();
