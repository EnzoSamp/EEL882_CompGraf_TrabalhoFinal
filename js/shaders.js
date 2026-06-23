/* shaders.js — GLSL ES 1.00.
   Texturas do cenário geradas por procedimento no fragment shader (UV mapping procedural),
   evitando bind de sampler em shaders customizados do p5.
   Sprites de zumbis e Makise usam o shader nativo do p5 (buffers p5.Graphics).

   SHADERS:
     CEL → Cel-shading (Phong quantizado) com spotlight da lanterna, point light
           do muzzle flash, materiais procedurais (uMatId 0-4), fog e tone mapping.
     ENV → Environment mapping procedural para a máquina do tempo. */

/** Armazena os códigos-fonte GLSL. */
const fonteShaders = {};
window.SRC = fonteShaders;  // alias legado

/* ---- VERTEX SHADER compartilhado (cel + env): transforma posição e passa normal/UV. ---- */
fonteShaders.celVert = `
precision highp float;

attribute vec3 aPosition;   /* posição no espaço local */
attribute vec3 aNormal;     /* normal no espaço local */
attribute vec2 aTexCoord;   /* UV */

uniform mat4 uModelViewMatrix;   /* modelo → câmera */
uniform mat4 uProjectionMatrix;  /* câmera → clip */
uniform mat3 uNormalMatrix;      /* inversa transposta de modelView (para normais) */

varying vec3 vViewPos;
varying vec3 vNormal;
varying vec2 vTexCoord;

void main(){
  vec4 posicaoCamara = uModelViewMatrix * vec4(aPosition, 1.0);
  vViewPos  = posicaoCamara.xyz;
  vNormal   = uNormalMatrix * aNormal;
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * posicaoCamara;
}`;

/* ---- Funções de ruído procedural compartilhadas pelos dois shaders. ---- */
const RUIDO_GLSL = `
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

/* Ruído bilinear (Value Noise) */
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}`;

/* ---- FRAGMENT SHADER — CEL-SHADING + MATERIAIS PROCEDURAIS ---- */
fonteShaders.celFrag = `
precision highp float;

varying vec3 vViewPos;
varying vec3 vNormal;
varying vec2 vTexCoord;

uniform vec2  uUVScale;    /* escala para repetição da textura */
uniform vec3  uTint;       /* cor multiplicativa do adereço */
uniform float uTime;       /* tempo em s (animações) */
uniform float uFlashOn;    /* 0=lanterna apagada, 1=ligada */
uniform float uMuzzle;     /* intensidade do clarão do disparo (0..1) */
uniform float uBands;      /* faixas do cel-shading */
uniform float uAmbient;    /* luz ambiente */
uniform float uEmissive;   /* emissividade do material */
uniform vec3  uFogColor;   /* cor da névoa */
uniform float uFogDensity; /* densidade da névoa (exponencial) */
uniform float uMatId;      /* 0=chão, 1=parede, 2=teto, 3=metal, 4=liso */

${RUIDO_GLSL}

/* Material 0: chão — placas de concreto com faixas de perigo */
vec3 materialChao(vec2 uv, out float emissividade){
  emissividade = 0.0;
  vec2 celula = fract(uv); vec2 id = floor(uv);
  vec2 distBorda = min(celula, 1.0 - celula);
  float rejunte = smoothstep(0.0, 0.03, min(distBorda.x, distBorda.y));
  vec3 cor = mix(vec3(0.030,0.040,0.055), vec3(0.075,0.090,0.120), rejunte);
  cor *= 0.75 + 0.5 * hash(id);
  cor += (noise(uv*22.0) - 0.5) * 0.02;
  float haz = step(5.0, mod(id.y, 6.0));
  cor = mix(cor, mix(vec3(0.18,0.15,0.03), vec3(0.02,0.02,0.02), step(0.5, fract(uv.x*2.0))), haz*0.5*rejunte);
  return cor;
}

/* Material 1: parede — chapas metálicas com rebites */
vec3 materialParede(vec2 uv, out float emissividade){
  emissividade = 0.0;
  vec2 celula = fract(uv); vec2 id = floor(uv);
  vec2 distBorda = min(celula, 1.0 - celula);
  float bevel = smoothstep(0.0, 0.05, min(distBorda.x, distBorda.y));
  vec3 cor = mix(vec3(0.060,0.075,0.10), vec3(0.13,0.15,0.19), bevel);
  cor *= 0.8 + 0.35 * hash(id);
  cor += (1.0 - smoothstep(0.02, 0.04, length(celula - vec2(0.1, 0.1)))) * 0.15;  /* rebite */
  cor += (1.0 - smoothstep(0.02, 0.04, length(celula - vec2(0.9, 0.9)))) * 0.15;
  cor += (noise(uv*18.0) - 0.5) * 0.02;
  cor *= 0.9 + 0.2 * noise(uv*3.0);
  return cor;
}

/* Material 2: teto — painéis com tiras de luz emissivas */
vec3 materialTeto(vec2 uv, out float emissividade){
  vec2 celula = fract(uv);
  float tira = smoothstep(0.40, 0.45, celula.x) * (1.0 - smoothstep(0.55, 0.60, celula.x));
  emissividade = tira;
  vec2 distBorda = min(celula, 1.0 - celula);
  float bevel = smoothstep(0.0, 0.04, min(distBorda.x, distBorda.y));
  vec3 cor = mix(vec3(0.04,0.05,0.07), vec3(0.07,0.085,0.11), bevel);
  cor = mix(cor, vec3(0.75, 0.88, 1.0), tira);
  return cor;
}

/* Material 3: metal — acabamento escovado (brushed metal) */
vec3 materialMetal(vec2 uv, out float emissividade){
  emissividade = 0.0;
  float escovamento = 0.5 + 0.5 * sin(uv.y * 50.0 + noise(uv*3.0) * 8.0);
  vec3 cor = mix(vec3(0.16,0.18,0.23), vec3(0.30,0.33,0.40), escovamento);
  cor += (noise(uv*30.0) - 0.5) * 0.03;
  return cor;
}

void main(){
  vec2 uv = vTexCoord * uUVScale;

  float emis = 0.0;
  vec3 corBase;
  if      (uMatId < 0.5) corBase = materialChao(uv, emis);
  else if (uMatId < 1.5) corBase = materialParede(uv, emis);
  else if (uMatId < 2.5) corBase = materialTeto(uv, emis);
  else if (uMatId < 3.5) corBase = materialMetal(uv, emis);
  else                   corBase = vec3(1.0);  /* 4 = cor pura via uTint */
  corBase *= uTint;
  float emissividade = uEmissive + emis * 1.3;

  /* iluminação */
  vec3 N = normalize(vNormal), P = vViewPos;
  float dist = length(P);
  vec3 paraCamara = normalize(-P);
  if (dot(N, paraCamara) < 0.0) N = -N;  /* corrige faces traseiras */
  vec3 direcaoFragmento = normalize(P);

  /* spotlight da lanterna: câmera → -Z no espaço de câmera */
  float cosSpot = dot(direcaoFragmento, vec3(0.0, 0.0, -1.0));
  float intensidadeSpot = smoothstep(0.86, 0.965, cosSpot) + 0.18 * smoothstep(0.55, 0.86, cosSpot);
  float atenuacaoDistancia = 1.0 / (1.0 + 0.0016*dist + 0.0000045*dist*dist);
  float NdotL = max(dot(N, paraCamara), 0.0);

  /* quantização cel-shading */
  float bandas = max(uBands, 1.0);
  float NdotLCel = floor(NdotL * bandas + 0.5) / bandas;

  float iluminacaoLanterna = NdotLCel * intensidadeSpot * atenuacaoDistancia * uFlashOn;
  float iluminacaoMuzzle   = uMuzzle * NdotL * atenuacaoDistancia;  /* point light do clarão */

  /* mistura fria (sombra) e quente (luz) */
  vec3 corFria  = vec3(0.30, 0.37, 0.50);
  vec3 corQuente = vec3(1.0,  0.92, 0.78);
  vec3 iluminacaoTotal = uAmbient * corFria
    + iluminacaoLanterna * corQuente * 1.05
    + iluminacaoMuzzle * vec3(1.0, 0.8, 0.55) * 3.0;
  vec3 cor = corBase * iluminacaoTotal + corBase * emissividade;

  /* contorno fresnel (outline do cel-shading) */
  float rim = 1.0 - max(dot(N, paraCamara), 0.0);
  rim = smoothstep(0.6, 1.0, rim);
  cor *= (1.0 - 0.7 * rim);

  /* tone mapping exponencial */
  cor = vec3(1.0) - exp(-cor * 0.95);

  /* névoa exponencial */
  float fatorNevoa = 1.0 - exp(-uFogDensity * dist);
  cor = mix(cor, uFogColor, clamp(fatorNevoa, 0.0, 1.0));

  gl_FragColor = vec4(cor, 1.0);
}`;

/* ---- FRAGMENT SHADER — ENVIRONMENT MAPPING PROCEDURAL (máquina do tempo).
   Ambiente gerado proceduralmente pela direção de reflexão (sem cube map real). ---- */
fonteShaders.envFrag = `
precision highp float;

varying vec3 vViewPos;
varying vec3 vNormal;
varying vec2 vTexCoord;

uniform mat3  uInvViewRot;   /* rotação inversa câmera→mundo */
uniform float uTime;
uniform vec3  uMetalTint;
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform float uFlashOn;
uniform float uMuzzle;
uniform float uGlow;         /* intensidade do brilho pulsante */

${RUIDO_GLSL}

/* Ambiente procedural: gradiente vertical + faixas néon + highlights. */
vec3 corAmbiente(vec3 d){
  float v = d.y * 0.5 + 0.5;
  vec3 cor = mix(vec3(0.02,0.03,0.05), vec3(0.10,0.13,0.20), v);
  float azimute = atan(d.z, d.x);
  float faixas = smoothstep(0.82, 1.0, sin(azimute * 6.0) * 0.5 + 0.5);
  vec3 neon = mix(vec3(0.2,0.9,1.0), vec3(1.0,0.3,0.7), 0.5 + 0.5 * sin(azimute * 3.0));
  cor += neon * faixas * step(0.35, v) * 1.2;
  cor += smoothstep(0.7, 1.0, noise(vec2(azimute * 3.0, d.y * 4.0))) * 0.5;
  return cor;
}

void main(){
  vec3 N = normalize(vNormal), P = vViewPos;
  float dist = length(P);
  vec3 direcaoVisao = normalize(P);
  if (dot(N, -direcaoVisao) < 0.0) N = -N;

  /* reflexão no espaço de câmera → mundo */
  vec3 reflexao      = reflect(direcaoVisao, N);
  vec3 reflexaoMundo = normalize(uInvViewRot * reflexao);
  vec3 corEnv        = corAmbiente(reflexaoMundo);

  /* Fresnel: mais reflexo nas bordas */
  float fresnel = pow(1.0 - max(dot(N, -direcaoVisao), 0.0), 3.0);
  vec3 cor = mix(uMetalTint * 0.20, corEnv, 0.55 + 0.45 * fresnel);

  /* anéis de energia emissivos animados */
  float anel = smoothstep(0.72, 1.0, sin(vTexCoord.y * 42.0 - uTime * 3.0) * 0.5 + 0.5);
  cor += vec3(0.18, 0.78, 1.0) * anel * (0.6 + uGlow);

  /* lanterna e clarão sobre o metal */
  float spot = smoothstep(0.5, 0.8, dot(normalize(P), vec3(0, 0, -1)));
  float NdotL = max(dot(N, normalize(-P)), 0.0);
  cor += uFlashOn * spot * pow(NdotL, 10.0) * vec3(1.0, 0.95, 0.8) * 1.6;
  cor += uMuzzle * NdotL * vec3(1.0, 0.8, 0.6);

  /* tone mapping + névoa */
  cor = vec3(1.0) - exp(-cor * 1.3);
  float fatorNevoa = 1.0 - exp(-uFogDensity * dist);
  cor = mix(cor, uFogColor, clamp(fatorNevoa, 0.0, 1.0));

  gl_FragColor = vec4(cor, 1.0);
}`;

window.SRC = fonteShaders;
