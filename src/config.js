export const API_BASE = window.location.port !== "3000" && window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : window.location.origin;

