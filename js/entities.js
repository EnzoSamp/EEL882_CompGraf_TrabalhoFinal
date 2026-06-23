/* entities.js — zumbis como billboards cel-shaded.
   Perseguem o jogador, atacam por proximidade e expõem esferas de colisão para raycast. */

/** Altura e largura do sprite do zumbi (unidades do mundo) */
const ALTURA_ZUMBI = 290;
const LARGURA_ZUMBI = 170;

/** Um único zumbi: posição, variante visual, vida e animação de morte. */
class Zumbi {
  /** @param {number} x, z - Posição inicial. @param {number} variante - Índice de textura (0-2). */
  constructor(x, z, variante) {
    this.x = x; this.z = z;
    this.variante   = variante % 3;
    this.vidaMaxima = 30;
    this.vida       = 30;
    const _dif = window.DIFICULDADE || { velMin: 105, velVar: 55 };
    this.velocidade = _dif.velMin + Math.random() * _dif.velVar;  // unidades/s
    this.vivo       = true;
    this.progressoMorte = 0;        // 0=em pé, 1=totalmente caído
    this.tempoFlashAcerto = 0;      // timer do piscar vermelho ao ser atingido
    this.cooldownAtaque   = 0;      // tempo até o próximo ataque
    this.tempoBobbing     = Math.random() * TWO_PI;  // fase do balanço ao andar
    this.faseSerp         = Math.random() * TWO_PI;  // fase do ziguezague (DIFÍCIL)
  }

  /** Altura do piso na posição atual (permite subir a escada). */
  alturaPisoAqui() { return (typeof NIVEL !== 'undefined' && NIVEL.alturaPiso) ? NIVEL.alturaPiso(this.x, this.z) : 0; }

  /** Esfera do tronco para raycast. @returns {{c: number[], r: number}} */
  esferaTronco() { return { c: [this.x, this.alturaPisoAqui() + EYE + 10, this.z], r: 95 }; }

  /** Esfera da cabeça para raycast (headshot = morte instantânea). @returns {{c: number[], r: number}} */
  esferaCabeca() { return { c: [this.x, this.alturaPisoAqui() + EYE + 66, this.z], r: 46 }; }

  /** Aplica dano; retorna false se já morto. */
  receberDano(dano) {
    if (!this.vivo) return false;
    this.vida -= dano;
    this.tempoFlashAcerto = 0.12;
    if (this.vida <= 0) { this.vivo = false; this.progressoMorte = 0.0001; }
    return true;
  }

  /** Atualiza perseguição, colisão e ataque. */
  atualizar(dt, jogador, aoAcertarJogador) {
    this.tempoBobbing += dt * 6;
    if (this.tempoFlashAcerto > 0) this.tempoFlashAcerto -= dt;

    if (!this.vivo) {
      this.progressoMorte = Math.min(1, this.progressoMorte + dt * 2.6);
      return;
    }

    const deltaX = jogador.x - this.x, deltaZ = jogador.z - this.z;
    const distancia = Math.hypot(deltaX, deltaZ);
    if (distancia > 120) {
      let velX = (deltaX / distancia) * this.velocidade * dt;
      let velZ = (deltaZ / distancia) * this.velocidade * dt;

      // [DIFÍCIL] ziguezague: velocidade lateral que oscila no tempo, dificultando headshots
      const serp = (window.DIFICULDADE && window.DIFICULDADE.serpentear) || 0;
      if (serp > 0) {
        const perpX = -deltaZ / distancia, perpZ = deltaX / distancia;
        const oscilacao = Math.sin(this.tempoBobbing * 1.4 + this.faseSerp) * serp;
        velX += perpX * this.velocidade * dt * oscilacao;
        velZ += perpZ * this.velocidade * dt * oscilacao;
      }

      let novoPosX = this.x + velX, novoPosZ = this.z + velZ;
      [novoPosX, novoPosZ] = NIVEL.resolverColisao(novoPosX, novoPosZ, 30);
      this.x = novoPosX; this.z = novoPosZ;
    }

    // ataque por proximidade com cooldown
    this.cooldownAtaque -= dt;
    if (distancia < 135 && this.cooldownAtaque <= 0) {
      this.cooldownAtaque = 0.85;
      if (window.sndZombie && window.sndZombie.isLoaded() && !window.sndZombie.isPlaying()) {
        window.sndZombie.play(0, 1.5, 0.3, 0.6);  // pula 0.6s de silêncio do arquivo
      }
      aoAcertarJogador((window.DIFICULDADE && window.DIFICULDADE.danoZumbi) || 26);
    }
  }

  /** Desenha o zumbi como billboard (sempre enfrenta a câmera). */
  desenhar(camX, camZ) {
    const anguloBillboard = Math.atan2(camX - this.x, camZ - this.z);
    const progMorte = this.progressoMorte > 0 ? this.progressoMorte : 0;
    const bobY      = this.vivo ? Math.sin(this.tempoBobbing) * 5 : 0;

    // iluminação: lanterna do jogador + atenuação por distância
    const jogadorRef = window.player;
    const deltaX = this.x - jogadorRef.x, deltaZ = this.z - jogadorRef.z;
    const dist   = Math.hypot(deltaX, deltaZ) || 1;
    const frenteJogador = jogadorRef.calcularBase ? jogadorRef.calcularBase().frente : jogadorRef.basis().f;
    const cosAnguloFeixe = (deltaX * frenteJogador[0] + deltaZ * frenteJogador[2]) / dist;
    const lanternaAtiva  = (typeof lanternaLigadaFn === 'function') ? lanternaLigadaFn() : jogadorRef.lanternaLigada;
    const intensidadeFeixe = (lanternaAtiva ? 1 : 0) * suavizarIntervalo(cosAnguloFeixe, 0.80, 0.97);
    const atenuacaoDistancia = Math.max(0, 1 - dist / 1600);
    const luzBase = (window.DIFICULDADE && window.DIFICULDADE.luzZumbi) || 0.02;
    let luminosidade = luzBase + intensidadeFeixe * atenuacaoDistancia * 1.6;

    let corR = luminosidade, corG = luminosidade, corB = luminosidade * 0.9;
    const corDif = (window.DIFICULDADE && window.DIFICULDADE.corZumbi) || [1, 1, 1];
    corR *= corDif[0]; corG *= corDif[1]; corB *= corDif[2];

    if (this.tempoFlashAcerto > 0) { corR = 1.8; corG = 0.5; corB = 0.5; }  // piscar ao ser atingido

    if (progMorte > 0) {  // escurece durante a animação de morte
      const f = 1 - progMorte;
      corR *= f + 0.15; corG *= f + 0.12; corB *= f + 0.12;
    }

    push();
      resetShader(); noStroke();
      translate(this.x, this.alturaPisoAqui() + ALTURA_ZUMBI * 0.5 + 5 + bobY, this.z);
      rotateY(anguloBillboard);
      rotateX(progMorte * HALF_PI * 0.9);   // tomba ao morrer
      scale(1, -(1 - progMorte * 0.5), 1);  // encolhe ao cair
      tint(Math.min(255, corR * 255), Math.min(255, corG * 255), Math.min(255, corB * 255));
      texture(TEX.zumbis[this.variante]);
      plane(LARGURA_ZUMBI, ALTURA_ZUMBI);
      noTint();
    pop();
  }
}

/** Smoothstep: mapeia x ∈ [a,b] para [0,1] com curva cúbica S. */
function suavizarIntervalo(x, a, b) {
  x = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
window.smooth01 = suavizarIntervalo;

/** Interseção raio-esfera; retorna t ≥ 0 ou -1 se não cruza. */
function intersecaoRaioEsfera(origemRaio, direcaoRaio, centroEsfera, raioEsfera) {
  const ocX = origemRaio[0] - centroEsfera[0];
  const ocY = origemRaio[1] - centroEsfera[1];
  const ocZ = origemRaio[2] - centroEsfera[2];
  const b   = ocX * direcaoRaio[0] + ocY * direcaoRaio[1] + ocZ * direcaoRaio[2];
  const c   = ocX*ocX + ocY*ocY + ocZ*ocZ - raioEsfera * raioEsfera;
  const discriminante = b * b - c;
  if (discriminante < 0) return -1;
  const raizDisc = Math.sqrt(discriminante);
  let t = -b - raizDisc;
  if (t < 0) t = -b + raizDisc;
  return t >= 0 ? t : -1;
}

/** Interseção raio-AABB 3D pelo método dos slabs; retorna t de entrada ou -1. */
function intersecaoRaioCaixa3D(origem, direcao, caixaMin, caixaMax) {
  let tEntrada = 0, tSaida = Infinity;
  for (let eixo = 0; eixo < 3; eixo++) {
    if (Math.abs(direcao[eixo]) < 1e-8) {
      if (origem[eixo] < caixaMin[eixo] || origem[eixo] > caixaMax[eixo]) return -1;
    } else {
      let tA = (caixaMin[eixo] - origem[eixo]) / direcao[eixo];
      let tB = (caixaMax[eixo] - origem[eixo]) / direcao[eixo];
      if (tA > tB) { const tmp = tA; tA = tB; tB = tmp; }
      if (tA > tEntrada) tEntrada = tA;
      if (tB < tSaida)   tSaida   = tB;
      if (tEntrada > tSaida) return -1;
    }
  }
  return tEntrada;
}

/** Gerenciador global de zumbis: criação, atualização, desenho e raycast. */
const ZUMBIS = {
  lista: [],

  /** Reinicia todos os zumbis nas posições do mapa. Chamado no início e no restart. */
  reiniciar() {
    this.lista = [];
    // [x, z, variante]: quarto, corredor, câmara final
    const posicoes = [
      // quarto inicial — resistência logo após a porta da escada
      [-150,  820,  1],  // canto cego perto da porta
      [ 120,  450,  0],
      [-120, -430,  0], [  90, -520,  1], [ -40, -640,  2],   // sala 1
      [ 130, -940,  1], [-110,-1020,  0], [  30,-1140,  2],   // sala 2
      [-140,-1380,  2], [ 120,-1450,  0], [ -30,-1560,  1], [60,-1620, 2], // sala 3
      [-260,-2150,  0], [ 240,-2230,  1], [-180,-2380,  2], [200,-2420, 0], // câmara final
    ];

    const dif        = window.DIFICULDADE || {};
    const dispersao  = dif.dispersaoSpawn || 0;
    const extras     = dif.extraZumbis    || 0;

    // [DIFÍCIL] extras espalhados pelo corredor (z≈-1900..700), fora da câmara
    for (let i = 0; i < extras; i++) {
      const x = -170 + Math.random() * 340;
      const z = -1900 + Math.random() * 2600;
      posicoes.push([x, z, i % 3]);
    }

    for (const pos of posicoes) {
      let x = pos[0] + (dispersao ? (Math.random() * 2 - 1) * dispersao : 0);
      let z = pos[1] + (dispersao ? (Math.random() * 2 - 1) * dispersao : 0);
      // se a dispersão jogou para fora da área jogável, volta à posição original
      if (!ZUMBIS.pontoJogavel(x, z)) { x = pos[0]; z = pos[1]; }
      [x, z] = NIVEL.resolverColisao(x, z, 40);
      // guarda final: se ainda inválido, usa posição original
      if (!ZUMBIS.pontoJogavel(x, z)) { x = pos[0]; z = pos[1]; }
      this.lista.push(new Zumbi(x, z, pos[2]));
    }
  },

  /** Retorna true se (x,z) está dentro de uma região caminhável do mapa. */
  pontoJogavel(x, z) {
    if (x >= -195 && x <= 195 && z >= -1980 && z <= 940)   return true;  // corredor + quarto
    if (x >= -475 && x <= 475 && z >= -2695 && z <= -1985) return true;  // câmara final
    return false;
  },

  /** Número de zumbis vivos em todo o mapa. */
  totalVivos() { return this.lista.filter(z => z.vivo).length; },

  /** Número de zumbis vivos dentro da câmara final (z < -1980). */
  vivosNaCamara() { return this.lista.filter(z => z.vivo && z.z < -1980).length; },

  /** Atualiza todos e remove os que terminaram a animação de morte. */
  atualizar(dt, jogador, aoAcertarJogador) {
    for (const zumbi of this.lista) zumbi.atualizar(dt, jogador, aoAcertarJogador);
    this.lista = this.lista.filter(z => z.vivo || z.progressoMorte < 1);
  },

  /** Desenha todos, ordenados de trás para frente (painter's algorithm). */
  desenhar(camX, camZ) {
    const ordenados = [...this.lista].sort((a, b) => {
      const distA = (a.x - camX)**2 + (a.z - camZ)**2;
      const distB = (b.x - camX)**2 + (b.z - camZ)**2;
      return distB - distA;
    });
    const gl = drawingContext;
    gl.depthMask(false);  // billboards não escrevem no depth buffer (evita corte entre sprites)
    for (const zumbi of ordenados) zumbi.desenhar(camX, camZ);
    gl.depthMask(true);
  },

  /**
   * Raycast contra todos os zumbis vivos. Testa cabeça (headshot) e depois tronco.
   * Retorna o zumbi mais próximo atingido, ou null se nenhum.
   * @returns {{zumbi: Zumbi, t: number, headshot: boolean}|null}
   */
  detectarTiro(origemRaio, direcaoRaio, alcanceMaximo) {
    let melhorAlvo = null;
    let menorT = alcanceMaximo;
    for (const zumbi of this.lista) {
      if (!zumbi.vivo) continue;
      const esfCabeca = zumbi.esferaCabeca(), esfTronco = zumbi.esferaTronco();
      const tCabeca  = intersecaoRaioEsfera(origemRaio, direcaoRaio, esfCabeca.c, esfCabeca.r);
      const tTronco  = intersecaoRaioEsfera(origemRaio, direcaoRaio, esfTronco.c, esfTronco.r);
      let tHit = -1, headshot = false;
      if (tCabeca >= 0) { tHit = tCabeca; headshot = true; }
      else if (tTronco >= 0) { tHit = tTronco; headshot = false; }
      if (tHit >= 0 && tHit < menorT) { menorT = tHit; melhorAlvo = { zumbi, t: tHit, headshot }; }
    }

    if (!melhorAlvo) return null;

    // limiar de oclusão = projeção do CENTRO do tronco no raio (não da superfície)
    // evita que hitboxes largas "vazem" através de paredes estreitas
    const centroAlvo = melhorAlvo.zumbi.esferaTronco().c;
    const limiteOclusao =
      (centroAlvo[0] - origemRaio[0]) * direcaoRaio[0] +
      (centroAlvo[1] - origemRaio[1]) * direcaoRaio[1] +
      (centroAlvo[2] - origemRaio[2]) * direcaoRaio[2];

    // [PORTA-ESCADA] bala bloqueada pela porta fechada
    if (typeof NIVEL !== 'undefined' && NIVEL.portaEscada && NIVEL.portaEscada.estado !== 'ABERTA') {
      const p = NIVEL.portaEscada;
      const tPorta = intersecaoRaioCaixa3D(origemRaio, direcaoRaio, [p.minX, 0, p.minZ], [p.maxX, 300, p.maxZ]);
      if (tPorta >= 0 && tPorta < limiteOclusao) return null;
    }

    // [PAREDES] bala bloqueada por qualquer AABB do nível (faixa Y=[-10..700])
    if (typeof NIVEL !== 'undefined' && NIVEL.paredesColisao) {
      for (const parede of NIVEL.paredesColisao) {
        const tParede = intersecaoRaioCaixa3D(origemRaio, direcaoRaio,
          [parede.minX, -10, parede.minZ], [parede.maxX, 700, parede.maxZ]);
        if (tParede >= 0 && tParede < limiteOclusao) return null;
      }
    }

    // [OBSTÁCULOS DE TIRO] peças visuais (ex.: verga da porta) com altura exata
    if (typeof NIVEL !== 'undefined' && NIVEL.obstaculosTiro) {
      for (const obs of NIVEL.obstaculosTiro) {
        const tObs = intersecaoRaioCaixa3D(origemRaio, direcaoRaio,
          [obs.minX, obs.minY, obs.minZ], [obs.maxX, obs.maxY, obs.maxZ]);
        if (tObs >= 0 && tObs < limiteOclusao) return null;
      }
    }
    return melhorAlvo;
  }
};

window.Zumbi  = Zumbi;
window.ZUMBIS = ZUMBIS;
window.Zombie  = Zumbi;   // alias legado
window.ZOMBIES = ZUMBIS;  // alias legado
