/* weapon.js — SMG full-auto com raycast.
   Disparo lança raio da câmera; acerto na cabeça = headshot (morte instantânea).
   Clarão do disparo via uniform uMuzzle no cel-shader. */

class Arma {
  constructor() { this.reiniciar(); }

  /** Restaura munição e estados da arma. */
  reiniciar() {
    this.tamanhoCarregador  = 20;
    this.municaoCarregador  = 20;
    // reserva conforme dificuldade (DIFÍCIL = 0 → só o pente, força headshots)
    this.municaoReserva     = (window.DIFICULDADE && typeof window.DIFICULDADE.municaoReserva === 'number')
      ? window.DIFICULDADE.municaoReserva : 60;
    this.taxaDisparo        = 0.075;  // s entre disparos (cadência full-auto)
    this.cooldownDisparo    = 0;
    this.tempoRecarrega     = 1.5;    // duração do reload em s
    this.progressoRecarga   = 0;      // tempo restante do reload (0 = inativo)
    this.danoCorpo          = 14;
    this.alcanceTiro        = 3000;   // alcance do raio em unidades do mundo
    this.intensidadeMuzzle  = 0;
    this.recuoViewmodel     = 0;
    this.timerHitmarker     = 0;
  }

  /** Inicia reload se o carregador não estiver cheio e houver reserva. */
  recarregar() {
    if (this.progressoRecarga > 0 || this.municaoCarregador >= this.tamanhoCarregador || this.municaoReserva <= 0) return;
    this.progressoRecarga = this.tempoRecarrega;
  }

  /**
   * Dispara um raio e testa colisão com zumbis.
   * [LANTERNA-NA-MAO] com a lanterna ativa, a SMG fica guardada — não dispara.
   * @returns {boolean} true se acertou um zumbi
   */
  disparar(jogador) {
    if (jogador && jogador.lanternaLigada) return false;
    if (this.progressoRecarga > 0 || this.cooldownDisparo > 0) return false;
    if (this.municaoCarregador <= 0) { this.recarregar(); return false; }

    this.municaoCarregador--;
    this.cooldownDisparo  = this.taxaDisparo;
    this.intensidadeMuzzle = 1.0;
    this.recuoViewmodel    = 1.0;

    // rajada de 3 disparos de ruído branco (p5.Noise)
    if (window.gunEnv) {
      window.gunEnv.play();
      setTimeout(() => { if (window.gunEnv) window.gunEnv.play(); }, 70);
      setTimeout(() => { if (window.gunEnv) window.gunEnv.play(); }, 140);
    }

    // RAYCAST a partir do olho do jogador
    const origemRaio  = jogador.posicaoOlhos ? jogador.posicaoOlhos() : jogador.eyePos();
    const direcaoRaio = jogador.calcularBase ? jogador.calcularBase().frente : jogador.basis().f;
    const acerto = ZUMBIS.detectarTiro
      ? ZUMBIS.detectarTiro(origemRaio, direcaoRaio, this.alcanceTiro)
      : ZOMBIES.raycast(origemRaio, direcaoRaio, this.alcanceTiro);

    if (acerto) {
      acerto.zumbi
        ? acerto.zumbi.receberDano(acerto.headshot ? 999 : this.danoCorpo)
        : acerto.zombie.takeDamage(acerto.head    ? 999 : this.danoCorpo);
      this.timerHitmarker = 0.18;
      return true;
    }
    return false;
  }

  /** Atualiza cooldowns, decaimento do clarão/recuo e conclusão do reload. */
  atualizar(dt) {
    if (this.cooldownDisparo > 0) this.cooldownDisparo -= dt;
    if (this.timerHitmarker  > 0) this.timerHitmarker  -= dt;
    this.intensidadeMuzzle = Math.max(0, this.intensidadeMuzzle - dt * 9);
    this.recuoViewmodel    = Math.max(0, this.recuoViewmodel    - dt * 7);

    if (this.progressoRecarga > 0) {
      this.progressoRecarga -= dt;
      if (this.progressoRecarga <= 0) {
        // reabastece o carregador com munição da reserva
        const balasNecessarias = this.tamanhoCarregador - this.municaoCarregador;
        const balasDisponiveis  = Math.min(balasNecessarias, this.municaoReserva);
        this.municaoCarregador += balasDisponiveis;
        this.municaoReserva    -= balasDisponiveis;
      }
    }
  }

  /**
   * Desenha o viewmodel (câmera configurada pelo game.js: camera(0,0,420,...)).
   * Usa fill plano (sem cel-shader) para evitar artefatos em GPUs ANGLE/AMD.
   * [LANTERNA-NA-MAO] quando `lanternaNaMao` é true, desenha a lanterna.
   */
  desenharViewmodel(lanternaNaMao) {
    const recuo = this.recuoViewmodel;
    resetShader(); noStroke();

    if (lanternaNaMao) { this._desenharLanternaViewmodel(); return; }

    const COR_ARMACAO   = [78, 82, 94];
    const COR_ESCURA    = [40, 42, 50];
    const COR_CANO      = [28, 28, 34];
    const COR_CORONHA   = [66, 62, 70];
    const COR_MIRA      = [104, 106, 116];
    const COR_PELE      = [178, 134, 103];

    push();
    translate(8, 34 + recuo * 5, 120 + recuo * 30);
    rotateY(0.04);
    rotateX(-0.06 + recuo * 0.14);

    // peças da SMG
    fill(COR_ARMACAO); push(); box(34, 30, 152);              pop(); // receiver
    fill(COR_ESCURA);  push(); translate(0, -18, -34); box(22, 16, 86);  pop(); // handguard
    fill(COR_CANO);    push(); translate(0, -6, -122); box(10, 10, 72);  pop(); // cano
    fill(COR_MIRA);
    push(); translate(0, -24, -94); box(4, 12, 7); pop();  // mira dianteira
    push(); translate(0, -22,  60); box(9,  9, 8); pop();  // mira traseira
    fill(COR_ESCURA);
    push(); translate(0, 34, 16); rotateX(0.18); box(18, 62, 30); pop();  // carregador
    push(); translate(0, 28, 54); rotateX(0.40); box(18, 44, 24); pop();  // punho
    fill(COR_CORONHA);
    push(); translate(0, 4, 120); box(22, 26, 72); pop();                  // coronha

    // mãos de Makise segurando a arma
    fill(COR_PELE);
    push(); translate(0,  30,  56); rotateX(0.40); box(30, 34,  34); pop();  // mão direita
    push(); translate(10, 66, 104); rotateX(0.52); box(26, 28, 100); pop();  // antebraço direito
    push(); translate(0,  -6,  -42); box(26, 26,  34); pop();               // mão esquerda
    push(); translate(-24, 52,   40); rotateX(0.5); box(24, 26, 104); pop();  // antebraço esquerdo

    // clarão do disparo (sprite aditivo na ponta do cano)
    if (this.intensidadeMuzzle > 0.02) {
      push();
      blendMode(ADD);
      tint(255, 225, 160, this.intensidadeMuzzle * 255);
      texture(TEX.glow);
      translate(0, -6, -156);
      const tamanhoFlash = 80 + this.intensidadeMuzzle * 110;
      plane(tamanhoFlash, tamanhoFlash);
      blendMode(BLEND);
      pop();
    }
    pop();
  }

  /* Desenha as mãos de Makise segurando a lanterna.
     Mesmas regras do viewmodel: resetShader+fill plano, sem cel-shader,
     brilho da lente = sprite aditivo (não point light real). */
  _desenharLanternaViewmodel() {
    const COR_CORPO = [32, 33, 38], COR_CABECA = [48, 50, 57],
          COR_BOTAO = [150, 36, 36],  COR_PELE  = [178, 134, 103];

    push();
      translate(8, 34, 120);
      rotateY(0.04);
      rotateX(-0.04);

      // cabo cilíndrico (eixo ao longo de Z)
      fill(COR_CORPO);
      push(); rotateX(HALF_PI); cylinder(15, 140, 12, 1); pop();

      // cabeça/lente (mais larga, na ponta -z)
      fill(COR_CABECA);
      push(); translate(0, 0, -82); rotateX(HALF_PI); cylinder(21, 22, 12, 1); pop();

      // botão liga/desliga
      fill(COR_BOTAO);
      push(); translate(0, 17, 30); box(8, 6, 16); pop();

      // brilho da lente: sprite aditivo (só cosmético, não ilumina o mundo)
      push();
        blendMode(ADD);
        tint(255, 248, 210, 235);
        texture(TEX.glow);
        translate(0, 0, -98);
        plane(64, 64);
        blendMode(BLEND);
      pop();

      // mãos segurando a lanterna
      fill(COR_PELE);
      push(); translate(0, 18, 28);  rotateX(0.32); box(28, 30, 38);  pop();  // mão direita
      push(); translate(8, 52, 70);  rotateX(0.50); box(26, 28, 92);  pop();  // antebraço direito
      push(); translate(0, 16, -48); box(26, 26, 34); pop();                  // mão esquerda
      push(); translate(-22, 48, -10); rotateX(0.45); box(24, 26, 92); pop();  // antebraço esquerdo
    pop();
  }
}

window.Arma   = Arma;
window.Weapon = Arma;

/* Aliases de métodos legados */
Arma.prototype.reset        = Arma.prototype.reiniciar;
Arma.prototype.reload       = Arma.prototype.recarregar;
Arma.prototype.fire         = Arma.prototype.disparar;
Arma.prototype.update       = Arma.prototype.atualizar;
Arma.prototype.drawViewmodel = Arma.prototype.desenharViewmodel;

/* Aliases de propriedades legadas */
Object.defineProperty(Arma.prototype, 'magSize',     { get() { return this.tamanhoCarregador; }, set(v) { this.tamanhoCarregador = v; } });
Object.defineProperty(Arma.prototype, 'mag',         { get() { return this.municaoCarregador; }, set(v) { this.municaoCarregador = v; } });
Object.defineProperty(Arma.prototype, 'reserve',     { get() { return this.municaoReserva; },    set(v) { this.municaoReserva = v; } });
Object.defineProperty(Arma.prototype, 'fireRate',    { get() { return this.taxaDisparo; },       set(v) { this.taxaDisparo = v; } });
Object.defineProperty(Arma.prototype, 'cooldown',    { get() { return this.cooldownDisparo; },   set(v) { this.cooldownDisparo = v; } });
Object.defineProperty(Arma.prototype, 'reloadTime',  { get() { return this.tempoRecarrega; },    set(v) { this.tempoRecarrega = v; } });
Object.defineProperty(Arma.prototype, 'reloading',   { get() { return this.progressoRecarga; },  set(v) { this.progressoRecarga = v; } });
Object.defineProperty(Arma.prototype, 'damage',      { get() { return this.danoCorpo; },         set(v) { this.danoCorpo = v; } });
Object.defineProperty(Arma.prototype, 'range',       { get() { return this.alcanceTiro; },       set(v) { this.alcanceTiro = v; } });
Object.defineProperty(Arma.prototype, 'muzzle',      { get() { return this.intensidadeMuzzle; }, set(v) { this.intensidadeMuzzle = v; } });
Object.defineProperty(Arma.prototype, 'punch',       { get() { return this.recuoViewmodel; },    set(v) { this.recuoViewmodel = v; } });
Object.defineProperty(Arma.prototype, 'lastHit',     { get() { return this.timerHitmarker; },    set(v) { this.timerHitmarker = v; } });
