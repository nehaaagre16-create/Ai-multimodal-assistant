const API_BASE = (() => {
  const local = 'http://localhost:4001';
  if (typeof window === 'undefined') return local;
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return local;
  return `${protocol}//${hostname}:4001`;
})();

export default API_BASE;
