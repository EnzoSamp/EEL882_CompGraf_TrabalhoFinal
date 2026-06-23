/* game.js — orquestra todos os sistemas do jogo (p5.js modo global).

   ESTADOS:
     INTRO     → menu com cenário animado ao fundo
     NARRATIVE → visual novel (SequenciaIntro)
     PLAY      → gameplay FPS
     CUTSCENE  → cinemática final (Cutscene)
     END / DEAD → overlays DOM */

/** Shaders compilados: cel (cenário) e env (environment mapping da máquina). */
let shadersCompilados = {};

/** Estado atual do jogo. */
let estadoAtual = 'INTRO';

/** true quando o Pointer Lock está ativo. */
let mouseCaptarado = false;

/** true quando o botão do mouse está pressionado (tiro full-auto). */
let botaoMousePressionado = false;

/** Última vida registrada do jogador (detecta variação de HP). */
let ultimaVidaJogador = 100;

/* ============================================================
   DIFICULDADE
   luzAmbiente  : luz ambiente do cel-shader
   luzZumbi     : luminosidade-base do billboard do zumbi
   danoZumbi    : dano por ataque (999 = hit-kill)
   velMin/Var   : velocidade = velMin + random()*velVar
   municaoReserva: balas na reserva
   extraZumbis  : zumbis além dos 16 fixos
   dispersaoSpawn: raio de aleatoriedade do spawn
   serpentear   : amplitude do ziguezague (0 = reto)
   corZumbi     : multiplicador RGB do tint do zumbi
   ============================================================ */
const DIFICULDADES = {
  facil: { nome: 'FÁCIL', luzAmbiente: 0.30, luzZumbi: 0.62, danoZumbi: 6, velMin: 50, velVar: 25, municaoReserva: 120, extraZumbis: 0, dispersaoSpawn: 0, serpentear: 0, corZumbi: [1, 1, 1] },
  normal: { nome: 'NORMAL', luzAmbiente: 0.0005, luzZumbi: 0.02, danoZumbi: 26, velMin: 140, velVar: 70, municaoReserva: 40, extraZumbis: 0, dispersaoSpawn: 0, serpentear: 0, corZumbi: [1, 1, 1] },
  dificil: { nome: 'DIFÍCIL', luzAmbiente: 0.0005, luzZumbi: 0.005, danoZumbi: 999, velMin: 250, velVar: 130, municaoReserva: 20, extraZumbis: 10, dispersaoSpawn: 160, serpentear: 0.6, corZumbi: [0.6, 0.15, 0.15] },
};

/** Modo de dificuldade ativo. */
let dificuldadeAtual = 'normal';

/** Config resolvida exposta globalmente (lida por entities.js, weapon.js e o render). */
window.DIFICULDADE = DIFICULDADES[dificuldadeAtual];

/** Aplica um modo de dificuldade. @param {'facil'|'normal'|'dificil'} modo */
function aplicarDificuldade(modo) {
  if (!DIFICULDADES[modo]) return;
  dificuldadeAtual = modo;
  window.DIFICULDADE = DIFICULDADES[modo];
}
window.aplicarDificuldade = aplicarDificuldade;

/** Referências cacheadas dos elementos DOM do HUD e telas. */
let elementosUI = {};

/** Instâncias dos sistemas principais. */
let jogador, arma, cutscene, sequenciaIntro;

/** Sons e músicas. */
let sndBgm, sndWin, sndShoot, sndZombie, sndDeath;
let gunNoise, gunEnv;

/** true se a BGM deve estar tocando (usado pelo callback de load). */
let querBgm = false;

function carregarSons() {
  const onError = () => console.log("Som não encontrado em assets/sounds.");
  // bgm.m4a é grande: pode não ter carregado quando o jogador clica INICIAR.
  // Ao terminar de carregar, se já queremos a BGM, toca automaticamente.
  sndBgm = loadSound('assets/sounds/bgm.m4a', () => { sndBgm.setVolume(0.12); if (querBgm) tocarBgm(); }, onError);
  sndWin = loadSound('assets/sounds/win.m4a', () => { sndWin.setVolume(0.15); }, onError);
  sndZombie = loadSound('assets/sounds/zombie.m4a', () => { sndZombie.setVolume(0.25); sndZombie.rate(1.5); }, onError);
  sndDeath = loadSound('assets/sounds/death.m4a', () => { sndDeath.setVolume(1.0); }, onError);
  window.sndBgm = sndBgm; window.sndWin = sndWin; window.sndZombie = sndZombie; window.sndDeath = sndDeath;
}

/**
 * Resume o AudioContext.
 * Por política de autoplay, começa SUSPENSO e só pode ser retomado num gesto do usuário.
 * Deve ser chamado nos handlers de clique (INICIAR / reiniciar).
 */
function desbloquearAudio() {
  try {
    if (typeof userStartAudio === 'function') {
      const p = userStartAudio();
      if (p && p.then) return p;
    }
  } catch (e) { /* ignora */ }
  try {
    const ctx = (typeof getAudioContext === 'function') ? getAudioContext() : null;
    if (ctx && ctx.state !== 'running' && ctx.resume) return ctx.resume();
  } catch (e) { /* ignora */ }
  return Promise.resolve();
}
window.desbloquearAudio = desbloquearAudio;

/** Inicia a BGM em loop (desbloqueia o contexto antes). */
function tocarBgm() {
  querBgm = true;
  const iniciar = () => {
    try { if (sndBgm && sndBgm.isLoaded() && !sndBgm.isPlaying() && querBgm) sndBgm.loop(); }
    catch (e) { console.warn('BGM:', e); }
  };
  const p = desbloquearAudio();
  if (p && p.then) p.then(iniciar, iniciar); else iniciar();
}

/** Para a BGM e impede reinício automático. */
function pararBgm() {
  querBgm = false;
  try { if (sndBgm && sndBgm.isPlaying()) { sndBgm.pause(); try { sndBgm.jump(0); } catch (e) { } } }
  catch (e) { /* ignora */ }
}

function inicializarSomArma() {
  if (gunNoise) return;
  // protegido: exceção aqui faria o botão INICIAR "não funcionar"
  try {
    gunNoise = new p5.Noise('white');
    gunEnv = new p5.Envelope();
    gunEnv.setADSR(0.001, 0.08, 0.0, 0.0);
    gunEnv.setRange(0.25, 0);
    gunNoise.start();
    gunNoise.amp(gunEnv);
    window.gunEnv = gunEnv;
  } catch (e) { console.warn('Som da arma indisponível:', e); }
}

/* ============================================================
   PRELOAD — carrega assets antes do setup()
   ============================================================ */
/**
 * Carrega apenas o JSON das curvas de Bézier da Makise.
 * Um loadJSON que falha dentro do preload() trava o p5 em "Loading…".
 * As ilustrações da narrativa são carregadas assincronamente no setup().
 */
function preload() {
  window.makiseCurves = loadJSON('assets/makise_curves.json',
    () => { },
    () => console.warn('Falha ao carregar makise_curves.json (rode via servidor http).')
  );
}

/* ============================================================
   SETUP — inicialização única
   ============================================================ */
function setup() {
  carregarSons();
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('stage');
  pixelDensity(1);
  noStroke();
  perspective(PI / 3, width / height, 1, 9000);

  // compila shaders: cel (cenário) e env (máquina do tempo)
  shadersCompilados.cel = createShader(SRC.celVert, SRC.celFrag);
  shadersCompilados.env = createShader(SRC.celVert, SRC.envFrag);
  window.SHD = shadersCompilados;

  construirTexturas();

  MAKISE.setCurves(window.makiseCurves);
  MAKISE.build();

  // ilustrações da narrativa carregadas assincronamente (evita travamento no preload)
  carregarIlustracoesDaNarrativa();

  NIVEL.construir();

  jogador = new Jogador();
  arma = new Arma();
  cutscene = new Cutscene(() => exibirTelaVitoria());
  sequenciaIntro = new SequenciaIntro(() => iniciarJogabilidade());

  inicializarReferenciasUI();
  registrarEventos();

  window.player = jogador; window.weapon = arma;
  window.cutscene = cutscene; window.intro = sequenciaIntro;
  window.getState = () => estadoAtual;
}

/** Redimensiona canvas e atualiza projeção. */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  perspective(PI / 3, width / height, 1, 9000);
}

/* ============================================================
   CARREGAMENTO ASSÍNCRONO DAS ILUSTRAÇÕES
   ============================================================ */
/**
 * Carrega os JSON das ilustrações de Bézier para a narrativa via fetch().
 * Usa fetch() em vez de loadJSON() do p5 para evitar ruído no console em 404.
 */
function carregarIlustracoesDaNarrativa() {
  for (const chave of Object.keys(ILUSTRACOES)) {
    fetch('assets/' + chave + '.json')
      .then(resposta => resposta.ok ? resposta.json() : null)
      .then(dados => { if (dados && dados.paths) ILUSTRACOES[chave].carregarEConstruir(dados); })
      .catch(() => { /* arquivo não encontrado → placeholder exibido no slide */ });
  }
}

/* ============================================================
   INICIALIZAÇÃO DO DOM
   ============================================================ */
/** Armazena refs DOM do HUD. Chamado uma vez no setup() para não repetir getElementById no loop. */
function inicializarReferenciasUI() {
  const obterElemento = id => document.getElementById(id);
  elementosUI = {
    telaIntro: obterElemento('intro'),
    hud: obterElemento('hud'),
    telaMorte: obterElemento('dead'),
    telaVitoria: obterElemento('end'),
    seloDificil: obterElemento('endHardBadge'),
    fundoFade: obterElemento('fade'),
    legendaCinema: obterElemento('cutLabel'),
    legendaSubtitulo: obterElemento('subtitle'),
    dicaPausa: obterElemento('pauseHint'),
    dicaControle: obterElemento('controlHint'),
    mensagemPrompt: obterElemento('prompt'),
    textoObjetivo: obterElemento('objText'),
    barraVida: obterElemento('healthFill'),
    textoMunicaoCar: obterElemento('ammoMag'),
    textoMunicaoRes: obterElemento('ammoReserve'),
    hitmarker: obterElemento('hitmarker'),
    painelDano: obterElemento('damage'),
    vinhetaMuzzle: obterElemento('muzzleVignette'),
    rotuloArma: obterElemento('weaponLabel'),
    painelMunicao: obterElemento('ammo'),
  };
  window.ui = elementosUI;
}

/**
 * Registra todos os event listeners:
 * - Botões DOM (iniciar, reiniciar, dificuldade)
 * - Pointer Lock (captura/liberação do mouse)
 * - mousemove (olhar do jogador)
 */
function registrarEventos() {
  document.getElementById('startBtn').onclick = () => iniciarNarrativa();
  document.getElementById('retryBtn').onclick = () => reiniciarJogo();
  document.getElementById('endRetryBtn').onclick = () => reiniciarJogo();

  const descricoesDif = {
    facil: 'Sala iluminada, zumbis lentos e fracos. Ideal para quem nunca jogou.',
    normal: 'A experiência balanceada: corredor escuro. Use a lanterna (F).',
    dificil: 'Muitos zumbis, rápidos e em ziguezague; pouca munição. Mire na cabeça. Um toque e você morre.',
  };
  const botoesDif = document.querySelectorAll('.dif-opt');
  const descDif = document.getElementById('difDesc');
  botoesDif.forEach((botao) => {
    botao.onclick = () => {
      const modo = botao.getAttribute('data-dif');
      aplicarDificuldade(modo);
      botoesDif.forEach(b => b.classList.toggle('selected', b === botao));
      if (descDif) descDif.textContent = descricoesDif[modo] || '';
    };
  });

  const canvasElement = document.querySelector('#stage canvas');

  document.addEventListener('pointerlockchange', () => {
    mouseCaptarado = (document.pointerLockElement === canvasElement);
    if (estadoAtual === 'PLAY') {
      elementosUI.dicaPausa.classList.toggle('hidden', mouseCaptarado);
    }
  });

  document.addEventListener('mousemove', (evento) => {
    if (mouseCaptarado && estadoAtual === 'PLAY') {
      jogador.olhar(evento.movementX, evento.movementY);
    }
  });
}

/** Solicita Pointer Lock ao navegador para capturar o cursor. */
function capturarMouse() {
  const canvasElement = document.querySelector('#stage canvas');
  if (canvasElement && canvasElement.requestPointerLock) {
    try {
      // requestPointerLock pode retornar Promise que rejeita (cooldown após Esc)
      const p = canvasElement.requestPointerLock();
      if (p && p.catch) p.catch(() => { });
    } catch (e) { /* ignora */ }
  }
}
window.lockMouse = capturarMouse;

/* ============================================================
   FLUXO DE TELAS / TRANSIÇÕES DE ESTADO
   ============================================================ */

/** INICIAR → exibe a narrativa (visual novel) antes do gameplay. */
function iniciarNarrativa() {
  desbloquearAudio();
  inicializarSomArma();
  tocarBgm();
  elementosUI.telaIntro.classList.add('hidden');
  elementosUI.legendaCinema.classList.remove('hidden');
  estadoAtual = 'NARRATIVE';
  sequenciaIntro.iniciar();
}
window.startGame = iniciarNarrativa;

/** Fim da narrativa → inicia o gameplay FPS. */
function iniciarJogabilidade() {
  if (sndWin && sndWin.isPlaying()) sndWin.stop();
  tocarBgm();
  definirLegendaSubtitulo('');
  elementosUI.legendaCinema.classList.add('hidden');
  elementosUI.hud.classList.remove('hidden');
  estadoAtual = 'PLAY'; ultimaVidaJogador = 100;
  arma.reiniciar();
  ZUMBIS.reiniciar();
  if (NIVEL.portaEscada) NIVEL.portaEscada.estado = 'FECHADA';
  capturarMouse();
  mostrarDicaControle();
  resetShader();  // NÃO usar noTint() aqui: corrompe o render com shader custom no p5
}
window.beginPlay = iniciarJogabilidade;

/** Timer da dica de controle (para cancelar no reinício). */
let _timerDicaControle = null;

/** Exibe "F alterna lanterna/arma" por 6.5s e depois some. */
function mostrarDicaControle() {
  const dica = elementosUI.dicaControle;
  if (!dica) return;
  if (_timerDicaControle) clearTimeout(_timerDicaControle);
  dica.classList.add('show');
  _timerDicaControle = setTimeout(() => { dica.classList.remove('show'); _timerDicaControle = null; }, 6500);
}

/** Esconde imediatamente a dica de controle. */
function ocultarDicaControle() {
  if (_timerDicaControle) { clearTimeout(_timerDicaControle); _timerDicaControle = null; }
  if (elementosUI.dicaControle) elementosUI.dicaControle.classList.remove('show');
}

/** Reinicia o jogo do zero: volta para a tela de introdução. */
function reiniciarJogo() {
  desbloquearAudio();
  if (sndDeath && sndDeath.isPlaying()) sndDeath.stop();
  if (sndZombie && sndZombie.isPlaying()) { sndZombie.pause(); try { sndZombie.jump(0); } catch (e) { } }
  if (sndWin && sndWin.isPlaying()) sndWin.stop();
  pararBgm();
  elementosUI.telaMorte.classList.add('hidden');
  elementosUI.telaVitoria.classList.add('hidden');
  elementosUI.fundoFade.classList.remove('show', 'white');
  jogador.reiniciar(); arma.reiniciar(); ZUMBIS.reiniciar();
  elementosUI.telaIntro.classList.remove('hidden');
  elementosUI.dicaPausa.classList.add('hidden');
  ocultarDicaControle();
  estadoAtual = 'INTRO';
  resetShader();
}
window.restart = reiniciarJogo;

/** Exibe a tela de vitória (chamada ao fim da Cutscene). */
function exibirTelaVitoria() {
  pararBgm();
  document.exitPointerLock && document.exitPointerLock();
  elementosUI.hud.classList.add('hidden');
  elementosUI.legendaCinema.classList.add('hidden');
  definirLegendaSubtitulo('');
  // selo "JOGO ZERADO" só no DIFÍCIL
  if (elementosUI.seloDificil) elementosUI.seloDificil.classList.toggle('hidden', dificuldadeAtual !== 'dificil');
  elementosUI.telaVitoria.classList.remove('hidden');
  estadoAtual = 'END';
  fadeBranco(false);
  resetShader();
}
window.showEnd = exibirTelaVitoria;

/** Exibe a tela de morte. */
function morrerJogador() {
  pararBgm();
  if (sndZombie && sndZombie.isPlaying()) { sndZombie.pause(); try { sndZombie.jump(0); } catch (e) { } }
  if (sndDeath && sndDeath.isLoaded() && !sndDeath.isPlaying()) sndDeath.play();
  estadoAtual = 'DEAD';
  ocultarDicaControle();
  document.exitPointerLock && document.exitPointerLock();
  elementosUI.hud.classList.add('hidden');
  elementosUI.telaMorte.classList.remove('hidden');
}
window.die = morrerJogador;

/** Inicia a cinemática final. */
function iniciarCutscene() {
  pararBgm();
  if (sndWin && sndWin.isLoaded() && !sndWin.isPlaying()) sndWin.loop();
  estadoAtual = 'CUTSCENE';
  document.exitPointerLock && document.exitPointerLock();
  elementosUI.hud.classList.add('hidden');
  elementosUI.legendaCinema.classList.remove('hidden');
  cutscene.iniciar();
}
window.startCutscene = iniciarCutscene;

/* ============================================================
   LOOP PRINCIPAL (draw)
   ============================================================ */
function draw() {
  const deltaTempoSeg = Math.min(0.05, (deltaTime || 16) / 1000);  // cap 50ms

  if (estadoAtual === 'INTRO') desenharTelaInicial(deltaTempoSeg);
  else if (estadoAtual === 'NARRATIVE') { sequenciaIntro.atualizar(deltaTempoSeg); sequenciaIntro.desenhar(); }
  else if (estadoAtual === 'PLAY') desenharJogabilidade(deltaTempoSeg);
  else if (estadoAtual === 'CUTSCENE') { cutscene.atualizar(deltaTempoSeg); cutscene.desenhar(); }
  else { background(4, 6, 10); }  // END/DEAD: overlay DOM cobre o canvas
}

/* ============================================================
   ESTADO: INTRO — cenário animado atrás do menu
   ============================================================ */
/** Câmera oscila lateralmente criando movimento atmosférico por baixo do menu. */
function desenharTelaInicial(dt) {
  const gl = drawingContext; gl.enable(gl.DEPTH_TEST);
  background(6, 9, 14);
  const tempoSeg = millis() / 1000;
  const oscilacaoX = Math.sin(tempoSeg * 0.25) * 60;
  camera(oscilacaoX, EYE, 220, oscilacaoX * 0.5, EYE - 10, -400, 0, -1, 0);
  window.CAMINVROT = invViewRotFrom([0, 0, -1], [1, 0, 0], [0, 1, 0]);
  const sh = shadersCompilados.cel; shader(sh);
  configurarUniformesCel({ flash: 1, muzzle: 0, ambient: 0.16, fogDensity: 0.0013, fog: [0.02, 0.03, 0.05], bands: 4 });
  NIVEL.desenhar(sh);
  desenharMaquinaTempo(0.5 + 0.4 * Math.sin(tempoSeg * 2.0));
}

/* ============================================================
   ESTADO: PLAY — gameplay FPS
   ============================================================ */
/** Atualiza e renderiza o gameplay FPS a cada frame. */
function desenharJogabilidade(dt) {
  if (botaoMousePressionado && mouseCaptarado) {
    if (arma.disparar(jogador)) animarAcerto();
  }

  jogador.atualizar(dt);
  arma.atualizar(dt);
  ZUMBIS.atualizar(dt, jogador, (dano) => { jogador.receberDano(dano); animarDano(); });

  if (!jogador.vivo) { morrerJogador(); return; }

  renderizarMundo(dt);
  renderizarModeloArma();
  atualizarHUD();
  // porta tem prioridade no prompt; se não ativa, checa a máquina
  if (!verificarPortaEscada(dt)) verificarGatilhoMaquina();
}

/** Aplica câmera do jogador, ativa cel-shader e renderiza mapa + máquina + zumbis. */
function renderizarMundo(dt) {
  definirPerspectiva();
  jogador.aplicarCamera();
  window.CAMINVROT = jogador.matrizRotacaoInversaCamara
    ? jogador.matrizRotacaoInversaCamara()
    : jogador.invViewRot();
  const gl = drawingContext; gl.enable(gl.DEPTH_TEST);
  background(7, 10, 15);

  const sh = shadersCompilados.cel; shader(sh);
  configurarUniformesCel({
    flash: lanternaLigadaFn() ? 1 : 0,
    muzzle: arma.intensidadeMuzzle,
    ambient: window.DIFICULDADE.luzAmbiente,
    fogDensity: 0.0025,
    fog: [0.0, 0.0, 0.0],
    bands: 4
  });
  NIVEL.desenhar(sh);
  desenharMaquinaTempo(0.35 + 0.35 * Math.sin(millis() / 300));
  ZUMBIS.desenhar(jogador.x, jogador.z);
}

/**
 * Renderiza o viewmodel.
 * Limpa o depth buffer antes para que a arma apareça sempre por cima do cenário.
 */
function renderizarModeloArma() {
  const gl = drawingContext;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  definirPerspectiva();
  // câmera do viewmodel: olho em +z, frente=-z, up=(0,1,0)
  camera(0, 0, 420, 0, 0, 0, 0, 1, 0);
  arma.desenharViewmodel(jogador.lanternaLigada);
}

/* ============================================================
   MÁQUINA DO TEMPO (environment mapping procedural)
   ============================================================ */
/**
 * Desenha a máquina com o shader de environment mapping.
 * Composta por: base, coluna, núcleo esférico, dois anéis giratórios e glow.
 * @param {number} intensidadeBrilho - Intensidade do glow (0.0 a 1.5+)
 */
function desenharMaquinaTempo(intensidadeBrilho) {
  const maquina = NIVEL.maquina || LEVEL.machine;
  const tempoSeg = millis() / 1000;
  const sh = shadersCompilados.env; shader(sh);

  sh.setUniform('uInvViewRot', window.CAMINVROT || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  sh.setUniform('uTime', tempoSeg);
  sh.setUniform('uMetalTint', [0.55, 0.62, 0.78]);
  sh.setUniform('uFogColor', [0.02, 0.03, 0.05]);
  sh.setUniform('uFogDensity', 0.0009);
  sh.setUniform('uFlashOn', lanternaLigadaFn() ? 1 : 0);
  sh.setUniform('uMuzzle', arma ? arma.intensidadeMuzzle : 0);
  sh.setUniform('uGlow', intensidadeBrilho);

  push();
  translate(maquina.x, 0, maquina.z);
  push(); translate(0, 30, 0); cylinder(190, 60, 28, 1); pop();         // base
  push(); translate(0, 200, 0); cylinder(55, 330, 24, 1); pop();         // coluna
  push(); translate(0, 250, 0); sphere(72, 24, 18); pop();               // núcleo
  push(); translate(0, 200, 0); rotateX(HALF_PI); rotateZ(tempoSeg * 0.8); torus(175, 14, 28, 16); pop(); // anel externo
  push(); translate(0, 275, 0); rotateX(HALF_PI * 0.8); rotateZ(-tempoSeg * 1.2); torus(135, 10, 28, 16); pop(); // anel interno
  pop();

  // glow aditivo ao redor do núcleo (simula bloom)
  desenharSpriteGlow(TEX.glowCyan, maquina.x, 250, maquina.z, 560, 0.5 + 0.4 * intensidadeBrilho, [150, 235, 255]);
}
window.drawMachine = desenharMaquinaTempo;

/** Ângulo Y para um billboard encarar a câmera. */
function calcularAnguloBillboard(x, z) {
  return Math.atan2(jogador.x - x, jogador.z - z);
}

/**
 * Desenha um sprite de glow aditivo que sempre enfrenta a câmera (billboard).
 * Usa textura nativa do p5 — não usa o shader customizado.
 */
function desenharSpriteGlow(imagem, x, y, z, tamanho, alpha, corRGB) {
  push();
  resetShader(); noStroke();
  blendMode(ADD);
  tint(corRGB[0], corRGB[1], corRGB[2], Math.max(0, Math.min(255, alpha * 255)));
  texture(imagem);
  translate(x, y, z);
  rotateY(calcularAnguloBillboard(x, z));
  plane(tamanho, tamanho);
  blendMode(BLEND);
  noTint();
  pop();
}
window.drawGlowSprite = desenharSpriteGlow;

/* ============================================================
   PORTA DA ESCADA
   ============================================================ */
/**
 * Verifica a porta: trava ao jogador entrar; exibe prompt se perto.
 * @returns {boolean} true se ocupou o prompt (para não conflitar com a máquina)
 */
function verificarPortaEscada(dt) {
  const porta = NIVEL.portaEscada;
  if (!porta) return false;

  if (porta.estado === 'ABERTA') {
    if (jogador.z < porta.minZ - 10) {
      porta.estado = 'TRANCADA';  // trava ao atravessar para dentro do quarto
      ocultarMensagemPrompt();
    } else {
      porta.timerAberta -= (dt || 0);
      if (porta.timerAberta <= 0 && jogador.z > porta.maxZ) porta.estado = 'FECHADA';
    }
  }

  const perto = Math.hypot(jogador.x, jogador.z - porta.maxZ) < 175 && jogador.z > porta.minZ;
  if (porta.estado === 'FECHADA' && perto) {
    exibirMensagemPrompt('Pressione  E  para abrir a porta');
    return true;
  }
  return false;
}

/** Tenta abrir a porta se o jogador estiver perto. @returns {boolean} true se abriu. */
function tentarAbrirPortaEscada() {
  const porta = NIVEL.portaEscada;
  if (!porta || porta.estado !== 'FECHADA') return false;
  const perto = Math.hypot(jogador.x, jogador.z - porta.maxZ) < 175 && jogador.z > porta.minZ;
  if (perto) { porta.estado = 'ABERTA'; porta.timerAberta = 4.0; ocultarMensagemPrompt(); return true; }
  return false;
}

/* ============================================================
   GATILHO DA MÁQUINA DO TEMPO
   ============================================================ */
/** Exibe prompt para ativar a máquina (ou aviso de zumbis restantes). */
function verificarGatilhoMaquina() {
  const distancia = distanciaAteMaquina();
  const zumbisRestantes = ZUMBIS.vivosNaCamara ? ZUMBIS.vivosNaCamara() : ZOMBIES.aliveInChamber();
  if (distancia < NIVEL.raioAtivacao) {
    if (zumbisRestantes > 0) {
      exibirMensagemPrompt('Elimine os infectados na câmara (' + zumbisRestantes + ')');
    } else {
      exibirMensagemPrompt('Pressione  E  para ativar a máquina do tempo');
    }
  } else {
    ocultarMensagemPrompt();
  }
}

/* ============================================================
   HUD
   ============================================================ */
/** Atualiza vida, munição, clarão, lanterna, objetivo e contador de zumbis. */
function atualizarHUD() {
  elementosUI.barraVida.style.width = jogador.vida + '%';
  elementosUI.textoMunicaoCar.textContent = (arma.progressoRecarga > 0) ? '··' : arma.municaoCarregador;
  elementosUI.textoMunicaoRes.textContent = arma.municaoReserva;
  elementosUI.vinhetaMuzzle.style.opacity = arma.intensidadeMuzzle * 0.9;

  // [LANTERNA-NA-MAO] muda rótulo e esmaesce munição quando lanterna está ativa
  elementosUI.rotuloArma.textContent = jogador.lanternaLigada ? 'LANTERNA' : 'SMG';
  elementosUI.painelMunicao.style.opacity = jogador.lanternaLigada ? 0.35 : 1;

  const totalVivos = ZUMBIS.totalVivos ? ZUMBIS.totalVivos() : ZOMBIES.aliveCount();
  const naCamara = ZUMBIS.vivosNaCamara ? ZUMBIS.vivosNaCamara() : ZOMBIES.aliveInChamber();
  elementosUI.textoObjetivo.textContent = (naCamara > 0 || distanciaAteMaquina() > NIVEL.raioAtivacao)
    ? 'Alcance a máquina do tempo  ·  infectados: ' + totalVivos
    : 'Ative a máquina do tempo (E)';
}

/** @returns {number} Distância entre o jogador e a máquina do tempo. */
function distanciaAteMaquina() {
  const maquina = NIVEL.maquina || LEVEL.machine;
  return Math.hypot(jogador.x - maquina.x, jogador.z - maquina.z);
}
window.dDistToMachine = distanciaAteMaquina;

/** @returns {boolean} true se a lanterna está ligada. */
function lanternaLigadaFn() { return !!(jogador && (jogador.lanternaLigada || jogador.flashOn)); }
window.lightOn = lanternaLigadaFn;

/** Exibe uma mensagem de prompt contextual. */
function exibirMensagemPrompt(texto) {
  elementosUI.mensagemPrompt.textContent = texto;
  elementosUI.mensagemPrompt.classList.remove('hidden');
}
window.showPrompt = exibirMensagemPrompt;

/** Esconde o prompt contextual. */
function ocultarMensagemPrompt() { elementosUI.mensagemPrompt.classList.add('hidden'); }
window.hidePrompt = ocultarMensagemPrompt;

/** Anima o hitmarker (re-adiciona classe para reiniciar a animação CSS). */
function animarAcerto() {
  elementosUI.hitmarker.classList.remove('show');
  void elementosUI.hitmarker.offsetWidth;  // force reflow
  elementosUI.hitmarker.classList.add('show');
}
window.flashHit = animarAcerto;

/** Overlay vermelho de dano por 60ms (controlado pelo CSS via classe 'flash'). */
function animarDano() {
  elementosUI.painelDano.classList.add('flash');
  setTimeout(() => elementosUI.painelDano.classList.remove('flash'), 60);
}
window.flashDamage = animarDano;

/* ============================================================
   INPUT — Mouse e Teclado
   ============================================================ */
function mousePressed() {
  if (estadoAtual === 'INTRO' || estadoAtual === 'DEAD' || estadoAtual === 'END') return;
  if (estadoAtual === 'NARRATIVE') { sequenciaIntro.avancar(); return false; }
  if (estadoAtual === 'CUTSCENE') { cutscene.pularFase(); return false; }
  if (estadoAtual === 'PLAY') {
    if (!mouseCaptarado) { capturarMouse(); return false; }
    botaoMousePressionado = true;
    if (arma.disparar(jogador)) animarAcerto();
  }
  return false;
}

function mouseReleased() { botaoMousePressionado = false; }

function keyPressed() {
  if (estadoAtual === 'NARRATIVE') {
    if (keyCode === ENTER || key === ' ') sequenciaIntro.avancar();
    else if (keyCode === ESCAPE) sequenciaIntro.pular();
    return false;
  }
  if (estadoAtual === 'CUTSCENE') {
    if (keyCode === ESCAPE || keyCode === ENTER || key === ' ') cutscene.pularFase();
    return false;
  }
  if (estadoAtual === 'PLAY') {
    // [LANTERNA-NA-MAO] não recarrega com a lanterna na mão
    if ((key === 'r' || key === 'R') && !jogador.lanternaLigada) arma.recarregar();
    if (key === 'f' || key === 'F') {
      if ('lanternaLigada' in jogador) jogador.lanternaLigada = !jogador.lanternaLigada;
      else jogador.flashOn = !jogador.flashOn;
    }
    if (key === 'e' || key === 'E') {
      // prioridade: porta da escada; senão: ativa a máquina
      if (!tentarAbrirPortaEscada()) {
        const naCamara = ZUMBIS.vivosNaCamara ? ZUMBIS.vivosNaCamara() : ZOMBIES.aliveInChamber();
        if (distanciaAteMaquina() < NIVEL.raioAtivacao && naCamara === 0) iniciarCutscene();
      }
    }
  }
  if (key === ' ') return false;
  if (estadoAtual === 'PLAY' && keyCode >= LEFT_ARROW && keyCode <= DOWN_ARROW) return false;
}

/* ============================================================
   HELPERS GLOBAIS
   ============================================================ */

/** Configura todos os uniforms do cel-shader de uma vez. */
function configurarUniformesCel(opcoes) {
  const sh = shadersCompilados.cel;
  sh.setUniform('uTime', millis() / 1000);
  sh.setUniform('uFlashOn', opcoes.flash);
  sh.setUniform('uMuzzle', opcoes.muzzle);
  sh.setUniform('uBands', opcoes.bands || 4);
  sh.setUniform('uAmbient', opcoes.ambient);
  sh.setUniform('uFogColor', opcoes.fog || [0.02, 0.03, 0.05]);
  sh.setUniform('uFogDensity', opcoes.fogDensity);
  sh.setUniform('uTint', [1, 1, 1]);
  sh.setUniform('uEmissive', 0);
  sh.setUniform('uMatId', 1);
  sh.setUniform('uUVScale', [1, 1]);
}
window.applyCelGlobals = configurarUniformesCel;

/**
 * Monta a matriz 3×3 de rotação inversa câmera→mundo (column-major, 9 floats).
 * @param {number[]} vetorFrente, vetorDireita, vetorCima - Vetores normalizados da câmera
 */
function criarMatrizRotacaoInversaCamara(vetorFrente, vetorDireita, vetorCima) {
  return [
    vetorDireita[0], vetorDireita[1], vetorDireita[2],
    vetorCima[0], vetorCima[1], vetorCima[2],
    -vetorFrente[0], -vetorFrente[1], -vetorFrente[2]
  ];
}
window.invViewRotFrom = criarMatrizRotacaoInversaCamara;

/** Define perspectiva com FOV 60° e near/far padrão. */
function definirPerspectiva() { perspective(PI / 3, width / height, 1, 9000); }
window.setPerspective = definirPerspectiva;

/**
 * Desenha um quad texturado com sub-retângulo de UV.
 * @param {number} w, h   - Largura e altura do plano
 * @param {number} u0, v0 - UV superior-esquerdo
 * @param {number} u1, v1 - UV inferior-direito
 */
function planoComUV(w, h, u0, v0, u1, v1) {
  textureMode(NORMAL);
  beginShape();
  vertex(-w / 2, -h / 2, 0, u0, v0);
  vertex(w / 2, -h / 2, 0, u1, v0);
  vertex(w / 2, h / 2, 0, u1, v1);
  vertex(-w / 2, h / 2, 0, u0, v1);
  endShape(CLOSE);
}
window.texQuad = planoComUV;

/* ============================================================
   LEGENDAS E FADES
   ============================================================ */

/** Define o texto do label de técnica (vazio = esconde). */
function definirLegenda(texto) {
  if (!texto) { elementosUI.legendaCinema.classList.add('hidden'); return; }
  elementosUI.legendaCinema.textContent = texto;
  elementosUI.legendaCinema.classList.remove('hidden');
}
window.setLabel = definirLegenda;

/** Define o subtítulo narrativo (vazio = esconde). */
function definirLegendaSubtitulo(texto) {
  if (!texto) { elementosUI.legendaSubtitulo.classList.remove('show'); return; }
  elementosUI.legendaSubtitulo.textContent = texto;
  elementosUI.legendaSubtitulo.classList.remove('hidden');
  elementosUI.legendaSubtitulo.classList.add('show');
}
window.setSubtitle = definirLegendaSubtitulo;

/** Aplica ou remove o fade escuro. */
function fadePara(ativar) {
  elementosUI.fundoFade.classList.toggle('show', ativar);
  if (!ativar) elementosUI.fundoFade.classList.remove('white');
}
window.fadeTo = fadePara;

/** Aplica ou remove o fade branco (usado no final da cutscene). */
function fadeBranco(ativar) {
  if (ativar) { elementosUI.fundoFade.classList.add('white', 'show'); }
  else { elementosUI.fundoFade.classList.remove('show', 'white'); }
}
window.fadeWhite = fadeBranco;

/* ============================================================
   ALIASES LEGADOS — módulos que usam nomes antigos
   ============================================================ */
window.applyCelGlobals = configurarUniformesCel;
window.invViewRotFrom = criarMatrizRotacaoInversaCamara;
window.setPerspective = definirPerspectiva;
window.drawMachine = desenharMaquinaTempo;
window.setLabel = definirLegenda;
window.fadeTo = fadePara;
window.fadeWhite = fadeBranco;
