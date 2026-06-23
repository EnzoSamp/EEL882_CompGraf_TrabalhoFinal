/* level.js — corredor/laboratório do Future Gadget Lab.
   Geometria = primitivas (box/plane) com cel-shader.
   Colisão = AABB no plano XZ. Frente = -Z, chão em y=0, teto em y=alturaCorredor. */

/** Altura total do corredor em unidades do mundo. */
const alturaCorredor = 360;

/** Altura dos olhos do personagem a partir do chão. */
const alturaOlhos = 150;

/* ESCADARIA — dois andares reais com campo de altura dinâmico.
   Para remover: apague as constantes abaixo, os métodos construirEscadaria /
   desenharEscadaria / alturaPiso, as chamadas deles em construir() / desenhar(),
   o vão da parede do fundo do quarto e o bloco [ESCADARIA] em player.js. */

/** Liga/desliga toda a escadaria (false = altura sempre 0). */
const ESCADARIA_ATIVA = true;

const ESCADA_ALTURA_SUPERIOR = 300;  // Y do piso do andar superior (spawn)
const ESCADA_Z_BASE          = 940;  // Z onde a escada toca o andar inferior
const ESCADA_Z_TOPO          = 1400; // Z onde a escada chega ao topo
const ESCADA_Z_FUNDO         = 2040; // Z da parede do fundo da sala superior
const ESCADA_MEIA_LARGURA    = 200;  // meia-largura do vão caminhável
const ESCADA_NUM_DEGRAUS     = 16;   // degraus visuais (colisão é rampa lisa)

/** Centraliza geometria, colisão e renderização do mapa. */
const NIVEL = {
  alturaCorredor,
  alturaOlhos,

  /** AABBs de colisão: {minX, maxX, minZ, maxZ} */
  paredesColisao: [],

  /** Obstáculos que bloqueiam só TIRO (não movimento): {minX,maxX,minY,maxY,minZ,maxZ}.
   *  Usado por ZUMBIS.detectarTiro em entities.js. */
  obstaculosTiro: [],

  /** Caixas para renderização: {x, y, z, w, h, d} */
  caixasRender: [],

  /** Móveis e adereços: {x,y,z,w,h,d,tint,matId,ry} */
  aderecos: [],

  /** Limites do chão/teto (cobre o mapa inteiro). */
  limitesPiso: { minX: -560, maxX: 560, minZ: -2740, maxZ: 960 },

  /** Posição da máquina do tempo. */
  maquina: { x: 0, y: 0, z: -2400 },

  /** Raio de ativação da máquina (zona de gatilho). */
  raioAtivacao: 300,

  /* [PORTA-ESCADA] Porta no pé da escada.
     FECHADA → ABERTA (E) → TRANCADA (para sempre ao atravessar). */
  portaEscada: { minX: -90, maxX: 90, minZ: 900, maxZ: 940, estado: 'FECHADA' },

  /** Posição e yaw iniciais do jogador. [ESCADARIA] nasce na sala superior (z=1720). */
  posicaoInicialJogador: { x: 0, z: 1720, yaw: Math.PI },

  /** Adiciona parede com colisão AABB e caixa de renderização. */
  adicionarParede(minX, maxX, minZ, maxZ) {
    this.paredesColisao.push({ minX, maxX, minZ, maxZ });
    this.caixasRender.push({
      x: (minX+maxX)/2, y: alturaCorredor/2, z: (minZ+maxZ)/2,
      w: (maxX-minX),   h: alturaCorredor,   d: (maxZ-minZ)
    });
  },

  /** Adiciona só colisão (sem caixa de render) — para móveis desenhados como adereços. */
  adicionarColisaoInvisivel(minX, maxX, minZ, maxZ) {
    this.paredesColisao.push({ minX, maxX, minZ, maxZ });
  },

  /**
   * Adiciona adereço decorativo (caixa colorida desenhada separadamente).
   * @param {number[]} corTint  - Cor RGB normalizada [r, g, b]
   * @param {number}   idMaterial - ID do material no shader (0-4)
   * @param {number}   [rotY=0]  - Rotação em Y (radianos)
   */
  adicionarAderecos(x, y, z, w, h, d, corTint, idMaterial, rotY) {
    this.aderecos.push({
      x, y, z, w, h, d,
      tint:  corTint || [1, 1, 1],
      matId: (idMaterial === undefined ? 4 : idMaterial),
      ry:    rotY || 0
    });
  },

  /** Constrói toda a geometria do mapa (paredes, colisores, adereços). */
  construir() {
    this.paredesColisao = []; this.caixasRender = []; this.aderecos = []; this.obstaculosTiro = [];

    // corredor principal (x: -200..200)
    this.adicionarParede(-240, -200, -2000,  280);
    this.adicionarParede( 200,  240, -2000,  280);

    // parede com porta entre quarto e corredor (vão central)
    this.adicionarParede(-240,  -75, 260, 300);
    this.adicionarParede(  75,  240, 260, 300);

    // quarto inicial (z: 300..940)
    this.adicionarParede(-240, -200, 300, 940);
    this.adicionarParede( 200,  240, 300, 940);
    // [ESCADARIA] parede do fundo com vão central (x:-90..90) para a escada
    // Para reverter: this.adicionarParede(-240, 240, 900, 940);
    this.adicionarParede(-240, -90, 900, 940);
    this.adicionarParede(  90, 240, 900, 940);

    // moldura da porta + porta aberta encostada
    this.adicionarAderecos(-82, 180, 280, 16, 360, 48, [0.26,0.26,0.30], 3);
    this.adicionarAderecos( 82, 180, 280, 16, 360, 48, [0.26,0.26,0.30], 3);
    this.adicionarAderecos(  0, 330, 280, 180, 64, 48, [0.26,0.26,0.30], 3);
    this.adicionarAderecos(118, 150, 340, 12, 290, 150, [0.42,0.29,0.17], 4, -1.35);

    // divisórias com portas ao longo do corredor
    this.adicionarParede(-200,  40,  -670,  -630);
    this.adicionarParede( -40, 200, -1170, -1130);
    this.adicionarParede(-200,  60, -1610, -1570);

    // câmara final da máquina do tempo (x: -520..520)
    this.adicionarParede(-520, -480, -2700, -2000);
    this.adicionarParede( 480,  520, -2700, -2000);
    this.adicionarParede(-520,  520, -2740, -2700);
    this.adicionarParede(-520, -200, -2020, -1980);
    this.adicionarParede( 200,  520, -2020, -1980);

    if (ESCADARIA_ATIVA) this.construirEscadaria();
  },

  /* Paredes da escada + sala superior (colisão invisível; render em desenharEscadaria). */
  construirEscadaria() {
    this.adicionarColisaoInvisivel(-240, -200, ESCADA_Z_BASE, ESCADA_Z_FUNDO);
    this.adicionarColisaoInvisivel( 200,  240, ESCADA_Z_BASE, ESCADA_Z_FUNDO);
    this.adicionarColisaoInvisivel(-240,  240, ESCADA_Z_FUNDO, ESCADA_Z_FUNDO + 40);

    // verga acima da porta da escada: bloqueia só TIRO (não movimento), com altura exata
    const tetoSuperior = ESCADA_ALTURA_SUPERIOR + alturaCorredor;
    this.obstaculosTiro.push({
      minX: -240, maxX: 240,
      minY: alturaCorredor, maxY: tetoSuperior,
      minZ: ESCADA_Z_BASE - 20, maxZ: ESCADA_Z_BASE + 20
    });
  },

  /**
   * Resolve colisão AABB de um ponto com raio `r` contra todas as paredes.
   * Desliza nas paredes (empurra pelo eixo de menor penetração).
   * @returns {number[]} Nova posição [posX, posZ]
   */
  resolverColisao(posX, posZ, raio) {
    for (const parede of this.paredesColisao) {
      if (posX > parede.minX-raio && posX < parede.maxX+raio &&
          posZ > parede.minZ-raio && posZ < parede.maxZ+raio) {
        const eL = posX - (parede.minX - raio);
        const eR = (parede.maxX + raio) - posX;
        const eB = posZ - (parede.minZ - raio);
        const eF = (parede.maxZ + raio) - posZ;
        const m = Math.min(eL, eR, eB, eF);
        if      (m === eL) posX = parede.minX - raio;
        else if (m === eR) posX = parede.maxX + raio;
        else if (m === eB) posZ = parede.minZ - raio;
        else               posZ = parede.maxZ + raio;
      }
    }

    // [PORTA-ESCADA] colisão da porta quando não estiver aberta
    const porta = this.portaEscada;
    if (porta && porta.estado !== 'ABERTA' &&
        posX > porta.minX-raio && posX < porta.maxX+raio &&
        posZ > porta.minZ-raio && posZ < porta.maxZ+raio) {
      const eL = posX - (porta.minX - raio), eR = (porta.maxX + raio) - posX;
      const eB = posZ - (porta.minZ - raio), eF = (porta.maxZ + raio) - posZ;
      const m = Math.min(eL, eR, eB, eF);
      if      (m === eL) posX = porta.minX - raio;
      else if (m === eR) posX = porta.maxX + raio;
      else if (m === eB) posZ = porta.minZ - raio;
      else               posZ = porta.maxZ + raio;
    }
    return [posX, posZ];
  },

  /**
   * Desenha chão, teto e paredes com o cel-shader.
   * Os uniforms de luz/fog devem ser configurados antes (pelo game.js).
   */
  desenhar(shader) {
    const lim  = this.limitesPiso;
    const larg = lim.maxX - lim.minX, prof = lim.maxZ - lim.minZ;
    const cx   = (lim.minX + lim.maxX) / 2, cz = (lim.minZ + lim.maxZ) / 2;

    // chão: material 0 (concreto + faixas de perigo)
    shader.setUniform('uTint',    [1, 1, 1]);
    shader.setUniform('uEmissive', 0.0);
    shader.setUniform('uMatId',   0);
    shader.setUniform('uUVScale', [larg/150, prof/150]);
    push(); translate(cx, 0, cz); rotateX(-HALF_PI); plane(larg, prof); pop();

    // teto: material 2 (painéis emissivos)
    shader.setUniform('uMatId',   2);
    shader.setUniform('uUVScale', [larg/150, prof/150]);
    push(); translate(cx, alturaCorredor, cz); rotateX(HALF_PI); plane(larg, prof); pop();

    // paredes: material 1 (chapas metálicas)
    shader.setUniform('uMatId', 1);
    shader.setUniform('uTint',  [1, 1, 1]);
    for (const caixa of this.caixasRender) {
      const dimMaior = Math.max(caixa.w, caixa.d);
      shader.setUniform('uUVScale', [dimMaior/140, caixa.h/140]);
      push(); translate(caixa.x, caixa.y, caixa.z); box(caixa.w, caixa.h, caixa.d); pop();
    }

    // adereços (moldura, porta, etc.)
    shader.setUniform('uUVScale', [1, 1]);
    for (const a of this.aderecos) {
      shader.setUniform('uMatId', a.matId);
      shader.setUniform('uTint',  a.tint);
      push(); translate(a.x, a.y, a.z); if (a.ry) rotateY(a.ry); box(a.w, a.h, a.d); pop();
    }

    if (ESCADARIA_ATIVA) this.desenharEscadaria(shader);
    shader.setUniform('uTint', [1, 1, 1]);
  },

  /* Campo de altura do piso: 0 no andar inferior, ESCADA_ALTURA_SUPERIOR no superior,
     rampa linear entre ESCADA_Z_BASE e ESCADA_Z_TOPO. */
  alturaPiso(x, z) {
    if (!ESCADARIA_ATIVA) return 0;
    if (z <= ESCADA_Z_BASE) return 0;
    if (z >= ESCADA_Z_TOPO) return ESCADA_ALTURA_SUPERIOR;
    const t = (z - ESCADA_Z_BASE) / (ESCADA_Z_TOPO - ESCADA_Z_BASE);
    return t * ESCADA_ALTURA_SUPERIOR;
  },

  /* Renderiza piso/teto/paredes da sala superior, degraus e portões.
     Materiais: 0=chão, 1=parede, 2=teto emissivo, 3=metal. */
  desenharEscadaria(shader) {
    const teto = ESCADA_ALTURA_SUPERIOR + alturaCorredor;
    const L = ESCADA_MEIA_LARGURA;

    // piso da sala superior (material 0)
    shader.setUniform('uTint', [1, 1, 1]); shader.setUniform('uEmissive', 0.0); shader.setUniform('uMatId', 0);
    shader.setUniform('uUVScale', [(2*240)/150, (ESCADA_Z_FUNDO - ESCADA_Z_TOPO)/150]);
    push(); translate(0, ESCADA_ALTURA_SUPERIOR, (ESCADA_Z_TOPO + ESCADA_Z_FUNDO)/2); rotateX(-HALF_PI);
    plane(480, ESCADA_Z_FUNDO - ESCADA_Z_TOPO); pop();

    // teto sobre escada + sala superior (material 2)
    shader.setUniform('uMatId', 2);
    shader.setUniform('uUVScale', [480/150, (ESCADA_Z_FUNDO - ESCADA_Z_BASE)/150]);
    push(); translate(0, teto, (ESCADA_Z_BASE + ESCADA_Z_FUNDO)/2); rotateX(HALF_PI);
    plane(480, ESCADA_Z_FUNDO - ESCADA_Z_BASE); pop();

    // paredes laterais e fundo (material 1), do chão ao teto
    shader.setUniform('uMatId', 1); shader.setUniform('uTint', [1, 1, 1]);
    const zMeio = (ESCADA_Z_BASE + ESCADA_Z_FUNDO)/2, zComp = ESCADA_Z_FUNDO - ESCADA_Z_BASE;
    shader.setUniform('uUVScale', [zComp/140, teto/140]);
    push(); translate(-220, teto/2, zMeio); box(40, teto, zComp); pop();
    push(); translate( 220, teto/2, zMeio); box(40, teto, zComp); pop();
    shader.setUniform('uUVScale', [480/140, teto/140]);
    push(); translate(0, teto/2, ESCADA_Z_FUNDO + 20); box(480, teto, 40); pop();

    // verga (header): fecha o vão y:360..660 acima da porta do quarto
    shader.setUniform('uUVScale', [480/140, (teto - alturaCorredor)/140]);
    push(); translate(0, (alturaCorredor + teto)/2, ESCADA_Z_BASE); box(480, teto - alturaCorredor, 40); pop();

    // portões blindados decorativos na parede do fundo (material 3)
    const zPortao = ESCADA_Z_FUNDO - 8, baseY = ESCADA_ALTURA_SUPERIOR;
    const altPortao = 290, centrosX = [-120, 120];
    shader.setUniform('uUVScale', [1, 1]);
    for (const cx of centrosX) {
      shader.setUniform('uMatId', 3);
      shader.setUniform('uTint',  [0.20, 0.21, 0.25]);
      push(); translate(cx, baseY + altPortao/2, zPortao + 6); box(216, altPortao + 14, 16); pop();  // batente
      shader.setUniform('uTint', [0.40, 0.42, 0.48]);
      push(); translate(cx - 52, baseY + altPortao/2, zPortao); box(100, altPortao, 12); pop();  // folha esq
      push(); translate(cx + 52, baseY + altPortao/2, zPortao); box(100, altPortao, 12); pop();  // folha dir
      shader.setUniform('uTint', [0.30, 0.31, 0.36]);
      for (const fy of [60, 145, 230]) {
        push(); translate(cx, baseY + fy, zPortao - 7); box(206, 16, 8); pop();  // reforços horizontais
      }
      shader.setUniform('uTint', [0.52, 0.54, 0.60]);
      push(); translate(cx, baseY + altPortao/2, zPortao - 10); rotateX(HALF_PI); cylinder(26, 8, 12, 1); pop();  // volante
    }
    shader.setUniform('uTint', [1, 1, 1]);

    // degraus (material 0): cada degrau = caixa sólida do chão até sua altura
    shader.setUniform('uMatId', 0); shader.setUniform('uTint', [1, 1, 1]);
    const dz = (ESCADA_Z_TOPO - ESCADA_Z_BASE) / ESCADA_NUM_DEGRAUS;
    const dy = ESCADA_ALTURA_SUPERIOR / ESCADA_NUM_DEGRAUS;
    shader.setUniform('uUVScale', [(2*L)/150, dz/150]);
    for (let i = 0; i < ESCADA_NUM_DEGRAUS; i++) {
      const zCentro = ESCADA_Z_BASE + (i + 0.5) * dz;
      const topo    = (i + 1) * dy;
      push(); translate(0, topo/2, zCentro); box(2*L, topo, dz); pop();
    }

    // [PORTA-ESCADA] folha da porta (fechada ou trancada)
    const porta = this.portaEscada;
    if (porta && porta.estado !== 'ABERTA') {
      const zMeioPorta = (porta.minZ + porta.maxZ) / 2;
      shader.setUniform('uMatId', 3); shader.setUniform('uUVScale', [1, 1]);
      shader.setUniform('uTint', porta.estado === 'TRANCADA' ? [0.30, 0.32, 0.38] : [0.44, 0.30, 0.20]);
      push(); translate(0, 150, zMeioPorta); box(176, 300, 14); pop();
      shader.setUniform('uTint', [0.60, 0.62, 0.68]);
      push(); translate(60, 150, zMeioPorta - 8); box(14, 26, 8); pop();  // maçaneta
      shader.setUniform('uTint', [1, 1, 1]);
    }
  }
};

window.NIVEL  = NIVEL;
window.LEVEL  = NIVEL;   // alias legado
window.H      = alturaCorredor;
window.EYE    = alturaOlhos;

/* Aliases de métodos legados */
NIVEL.collide     = (px, pz, r)  => NIVEL.resolverColisao(px, pz, r);
NIVEL.draw        = (sh)         => NIVEL.desenhar(sh);
NIVEL.build       = ()           => NIVEL.construir();
NIVEL.addWall     = (a,b,c,d)    => NIVEL.adicionarParede(a,b,c,d);
NIVEL.playerStart = NIVEL.posicaoInicialJogador;
NIVEL.triggerR    = NIVEL.raioAtivacao;
NIVEL.machine     = NIVEL.maquina;
