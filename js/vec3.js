/* vec3.js — álgebra de vetores 3D (câmera, tiro, cutscene). */

const Vec3 = {
  somar:       (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  subtrair:    (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  escalar:     (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  ponto:       (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
  cruzado:     (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  comprimento: (a)    => Math.hypot(a[0], a[1], a[2]),
  normalizar:  (a)    => { const c = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0]/c, a[1]/c, a[2]/c]; }
};

window.Vec3 = Vec3;
window.V    = Vec3;  // alias legado
