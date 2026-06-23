/* textures.js — TEXTURE MAPPING PROCEDURAL (p5.Graphics).
   Gera texturas por código em buffers 2D (sem imagens externas).
   O CENÁRIO usa materiais procedurais no cel-shader (shaders.js) — não estes buffers.
   O que é efetivamente amostrado em runtime:
     TEX.zumbis[]  → billboards dos zumbis         [USADO]
     TEX.glow      → clarão do tiro / glow          [USADO]
     TEX.glowCyan  → glow da máquina / portal       [USADO]
   Os demais (parede, chão, teto, metal, mapa) ficam como referência de texture mapping. */

/** Armazena todas as texturas geradas proceduralmente. */
const TEX = {};

/** Número aleatório em [min, max]. */
function aleatorio(min, max) { return min + Math.random() * (max - min); }

/* ----- parede: chapas metálicas com rebites ----- */
function gerarTexturaParede() {
  const tamanho = 256, buffer = createGraphics(tamanho, tamanho);
  buffer.noStroke();
  buffer.background(28, 34, 44);

  // grão de ruído
  for (let i = 0; i < 2600; i++) {
    const v = aleatorio(-14, 14);
    buffer.fill(28 + v, 34 + v, 44 + v, 60);
    buffer.rect(aleatorio(0, tamanho), aleatorio(0, tamanho), aleatorio(1, 2), aleatorio(1, 2));
  }

  // grade de painéis (linhas escuras)
  buffer.stroke(12, 16, 22); buffer.strokeWeight(3); buffer.noFill();
  for (let y = 0; y < tamanho; y += 64) buffer.line(0, y, tamanho, y);
  for (let x = 0; x < tamanho; x += 128) buffer.line(x, 0, x, tamanho);

  // chanfros claros nas bordas superiores
  buffer.stroke(60, 72, 88); buffer.strokeWeight(1);
  for (let y = 2; y < tamanho; y += 64) buffer.line(0, y, tamanho, y);

  // rebites nos cantos dos painéis
  buffer.noStroke();
  for (let y = 12; y < tamanho; y += 64) {
    for (let x = 14; x < tamanho; x += 128) {
      buffer.fill(70, 82, 98);  buffer.circle(x, y, 5);
      buffer.fill(14, 18, 24);  buffer.circle(x + 1, y + 1, 3);
    }
  }

  // manchas de ferrugem/abandono
  for (let i = 0; i < 7; i++) {
    buffer.fill(aleatorio(60, 110), aleatorio(20, 40), aleatorio(20, 30), 40);
    buffer.circle(aleatorio(0, tamanho), aleatorio(0, tamanho), aleatorio(20, 60));
  }

  return buffer;
}

/* ----- chão: placas de concreto com faixas de perigo ----- */
function gerarTexturaChao() {
  const tamanho = 256, buffer = createGraphics(tamanho, tamanho);
  buffer.noStroke(); buffer.background(22, 26, 33);

  // grão de ruído
  for (let i = 0; i < 3000; i++) {
    const v = aleatorio(-12, 12);
    buffer.fill(22 + v, 26 + v, 33 + v, 70);
    buffer.rect(aleatorio(0, tamanho), aleatorio(0, tamanho), 2, 2);
  }

  // divisórias das placas (4 quadrantes)
  buffer.stroke(10, 12, 16); buffer.strokeWeight(4); buffer.noFill();
  buffer.rect(4, 4, tamanho - 8, tamanho - 8);
  buffer.line(tamanho/2, 0, tamanho/2, tamanho);
  buffer.line(0, tamanho/2, tamanho, tamanho/2);

  // textura antiderrapante (padrão industrial)
  buffer.noStroke(); buffer.fill(38, 44, 54);
  for (let y = 16; y < tamanho; y += 18) {
    for (let x = 16; x < tamanho; x += 18) buffer.circle(x, y, 4);
  }

  // faixa de perigo amarela/preta
  buffer.push(); buffer.translate(0, tamanho - 26);
  for (let x = -30; x < tamanho + 30; x += 24) {
    buffer.fill(180, 150, 40); buffer.quad(x, 0, x+12, 0, x+12-26, 26, x-26, 26);
    buffer.fill(20, 20, 20);   buffer.quad(x+12, 0, x+24, 0, x+24-26, 26, x+12-26, 26);
  }
  buffer.pop();

  // manchas escuras (grime)
  for (let i = 0; i < 5; i++) {
    buffer.fill(10, 12, 16, 60);
    buffer.circle(aleatorio(0, tamanho), aleatorio(0, tamanho), aleatorio(30, 80));
  }

  return buffer;
}

/* ----- teto: painéis com tiras de luz emissivas ----- */
function gerarTexturaTeto() {
  const tamanho = 256, buffer = createGraphics(tamanho, tamanho);
  buffer.noStroke(); buffer.background(18, 21, 27);

  // grade de painéis
  buffer.stroke(8, 10, 14); buffer.strokeWeight(3); buffer.noFill();
  for (let y = 0; y < tamanho; y += 42) buffer.line(0, y, tamanho, y);
  for (let x = 0; x < tamanho; x += 85) buffer.line(x, 0, x, tamanho);

  // tiras fluorescentes (viram emissivas no shader via uEmissive)
  buffer.noStroke();
  for (let x = 30; x < tamanho; x += 85) {
    buffer.fill(150, 200, 225); buffer.rect(x, 8, 20, tamanho - 16, 4);
    buffer.fill(220, 245, 255); buffer.rect(x + 6, 8, 8, tamanho - 16, 3);
  }

  return buffer;
}

/* ----- chapa metálica: base/coluna da máquina do tempo ----- */
function gerarTexturaMetal() {
  const tamanho = 128, buffer = createGraphics(tamanho, tamanho);
  buffer.noStroke(); buffer.background(60, 66, 78);

  // grão metálico
  for (let i = 0; i < 1500; i++) {
    const v = aleatorio(-18, 18);
    buffer.fill(60 + v, 66 + v, 78 + v, 80);
    buffer.rect(aleatorio(0, tamanho), aleatorio(0, tamanho), 2, 2);
  }

  // linhas de chapas soldadas
  buffer.stroke(30, 34, 42); buffer.strokeWeight(2); buffer.noFill();
  for (let y = 0; y < tamanho; y += 32) buffer.line(0, y, tamanho, y);

  return buffer;
}

/* ----- mapa de ambiente equiretangular (referência — NÃO amostrado pelo shader).
   O shader de environment mapping gera o ambiente proceduralmente em GLSL. ----- */
function gerarMapaAmbiente() {
  const largura = 1024, altura = 512;
  const buffer = createGraphics(largura, altura);
  buffer.noStroke();

  // gradiente vertical: teto azul-acinzentado → piso escuro
  for (let y = 0; y < altura; y++) {
    const p = y / altura;
    buffer.fill(lerp(40, 8, p), lerp(54, 10, p), lerp(78, 16, p));
    buffer.rect(0, y, largura, 1);
  }

  // tiras de luz néon coloridas
  const coresNeon = [[60, 220, 255], [255, 80, 160], [120, 255, 200], [255, 200, 80]];
  for (let i = 0; i < 10; i++) {
    const posX = aleatorio(0, largura), larg = aleatorio(8, 26);
    const cor = coresNeon[Math.floor(Math.random() * coresNeon.length)];
    buffer.fill(cor[0], cor[1], cor[2], 200); buffer.rect(posX, altura * 0.18, larg, altura * 0.5, 4);
    buffer.fill(cor[0], cor[1], cor[2], 60);  buffer.rect(posX - larg, altura * 0.18, larg * 3, altura * 0.5);
  }

  // highlights pontuais dispersos
  for (let i = 0; i < 40; i++) {
    buffer.fill(255, 255, 255, aleatorio(40, 180));
    buffer.circle(aleatorio(0, largura), aleatorio(0, altura * 0.5), aleatorio(2, 7));
  }

  // faixa quente próxima ao horizonte
  buffer.fill(255, 160, 90, 50); buffer.rect(0, altura * 0.46, largura, altura * 0.08);

  return buffer;
}

/* ----- billboard de zumbi: silhueta cel-shaded com transparência ----- */
/** @param {number} variante - 0=verde-escuro, 1=acinzentado, 2=verde-claro */
function gerarTexturaZumbi(variante) {
  const largura = 256, altura = 512;
  const buffer = createGraphics(largura, altura);
  buffer.clear();

  const paletas = [[88, 120, 70], [120, 124, 118], [100, 140, 96]];
  const corPele = paletas[variante % paletas.length];
  const corSombra = [corPele[0]*0.45, corPele[1]*0.45, corPele[2]*0.45];
  const centroX = 100;

  buffer.push(); buffer.scale(largura/200, altura/360);
  buffer.noStroke(); buffer.strokeJoin(ROUND);

  /** Desenha um membro (braço/perna) com contorno preto e highlight. */
  function desenharMembro(x1, y1, x2, y2, esp, corClara, corEscura) {
    buffer.stroke(8, 12, 8); buffer.strokeWeight(esp + 6); buffer.line(x1, y1, x2, y2);
    buffer.stroke(corEscura[0], corEscura[1], corEscura[2]); buffer.strokeWeight(esp); buffer.line(x1, y1, x2, y2);
    buffer.stroke(corClara[0], corClara[1], corClara[2]); buffer.strokeWeight(esp * 0.5);
    buffer.line(x1, y1, (x1+x2)/2, (y1+y2)/2);  // highlight na metade superior
  }

  // pernas arqueadas (postura de zumbi)
  desenharMembro(centroX-16, 250, centroX-30, 348, 20, corPele, corSombra);
  desenharMembro(centroX+16, 250, centroX+34, 348, 20, corPele, corSombra);

  // braços esticados à frente
  desenharMembro(centroX-30, 150, centroX-78, 205, 16, corPele, corSombra);
  desenharMembro(centroX+30, 150, centroX+80, 200, 16, corPele, corSombra);

  // mãos
  buffer.noStroke(); buffer.fill(corSombra[0], corSombra[1], corSombra[2]);
  buffer.circle(centroX-80, 206, 22); buffer.circle(centroX+82, 201, 22);

  // tronco (camisa rasgada)
  buffer.stroke(8, 12, 8); buffer.strokeWeight(6); buffer.fill(46, 52, 60);
  buffer.beginShape();
  buffer.vertex(centroX-34, 150); buffer.vertex(centroX+34, 150);
  buffer.vertex(centroX+30, 258); buffer.vertex(centroX-30, 258);
  buffer.endShape(CLOSE);

  // sombra cel no lado direito
  buffer.noStroke(); buffer.fill(28, 32, 38, 180); buffer.rect(centroX, 150, 34, 108);

  // pescoço e cabeça
  buffer.stroke(8, 12, 8); buffer.strokeWeight(6); buffer.fill(corPele[0], corPele[1], corPele[2]);
  buffer.rect(centroX-10, 120, 20, 28, 4);
  buffer.circle(centroX, 98, 64);

  // sombra cel na metade inferior da cabeça
  buffer.noStroke(); buffer.fill(corSombra[0], corSombra[1], corSombra[2], 170);
  buffer.arc(centroX, 98, 64, 64, -0.3, PI+0.3, PIE);

  // olhos vermelhos brilhantes
  buffer.fill(255, 40, 50);   buffer.circle(centroX-12, 94, 10); buffer.circle(centroX+12, 94, 10);
  buffer.fill(255, 160, 160); buffer.circle(centroX-12, 94, 4);  buffer.circle(centroX+12, 94, 4);

  // boca aberta
  buffer.stroke(20, 8, 8); buffer.strokeWeight(3); buffer.noFill();
  buffer.arc(centroX, 114, 26, 16, 0.1, PI-0.1);

  // manchas de sangue
  buffer.noStroke();
  for (let i = 0; i < 6; i++) {
    buffer.fill(140, 20, 24, 200);
    buffer.circle(centroX + aleatorio(-30, 30), aleatorio(120, 250), aleatorio(4, 12));
  }
  buffer.fill(150, 20, 24, 180); buffer.rect(centroX-2, 114, 5, 40, 2);  // escorrimento

  buffer.pop();
  return buffer;
}

/* ----- sprite de brilho radial (glow aditivo) ----- */
/** @param {number} r, g, b - Cor do glow (0-255). @returns {p5.Graphics} Buffer 128×128. */
function gerarSpriteGlow(r, g, b) {
  const tamanho = 128, buffer = createGraphics(tamanho, tamanho);
  buffer.clear();
  // círculos concêntricos: opacos no centro, transparentes nas bordas
  for (let raio = tamanho/2; raio > 0; raio--) {
    const p = Math.pow(raio / (tamanho/2), 2);  // 0=centro, 1=borda
    buffer.noStroke(); buffer.fill(r, g, b, (1 - p) * 255);
    buffer.circle(tamanho/2, tamanho/2, raio * 2);
  }
  return buffer;
}

/**
 * Gera e armazena todas as texturas em TEX. Chamado no setup() do game.js.
 * Efetivamente usados: TEX.zumbis, TEX.glow, TEX.glowCyan.
 * Os demais (parede, chão, teto, metal, mapa) são referência de texture mapping.
 */
function construirTexturas() {
  TEX.parede  = gerarTexturaParede();
  TEX.chao    = gerarTexturaChao();
  TEX.teto    = gerarTexturaTeto();
  TEX.metal   = gerarTexturaMetal();
  TEX.mapa    = gerarMapaAmbiente();
  TEX.glowRed = gerarSpriteGlow(255, 90, 90);        // reservado, não usado
  TEX.zumbis  = [gerarTexturaZumbi(0), gerarTexturaZumbi(1), gerarTexturaZumbi(2)];
  TEX.glow     = gerarSpriteGlow(255, 220, 150);      // clarão do disparo (âmbar)
  TEX.glowCyan = gerarSpriteGlow(120, 220, 255);      // glow da máquina / portal
}

window.TEX              = TEX;
window.construirTexturas = construirTexturas;
window.buildTextures     = construirTexturas;  // alias legado
