/* intro.js — sequência inicial estilo visual novel.
   Slides com ilustrações Bézier + legendas, fade-in/out suave.
   Avança por tempo ou clique; Esc pula direto para o gameplay.
   Degrada com placeholder se a arte ainda não foi desenhada. */

/** Gerencia a sequência de introdução. */
class SequenciaIntro {
  /** @param {Function} aoTerminar - Callback chamado ao fim de todos os slides. */
  constructor(aoTerminar) {
    this.aoTerminar = aoTerminar;
    this.ativa = false;
    this._texturaBranca = null;  // placeholder 4×4 branco para artes pendentes

    // roteiro: arte (chave em ILUSTRACOES), duração (s), legenda
    this.slides = [
      { arte: 'Entrada_bunker', duracao: 6.5, legenda: 'O mundo foi devastado. Um patógeno transformou a humanidade em mortos que caminham.' },
      { arte: 'Entrada_bunker', duracao: 6.5, legenda: 'Mais de 90% da humanidade foi infectada. Mas há esperança — um bunker com uma máquina do tempo.' },
      { arte: 'Makise_arma',    duracao: 6.5, legenda: 'Makise Kurisu conseguiu fazer a cura da doença, a qual está em seu bolso.' },
      { arte: 'Makise_arma',    duracao: 7.0, legenda: 'Seu objetivo é achar a máquina do tempo no bunker e enviar a cura para o passado e salvar a humanidade.' },
    ];
  }

  /** Inicia a sequência a partir do primeiro slide. */
  iniciar() {
    this.ativa = true;
    this.indiceSlide = 0;
    this.tempoSlide  = 0;
    setLabel('clique p/ avançar  ·  Esc pula');
    this._aplicarSlide();
  }

  /** Aplica o slide atual: exibe legenda (indica pendente se arte ainda não pronta). */
  _aplicarSlide() {
    const slide    = this.slides[this.indiceSlide];
    const ilustracao = ILUSTRACOES[slide.arte] || ILLUS[slide.arte];
    const pendente = (ilustracao && ilustracao.estaPronta()) ? '' : '   [' + slide.arte + ': ilustração pendente]';
    setSubtitle(slide.legenda + pendente);
  }

  /** Avança para o próximo slide; encerra ao passar do último. */
  avancar() {
    if (!this.ativa) return;
    this.indiceSlide++;
    if (this.indiceSlide >= this.slides.length) { this.encerrar(); return; }
    this.tempoSlide = 0;
    this._aplicarSlide();
  }

  /** Pula toda a sequência. */
  pular() { this.encerrar(); }

  /** Encerra a sequência e chama o callback. */
  encerrar() {
    if (!this.ativa) return;
    this.ativa = false;
    setSubtitle(''); setLabel('');
    if (this.aoTerminar) this.aoTerminar();
  }

  /** Avança automaticamente ao expirar a duração do slide. */
  atualizar(dt) {
    if (!this.ativa) return;
    this.tempoSlide += dt;
    if (this.tempoSlide >= this.slides[this.indiceSlide].duracao) this.avancar();
  }

  /** Desenha o slide atual com fade-in (0.6s) / fade-out (0.6s) e preserva aspecto. */
  desenhar() {
    setPerspective();
    camera(0, 0, 600, 0, 0, 0, 0, -1, 0);
    background(6, 9, 14);
    resetShader(); noStroke();
    // NÃO mexer no DEPTH_TEST via gl cru: dessincroniza GPUs ANGLE e deixa o mundo branco

    if (this.ativa) {
      const slide  = this.slides[this.indiceSlide];
      const duracao = slide.duracao;

      // alpha com fade-in e fade-out de 0.6s
      const alphaFadeIn  = Math.min(1, this.tempoSlide / 0.6);
      const alphaFadeOut = Math.min(1, (duracao - this.tempoSlide) / 0.6);
      const alpha = 255 * Math.max(0, Math.min(alphaFadeIn, alphaFadeOut));

      // dimensões do plano preservando aspecto
      const alturaVisivel = 2 * 600 * Math.tan((PI / 3) / 2);
      const larguraVisivel = alturaVisivel * (width / height);
      const ilustracao = ILUSTRACOES[slide.arte] || ILLUS[slide.arte];
      const ilustracaoPronta = ilustracao && ilustracao.estaPronta();
      const aspectoImagem = ilustracaoPronta ? ilustracao.proporcaoAspecto() : 0.75;
      let alturaPlano = alturaVisivel * 0.86;
      let larguraPlano = alturaPlano * aspectoImagem;
      if (larguraPlano > larguraVisivel * 0.92) { larguraPlano = larguraVisivel * 0.92; alturaPlano = larguraPlano / aspectoImagem; }

      if (ilustracaoPronta) {
        push(); tint(255, alpha); scale(1, -1, 1); texture(ilustracao.bufferGrafico); plane(larguraPlano, alturaPlano); pop();
      } else {
        // placeholder: moldura escura simples
        if (!this._texturaBranca) {
          this._texturaBranca = createGraphics(4, 4);
          this._texturaBranca.pixelDensity(1);
          this._texturaBranca.background(255);
        }
        push(); tint(26, 34, 48, alpha); texture(this._texturaBranca); plane(larguraPlano, alturaPlano); pop();
        push(); translate(0, 0, 2); tint(10, 15, 23, alpha); texture(this._texturaBranca); plane(larguraPlano - 12, alturaPlano - 12); pop();
      }
    }
  }

  /* Aliases para compatibilidade com game.js */
  start()   { return this.iniciar();  }
  next()    { return this.avancar();  }
  skip()    { return this.pular();    }
  end()     { return this.encerrar(); }
  update(dt){ return this.atualizar(dt); }
  draw()    { return this.desenhar(); }
}

window.SequenciaIntro = SequenciaIntro;
window.IntroSequence  = SequenciaIntro;  // alias legado
