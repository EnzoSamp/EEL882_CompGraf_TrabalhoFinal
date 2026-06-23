# OPERATION SKULD
### FPS narrativo em p5.js (WEBGL) — showcase de Computação Gráfica
*Uma releitura/AU de **Steins;Gate**: você joga como **Makise Kurisu**, portando a
única cura durante um apocalipse zumbi. Atravesse o corredor infestado do bunker, alcance a **máquina do tempo** e volte ao passado para distribuir a
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
| **Ray casting e Interseção** | `js/entities.js` → `ZUMBIS.detectarTiro()` | Tiro lança um raio da câmera e testa interseção analítica (raio-esfera para zumbis e raio-caixa para paredes). |
| **Modelo de Iluminação (Cel-Shading)** | `js/shaders.js` → `celFrag` | Implementação do modelo de Phong com a componente difusa quantizada (step/floor) e cálculo de contorno (Rim light/Fresnel). |
| **Fontes de Luz (Spotlight e Point)** | `js/shaders.js` → `celFrag` | A lanterna calcula um cone de luz (Spot) no espaço da câmera; o disparo gera uma luz pontual atenuada pela distância. |
| **Mapeamento de Textura e Procedural** | `js/shaders.js` e `js/textures.js` | Cenário usa materiais procedurais gerados matematicamente no GLSL. Zumbis usam textura 2D tradicional com coordenadas UV. |
| **Environment Mapping** | `js/shaders.js` → `envFrag` (`reflect`) | Máquina calcula vetor de reflexão da visão e mapeia um ambiente procedural, simulando uma superfície metálica espelhada. |
| **Sistemas de Coordenadas (Cilíndricas)**| `js/cutscene.js` → `_desenharEspiral()` | Câmera orbita a personagem na cutscene convertendo coordenadas cilíndricas (raio, ângulo, altura) para cartesianas. |
| **Transformações Geométricas** | `js/cutscene.js` (`_desenharTunel`) | Uso de matrizes (`push`/`pop`) para Rotação radial (distribuição circular) e Escala Negativa (`scale(-1, 1)`) para espelhamento. |
| **Blending Aditivo e Névoa (Fog)** | Shaders e `js/game.js` (`blendMode`) | Névoa exponencial baseada na distância no shader (`exp(-densidade * z)`). Brilhos (glow) usam Blending Aditivo do OpenGL. |
| **Detecção de Colisão (AABB)** | `js/level.js` → `resolverColisao()` | Algoritmo de Axis-Aligned Bounding Box para impedir que jogador e zumbis atravessem as paredes (resolução por slide/deslizamento). |
| **Curvas Paramétricas (Bézier)** | `js/makise.js` → `Ilustracao...` | As artes narrativas da introdução e a personagem final são 100% desenhadas via Curvas de Bézier Cúbicas (`bezierVertex`). |
| **Campo de Altura** | `js/level.js` → `alturaPiso()` | Avaliação de altura do terreno baseada em (X, Z). Permite que o mapa tenha dois andares físicos conectados por uma rampa. |


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
