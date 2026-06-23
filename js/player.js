/* player.js — câmera FPS (Makise Kurisu).
   Mouse-look via Pointer Lock (yaw/pitch), movimento WASD com colisão AABB
   e base ortonormal usada pelo raycast e pelo environment mapping. */

class Jogador {
  constructor() { this.reiniciar(); }

  /** Restaura todos os atributos para os valores iniciais. */
  reiniciar() {
    this.x      = NIVEL.posicaoInicialJogador.x;
    this.z      = NIVEL.posicaoInicialJogador.z;
    this.yaw    = NIVEL.posicaoInicialJogador.yaw;  // PI → olhando para -Z
    this.pitch  = 0;
    // altura dos olhos = piso no spawn + EYE (suporta escada)
    this.alturaOlhosAtual = (NIVEL.alturaPiso ? NIVEL.alturaPiso(this.x, this.z) : 0) + EYE;
    this.vida   = 100;
    this.raioColisao = 34;
    this.velocidade  = 330;       // unidades/s
    this.sensibilidade = 0.0023;  // rad/pixel
    this.lanternaLigada = false;
    this.vivo   = true;
    this.tempoBobbing  = 0;
    this.amplitudeBobbing = 0;
  }

  /**
   * Base ortonormal da câmera (yaw + pitch).
   * @returns {{frente: number[], direita: number[], cima: number[]}}
   */
  calcularBase() {
    const cosPitch = Math.cos(this.pitch), senPitch = Math.sin(this.pitch);
    const frente  = [ cosPitch * Math.sin(this.yaw), senPitch, cosPitch * Math.cos(this.yaw) ];
    const direita = Vec3.normalizar([frente[2], 0, -frente[0]]);
    const cima    = Vec3.cruzado(direita, frente);
    return { frente, direita, cima };
  }

  /** Posição dos olhos como [x, y, z] — origem do raio de tiro. */
  posicaoOlhos() { return [this.x, this.alturaOlhosAtual, this.z]; }

  /** Atualiza yaw/pitch com o delta do mouse (Pointer Lock). */
  olhar(deltaX, deltaY) {
    this.yaw   += deltaX * this.sensibilidade;
    this.pitch -= deltaY * this.sensibilidade;
    const limPitch = 1.45;  // ~83°
    this.pitch = Math.max(-limPitch, Math.min(limPitch, this.pitch));
  }

  /** Movimento WASD/setas, colisão AABB e bobbing da câmera. */
  atualizar(dt) {
    const frenteX = Math.sin(this.yaw), frenteZ = Math.cos(this.yaw);
    const direitaX = frenteZ, direitaZ = -frenteX;

    let movX = 0, movZ = 0;
    if (keyIsDown(87) || keyIsDown(UP_ARROW))    { movX += frenteX;  movZ += frenteZ; }   // W/↑
    if (keyIsDown(83) || keyIsDown(DOWN_ARROW))  { movX -= frenteX;  movZ -= frenteZ; }   // S/↓
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) { movX += direitaX; movZ += direitaZ; }  // D/→
    if (keyIsDown(65) || keyIsDown(LEFT_ARROW))  { movX -= direitaX; movZ -= direitaZ; }  // A/←

    const comprimentoMov = Math.hypot(movX, movZ);
    if (comprimentoMov > 0) {
      movX /= comprimentoMov; movZ /= comprimentoMov;  // normaliza (sem boost diagonal)
      let novoPosX = this.x + movX * this.velocidade * dt;
      let novoPosZ = this.z + movZ * this.velocidade * dt;
      [novoPosX, novoPosZ] = NIVEL.resolverColisao(novoPosX, novoPosZ, this.raioColisao);
      this.x = novoPosX; this.z = novoPosZ;
      this.tempoBobbing  += dt * 10;
      this.amplitudeBobbing = lerp(this.amplitudeBobbing, 1, dt * 6);
    } else {
      this.amplitudeBobbing = lerp(this.amplitudeBobbing, 0, dt * 8);
    }

    // [ESCADARIA] segue a altura do piso suavemente (lerp evita solavanco nos degraus)
    if (NIVEL.alturaPiso) {
      const alturaAlvo = NIVEL.alturaPiso(this.x, this.z) + EYE;
      this.alturaOlhosAtual += (alturaAlvo - this.alturaOlhosAtual) * Math.min(1, dt * 12);
    }
  }

  /** Aplica dano; marca como morto se vida ≤ 0. */
  receberDano(quantidadeDano) {
    if (!this.vivo) return;
    this.vida -= quantidadeDano;
    if (this.vida <= 0) { this.vida = 0; this.vivo = false; }
  }

  /** Aplica a câmera FPS com bobbing vertical ao andar. */
  aplicarCamera() {
    const { frente } = this.calcularBase();
    const bobbing = Math.sin(this.tempoBobbing) * 2.5 * this.amplitudeBobbing;
    const alturaComBob = this.alturaOlhosAtual + bobbing;
    camera(
      this.x, alturaComBob, this.z,
      this.x + frente[0], alturaComBob + frente[1], this.z + frente[2],
      0, -1, 0
    );
  }

  /**
   * Matriz 3×3 de rotação inversa câmera→mundo (column-major).
   * Usada pelo shader de environment mapping (uniform uInvViewRot).
   */
  matrizRotacaoInversaCamara() {
    const { frente, direita, cima } = this.calcularBase();
    // colunas: right, up, -forward
    return [ direita[0], direita[1], direita[2],
             cima[0],    cima[1],    cima[2],
            -frente[0], -frente[1], -frente[2] ];
  }
}

window.Jogador = Jogador;
window.Player  = Jogador;

/* Aliases de métodos legados */
Jogador.prototype.reset       = Jogador.prototype.reiniciar;
Jogador.prototype.look        = Jogador.prototype.olhar;
Jogador.prototype.update      = Jogador.prototype.atualizar;
Jogador.prototype.takeDamage  = Jogador.prototype.receberDano;
Jogador.prototype.applyCamera = Jogador.prototype.aplicarCamera;
Jogador.prototype.invViewRot  = Jogador.prototype.matrizRotacaoInversaCamara;
Jogador.prototype.eyePos      = Jogador.prototype.posicaoOlhos;
Jogador.prototype.basis       = Jogador.prototype.calcularBase;

/* Aliases de propriedades legadas */
Object.defineProperty(Jogador.prototype, 'flashOn', { get() { return this.lanternaLigada; }, set(v) { this.lanternaLigada = v; } });
Object.defineProperty(Jogador.prototype, 'alive',   { get() { return this.vivo; },           set(v) { this.vivo = v; } });
Object.defineProperty(Jogador.prototype, 'health',  { get() { return this.vida; },           set(v) { this.vida = v; } });
Object.defineProperty(Jogador.prototype, 'eye',     { get() { return this.alturaOlhosAtual; }, set(v) { this.alturaOlhosAtual = v; } });
