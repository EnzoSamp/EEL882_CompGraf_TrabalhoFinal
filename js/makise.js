/* makise.js — Ilustrações vetoriais por curvas de Bézier.
   `Ilustracao` recebe um JSON (editado no editor.html) e renderiza para um
   buffer p5.Graphics usado como textura (billboard / plano na tela).
   - MAKISE_BEZIER : Makise do clímax (assets/makise_curves.json)
   - ILUSTRACOES   : ilustrações da narrativa (carregadas assincronamente) */

/** Ilustração vetorial construída a partir de curvas de Bézier. */
class Ilustracao {
  constructor() {
    this.curvases = null;      // JSON de caminhos (null até carregar)
    this.bufferGrafico = null; // buffer 2D gerado (null até construir)
  }

  /** Define o JSON de curvas e limpa o buffer anterior. @returns {this} */
  definirCurvas(json) { this.curvases = json; this.bufferGrafico = null; return this; }

  /**
   * (Re)constrói o buffer 2D transparente com as curvas de Bézier.
   * @returns {p5.Graphics|null}
   */
  construirBufferGrafico() {
    if (!this.curvases || !this.curvases.paths) return null;
    const largura = this.curvases.width  || 560;
    const altura  = this.curvases.height || 760;
    const buffer  = createGraphics(largura, altura);
    buffer.pixelDensity(1);
    buffer.clear();

    for (const caminho of this.curvases.paths) {
      const ancoras = caminho.anchors || [];
      if (ancoras.length < 2) continue;

      if (caminho.fill)   buffer.fill(caminho.color);   else buffer.noFill();
      if (caminho.stroke) {
        buffer.stroke(caminho.strokeColor || '#000');
        buffer.strokeWeight(caminho.strokeW || 2);
        buffer.strokeJoin(ROUND);
      } else buffer.noStroke();

      buffer.beginShape();
      buffer.vertex(ancoras[0].x, ancoras[0].y);
      for (let i = 0; i < ancoras.length - 1; i++) {
        const atual   = ancoras[i];
        const proximo = ancoras[i + 1];
        // handle-saída do atual, handle-entrada do próximo, ponto de chegada
        buffer.bezierVertex(atual.hox, atual.hoy, proximo.hix, proximo.hiy, proximo.x, proximo.y);
      }
      if (caminho.closed) {
        const ultimo   = ancoras[ancoras.length - 1];
        const primeira = ancoras[0];
        buffer.bezierVertex(ultimo.hox, ultimo.hoy, primeira.hix, primeira.hiy, primeira.x, primeira.y);
        buffer.endShape(CLOSE);
      } else {
        buffer.endShape();
      }
    }
    this.bufferGrafico = buffer;
    return buffer;
  }

  /** Carrega JSON e já constrói o buffer. Ignora JSON inválido/vazio. @returns {this} */
  carregarEConstruir(json) {
    if (json && json.paths && json.paths.length) {
      this.definirCurvas(json);
      this.construirBufferGrafico();
    }
    return this;
  }

  /** @returns {boolean} true se o buffer foi construído. */
  estaPronta() { return !!this.bufferGrafico; }

  /** @returns {number} Aspect ratio (default 0.73 se não construído). */
  proporcaoAspecto() { return this.bufferGrafico ? this.bufferGrafico.width / this.bufferGrafico.height : 0.73; }

  /* Aliases legados */
  get gfx()    { return this.bufferGrafico; }
  ready()      { return this.estaPronta(); }
  aspect()     { return this.proporcaoAspecto(); }
  setCurves(j) { return this.definirCurvas(j); }
  build()      { return this.construirBufferGrafico(); }
  load(j)      { return this.carregarEConstruir(j); }
}
window.Illustration = Ilustracao;

/** Makise Kurisu usada na cutscene (assets/makise_curves.json). */
const MAKISE_BEZIER = new Ilustracao();
window.MAKISE_BEZIER = MAKISE_BEZIER;
window.MAKISE = MAKISE_BEZIER;  // alias legado

/**
 * Registro global das ilustrações da narrativa.
 * Iniciam "não prontas" → placeholder até as artes serem desenhadas no editor.html.
 */
const ILUSTRACOES = {
  Entrada_bunker: new Ilustracao(),
  Makise_arma:    new Ilustracao(),
};
window.ILUSTRACOES = ILUSTRACOES;
window.ILLUS = ILUSTRACOES;  // alias legado
