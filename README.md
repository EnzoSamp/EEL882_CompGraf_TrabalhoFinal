# OPERATION SKULD
### FPS narrativo em p5.js (WEBGL) — showcase de Computação Gráfica
*Uma releitura/AU de **Steins;Gate**: você joga como **Makise Kurisu**, portando a
única cura durante um apocalipse zumbi. Atravesse o corredor infestado do Future
Gadget Lab, alcance a **máquina do tempo** e volte ao passado para distribuir a
cura por todas as linhas temporais.*

---

## ▶ Como jogar

O jogo está preparado para rodar diretamente no navegador utilizando o **GitHub Pages**. Esta abordagem resolve automaticamente os problemas de segurança de arquivos locais (CORS) que o navegador impõe (por isso o jogo não carrega as ilustrações ou o áudio se você abrir apenas o arquivo `.html` localmente).

[🔗 Link para o jogo no GitHub Pages](https://enzosamp.github.io/EEL882_CompGraf_TrabalhoFinal/)

Na tela inicial clique **INICIAR** — o mouse é capturado (Pointer Lock).
Pressione **Esc** para liberar o cursor.

### Controles
| Tecla | Ação |
|------|------|
| **W A S D** ou **setas ↑ ← ↓ →** | mover |
| **Mouse** | olhar (mouse-look) |
| **Clique (segurar)** | atirar SMG (full-auto) |
| **R** | recarregar |
| **F** | alternar entre lanterna e arma |
| **E** | abrir a porta da escada / ativar a máquina do tempo (câmara sem infectados) |

> **Dificuldade** (escolhida na tela inicial): **Fácil** (sala iluminada, zumbis lentos e fracos), **Normal** e **Difícil** (zumbis vermelhos, rápidos, em ziguezague, hit-kill e munição escassa).

---

## Mapa dos conceitos da ementa → código

| Conceito | Onde está | Como aparece no jogo |
|---|---|---|
| **Ray casting / Picking** | `js/entities.js` → `ZUMBIS.detectarTiro()` (raio-esfera) chamado por `js/weapon.js` → `Arma.disparar()` | Cada tiro lança um raio da câmera e testa interseção raio-esfera contra os zumbis. |
| **Shading — cel-shading** | `js/shaders.js` → `celFrag` (Phong **quantizado** + contorno fresnel) | Todo o cenário, zumbis e arma. |
| **Iluminação dinâmica** | `celFrag`: **spotlight** (lanterna, cone em espaço de câmera) + **point light** (clarão do disparo `uMuzzle`) | Lanterna na arma (tecla F) e flash a cada tiro. |
| **Texture mapping** | **materiais procedurais no shader** (`js/shaders.js` → `celFrag`: paredes, chão, teto, metal) + texturas p5.Graphics dos **zumbis** e **glow** (`js/textures.js`) | UVs com repetição (`fract(uv*uUVScale)`); zumbis como billboards texturizados. |
| **Environment mapping / reflexo** | `js/shaders.js` → `envFrag` (`reflect` + ambiente procedural) em `desenharMaquinaTempo()` (`js/game.js`) | Máquina do tempo metálica reflete o laboratório. |
| **Câmera por coordenadas cilíndricas** | `js/cutscene.js` → `_desenharEspiral()` | Câmera em **espiral** ao redor de Makise na cutscene (trigonometria: sin/cos em torno do eixo Y). |
| **Reflexão radial** | `js/cutscene.js` → `_desenharPortal()` (planos espelhados) | **Múltiplas Makises** espelhadas radialmente "atravessando as linhas do tempo". |
| Atmosfera | névoa exponencial (todos os shaders) + glow aditivo (`blendMode(ADD)`) | Laboratório sombrio com bloom no clarão e na máquina. |
| Colisão **AABB** | `js/level.js` → `resolverColisao()` (separação por eixo = "escorregar") | Player e zumbis não atravessam paredes; corredor com portas. |
| **Curvas de Bézier** | `js/makise.js` → `Ilustracao.construirBufferGrafico()` (`bezierVertex`) | A Makise da cutscene e as ilustrações da narrativa são vetoriais. |
| **Campo de altura (escada)** | `js/level.js` → `alturaPiso()` | Dois andares reais: o jogador desce a escada com a altura dos olhos variando. |

---

## Loop de jogo
1. **Tela de contexto** (história) + narrativa em slides (visual novel).
2. **Sala superior → escada → corredor linear** com 3 salas + câmara final; zumbis-billboard avançam.
3. **Atirar** (raycast) reduz a vida do zumbi atingido; HUD de munição/vida.
4. **Colisão AABB** com paredes; chegar à câmara da máquina.
5. **Cutscene**: espiral de câmera (trigonometria) ao redor de Makise → caleidoscópio
   de múltiplas Makises → tela **FINAL FELIZ**.

---

## 📁 Estrutura
```
index.html            # shell + overlays de HUD/telas (DOM)
editor.html           # ferramenta p/ traçar curvas de Bézier (com imagens-guia locais)

css/
  style.css           # estilização do HUD e telas do jogo

libs/
  p5.min.js           # engine p5.js core
  p5.sound.min.js     # engine de áudio do p5.js

assets/
  Entrada_bunker.jpg  # imagem-guia do editor (ignorado pelo jogo)
  Makise_arma.png     # imagem-guia do editor (ignorado pelo jogo)
  image_Makise.webp   # imagem-guia do editor (ignorado pelo jogo)
  makise_curves.json  # curvas de Bézier para Makise (cutscene final)
  Entrada_bunker.json # curvas de Bézier (arte narrativa da intro)
  Makise_arma.json    # curvas de Bézier (arte narrativa da intro)
  sounds/             # diretório com todas as faixas e efeitos (.m4a)

js/
  vec3.js             # álgebra de vetores 3D 
  shaders.js          # GLSL: cel-shader + environment mapping (2 shaders)
  textures.js         # texturas procedurais (zumbis, glow); cenário é procedural no shader
  level.js            # geometria do corredor + escada + colisão AABB
  entities.js         # zumbis (billboards) + raycast de picking
  weapon.js           # SMG: tiro/raycast, recarga, clarão, viewmodel
  player.js           # câmera FPS, pointer lock, movimento (WASD/setas)
  makise.js           # script que renderiza o JSON de Bézier em buffers gráficos
  intro.js            # rotina do tipo visual novel para a cutscene inicial
  cutscene.js         # clímax: espiral (trigonometria) + portal + túnel de Makises
  game.js             # máquina de estados, render, HUD, áudio, dificuldade
```

*El Psy Kongroo.*
