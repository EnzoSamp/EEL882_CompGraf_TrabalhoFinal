/* cutscene.js — clímax de "Operation Skuld". 4 fases:
   A. ESPIRAL  (0–6s)   : câmera orbita a máquina do tempo (coordenadas cilíndricas).
   B. PORTAL   (6–10s)  : caleidoscópio abstrato simulando abertura do portal.
   C. TÚNEL    (10–20.5s): Makises em perspectiva recuando para um ponto de fuga.
   D. FINAL    (>20.5s) : fade branco e tela de vitória. */

class Cutscene {
  /** @param {Function} aoTerminar - Callback chamado ao fim da cutscene. */
  constructor(aoTerminar) {
    this.aoTerminar = aoTerminar;
    this.ativa = false;
  }

  /** Inicializa estado, keyframes de câmera, roteiro de legendas e instâncias do túnel. */
  iniciar() {
    this.ativa = true;
    this.tempoDecorrido = 0;
    this.faseAtual = -1;
    this.indiceLegenda = -1;
    this.ativouFadeFinal = false;

    const maquina = NIVEL.maquina || LEVEL.machine;
    this.centroOrbita = [maquina.x, EYE + 40, maquina.z];

    // roteiro: [tempo de exibição (s), texto]
    this.roteiro = [
      [1.0, 'Iniciando a máquina do tempo...'],
      [10.2, 'Viajando pelas linhas temporais...'],
      [14.5, 'A cura alcançou o passado... e o futuro.'],
      [17.8, 'A humanidade foi salva.'],
    ];

    // 8 instâncias do túnel alternando lado (direita/esquerda), espaçadas em profundidade
    this.instanciasTunel = [];
    const numInstancias = 8;
    for (let i = 0; i < numInstancias; i++) {
      this.instanciasTunel.push({
        faseInicial: i / numInstancias,
        ladoDireto: (i % 2 === 0) ? 1 : -1  // +1=normal, -1=espelhado
      });
    }

    setSubtitle('');
    fadeTo(false);
  }

  /** Muda a fase ativa (sem reprocessar se já for a mesma). */
  _definirFase(novaFase) {
    if (novaFase === this.faseAtual) return;
    this.faseAtual = novaFase;
  }

  /** Avança tempo, define fase, exibe legenda e aciona fade final. */
  atualizar(dt) {
    if (!this.ativa) return;
    this.tempoDecorrido += dt;

    if (this.tempoDecorrido < 6.0) this._definirFase(0);
    else if (this.tempoDecorrido < 10.0) this._definirFase(1);
    else if (this.tempoDecorrido < 20.5) this._definirFase(2);
    else {
      this.ativa = false; setSubtitle('');
      if (this.aoTerminar) this.aoTerminar();
      return;
    }

    if (this.tempoDecorrido > 19.4 && !this.ativouFadeFinal) {
      this.ativouFadeFinal = true; fadeWhite(true);
    }

    // exibe a legenda do roteiro no momento correto
    for (let i = this.roteiro.length - 1; i >= 0; i--) {
      if (this.tempoDecorrido >= this.roteiro[i][0]) {
        if (this.indiceLegenda !== i) { this.indiceLegenda = i; setSubtitle(this.roteiro[i][1]); }
        break;
      }
    }
  }

  /** Avança para a próxima fase ao pressionar Skip. */
  pularFase() {
    if (!this.ativa) return;
    if (this.tempoDecorrido < 6.0) this.tempoDecorrido = 6.0;
    else if (this.tempoDecorrido < 10.0) this.tempoDecorrido = 10.0;
    else if (this.tempoDecorrido < 20.5) this.tempoDecorrido = 20.5;
  }

  /** Delega o desenho para a fase ativa. */
  desenhar() {
    if (this.faseAtual === 0) this._desenharEspiral();
    else if (this.faseAtual === 1) this._desenharPortal();
    else this._desenharTunel();
  }

  /* FASE A — câmera orbita a máquina em 1.5 voltas (540°) subindo/descendo. */
  _desenharEspiral() {
    setPerspective();

    const progressoSuave = this._suavizar(Math.min(1, this.tempoDecorrido / 6.0));
    const anguloOrbita = progressoSuave * Math.PI * 2 * 1.5;

    // inclinação vertical oscila suavemente
    const tInclinacao = 0.5 + 0.5 * Math.sin(this.tempoDecorrido * 0.9);
    const inclinacao = lerp(-0.45, 0.30, tInclinacao);
    const cosInc = Math.cos(inclinacao), senInc = Math.sin(inclinacao);

    const raioOrbita = lerp(200, 300, progressoSuave);
    const centro = this.centroOrbita;

    // posição do olho em coordenadas cilíndricas
    const posicaoOlho = [
      centro[0] + raioOrbita * cosInc * Math.sin(anguloOrbita),
      centro[1] - raioOrbita * senInc,
      centro[2] + raioOrbita * cosInc * Math.cos(anguloOrbita)
    ];
    camera(posicaoOlho[0], posicaoOlho[1], posicaoOlho[2],
      centro[0], centro[1], centro[2],
      0, -1, 0);

    // atualiza CAMINVROT para o environment mapping
    const vetorFrente = Vec3.normalizar(Vec3.subtrair(centro, posicaoOlho));
    const vetorDireita = Vec3.normalizar(Vec3.cruzado(vetorFrente, [0, -1, 0]));
    window.CAMINVROT = invViewRotFrom(vetorFrente, vetorDireita, Vec3.cruzado(vetorDireita, vetorFrente));

    background(5, 8, 13);
    const sh = SHD.cel; shader(sh);
    applyCelGlobals({ flash: 0, muzzle: 0, ambient: 0.18, fogDensity: 0.0009, fog: [0.02, 0.04, 0.07], bands: 4 });
    LEVEL.draw(sh);
    drawMachine(0.85 + 0.6 * Math.sin(this.tempoDecorrido * 3.0));
  }

  /* FASE B — caleidoscópio: segmentos radiais ciano/magenta com blendMode(ADD). */
  _desenharPortal() {
    setPerspective();
    camera(0, 0, 700, 0, 0, 0, 0, -1, 0);

    const tempoPortal = this.tempoDecorrido - 6.0;
    const progressoAbertura = this._suavizar(Math.min(1, tempoPortal / 4.0));

    background(2, 3, 9);
    resetShader(); noStroke();
    // depthMask(false) em vez de gl.disable(DEPTH_TEST): seguro em GPUs ANGLE/AMD
    const gl = drawingContext; gl.depthMask(false);

    blendMode(ADD);
    const numSegmentos = 16;
    for (let i = 0; i < numSegmentos; i++) {
      push();
      rotateZ(i / numSegmentos * Math.PI * 2 + this.tempoDecorrido * 0.6);
      if (i % 2 === 0) tint(60, 200, 255, 80 + 130 * progressoAbertura);
      else tint(255, 90, 200, 80 + 130 * progressoAbertura);
      texture(TEX.glowCyan);
      translate(0, -130 - 180 * progressoAbertura, 0);
      plane(90 + 60 * progressoAbertura, 360 + 300 * progressoAbertura);
      pop();
    }
    // núcleo branco crescente
    push();
    tint(255, 255, 255, 110 + 130 * progressoAbertura);
    texture(TEX.glow);
    plane(160 + 560 * progressoAbertura, 160 + 560 * progressoAbertura);
    pop();
    blendMode(BLEND);
    // sem noTint() — tints escopados em push/pop, não vazam para o cel-shader
    gl.depthMask(true);
  }

  /* FASE C — múltiplas Makises recuam em perspectiva para um ponto de fuga.
     Câmera alta olha de cima; velocidade cresce ao longo do tempo. */
  _desenharTunel() {
    setPerspective();
    const tempoTunel = this.tempoDecorrido - 10.0;
    camera(0, 550, 0, 0, 230, -1000, 0, -1, 0);
    background(14, 20, 36);
    resetShader(); noStroke();

    if (!MAKISE.ready()) return;

    const gl = drawingContext; gl.depthMask(false);

    // ponto de fuga brilhante ao fundo
    blendMode(ADD);
    push(); tint(110, 180, 255, 150); texture(TEX.glowCyan); translate(0, 150, -1700); plane(1500, 1500); pop();
    push(); tint(255, 255, 255, 200); texture(TEX.glow); translate(0, 150, -1650); plane(560, 560); pop();
    blendMode(BLEND);

    const zProximo = 430, zLonge = 8500, comprimentoTunel = zLonge - zProximo;
    const alturaSprite = 560, larguraSprite = alturaSprite * MAKISE.aspect();
    const centroY = 230, deslocamentoX = 230;

    const velocidadeViagem = 0.015 * tempoTunel + 0.08 * tempoTunel * tempoTunel;

    // ordena do mais distante ao mais próximo 
    const instanciasOrdenadas = this.instanciasTunel.map(inst => {
      let fase = (inst.faseInicial - velocidadeViagem) % 1;
      if (fase < 0) fase += 1;
      return { inst, fase, profundidade: zProximo + fase * comprimentoTunel };
    }).sort((a, b) => b.profundidade - a.profundidade);

    for (const item of instanciasOrdenadas) {
      const { inst, fase, profundidade } = item;
      const posX = inst.ladoDireto * deslocamentoX;
      const flip = inst.ladoDireto;

      // suaviza entrada (ao longe) e saída (muito perto)
      const alpha = 255 * Math.min(
        suavizarIntervalo(fase, 1.0, 0.92),
        suavizarIntervalo(fase, 0.0, 0.025)
      );
      if (alpha < 2) continue;

      // rastro: versão transparente ligeiramente à frente (simula blur radial)
      push(); translate(posX, centroY, -(profundidade + 160)); scale(flip, -1, 1);
      tint(255, alpha * 0.26); texture(MAKISE.gfx); plane(larguraSprite, alturaSprite); pop();

      // instância principal
      push(); translate(posX, centroY, -profundidade); scale(flip, -1, 1);
      tint(255, alpha); texture(MAKISE.gfx); plane(larguraSprite, alturaSprite); pop();
    }
    gl.depthMask(true);
  }

  /** Smoothstep: mapeia x ∈ [0,1] para curva cúbica S. */
  _suavizar(x) { return x * x * (3 - 2 * x); }

  /* Aliases para compatibilidade com game.js */
  start() { return this.iniciar(); }
  update(dt) { return this.atualizar(dt); }
  draw() { return this.desenhar(); }
  get active() { return this.ativa; }
  set active(v) { this.ativa = v; }
  get phase() { return this.faseAtual; }
}

window.Cutscene = Cutscene;
