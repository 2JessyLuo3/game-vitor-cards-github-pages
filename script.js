/* Para trocar uma pergunta, altere apenas o texto entre aspas abaixo.
   Mantenha o id e o nível: eles preservam a sequência e a cor da carta. */
const QUESTIONS = [
  { id: "green-01", level: 1, text: "Qual coisa pequena consegue melhorar seu dia quase sempre?" },
  { id: "green-02", level: 1, text: "Qual viagem você faria amanhã se pudesse?" },
  { id: "green-03", level: 1, text: "Que tipo de coisa você nunca enjoa de fazer?" },
  { id: "green-04", level: 1, text: "Qual comida, filme, série ou música você gostaria de poder experimentar pela primeira vez de novo?" },
  { id: "green-05", level: 1, text: "Qual foi uma fase da sua vida que você lembra com muito carinho?" },
  { id: "green-06", level: 1, text: "O que você costuma fazer quando tem um dia totalmente livre?" },
  { id: "green-07", level: 1, text: "Qual gosto seu você defenderia mesmo que todo mundo discordasse?" },
  { id: "green-08", level: 1, text: "Se você pudesse ficar muito bom em alguma habilidade instantaneamente, qual escolheria?" },
  { id: "green-09", level: 1, text: "Qual foi uma das situações mais aleatórias ou engraçadas que já aconteceram com você?" },
  { id: "green-10", level: 1, text: "Qual lugar, atividade ou situação faz você perder a noção do tempo?" },

  { id: "yellow-01", level: 2, text: "Que característica você mais valoriza nas pessoas que mantém por perto?" },
  { id: "yellow-02", level: 2, text: "Conte um fato aleatório sobre você que poucas pessoas sabem." },
  { id: "yellow-03", level: 2, text: "Qual característica sua costuma demorar mais para aparecer quando você conhece alguém?" },
  { id: "yellow-04", level: 2, text: "Você acha que mudou muito nos últimos anos? Em quê?" },
  { id: "yellow-05", level: 2, text: "Qual foi uma decisão difícil que acabou sendo boa para você?" },
  { id: "yellow-06", level: 2, text: "Se você pudesse descrever sua personalidade em cinco palavras, quais seriam?" },
  { id: "yellow-07", level: 2, text: "Qual coisa aparentemente pequena tem muita importância para você?" },
  { id: "yellow-08", level: 2, text: "Qual defeito seu você conhece bem, mas ainda tem dificuldade de mudar?" },
  { id: "yellow-09", level: 2, text: "Tem alguma coisa que você gostaria que as pessoas entendessem melhor sobre você?" },
  { id: "yellow-10", level: 2, text: "Qual experiência você acha que mais influenciou a pessoa que você é hoje?" },

  { id: "red-01", level: 3, text: "Conte um medo seu." },
  { id: "red-02", level: 3, text: "O que você acha que mais mudou sua forma de enxergar a vida?" },
  { id: "red-03", level: 3, text: "Qual parte de quem você é hoje seu “eu” de alguns anos atrás provavelmente não reconheceria?" },
  { id: "red-04", level: 3, text: "O que você costuma fazer quando está mal?" },
  { id: "red-05", level: 3, text: "Qual foi uma decisão da sua vida que mudou muita coisa para você?" },
  { id: "red-06", level: 3, text: "Qual é uma insegurança sua que poucas pessoas percebem?" },
  { id: "red-07", level: 3, text: "Qual tipo de atitude em uma pessoa faz você admirá-la muito?" },
  { id: "red-08", level: 3, text: "Como seria um dia perfeito para você, do começo ao fim?" },
  { id: "red-09", level: 3, text: "Qual valor ou princípio você dificilmente abriria mão?" },
  { id: "red-10", level: 3, text: "O que geralmente faz você se sentir genuinamente feliz?" }
];

const STATES = Object.freeze({
  IDLE_CLOSED: "IDLE_CLOSED",
  FLIPPING_OPEN: "FLIPPING_OPEN",
  IDLE_OPEN: "IDLE_OPEN",
  RETURNING_TO_SHOE: "RETURNING_TO_SHOE",
  DEALING_NEXT: "DEALING_NEXT"
});

const questionById = new Map(QUESTIONS.map(question => [question.id, question]));
const layer = document.getElementById("card-layer");
const scene = document.getElementById("scene");
const shoeDeck = document.getElementById("shoe-deck");
const announcement = document.getElementById("announcement");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionSelect = document.getElementById("motion-mode");
const skipButton = document.getElementById("skip-card");
const newGameButton = document.getElementById("new-game");
const cardCount = document.getElementById("card-count");
const deckCount = document.getElementById("deck-count");
const instruction = document.getElementById("game-instruction");

// Only device preferences are stored. Every visit starts a fresh shuffled game.
function readPreference(key, fallback) {
  try { return localStorage.getItem(`vitor-cards:${key}`) ?? fallback; }
  catch { return fallback; }
}
function writePreference(key, value) {
  try { localStorage.setItem(`vitor-cards:${key}`, value); }
  catch { /* The game also works when browser storage is unavailable. */ }
}
let motionMode = readPreference("motion", "normal");
if (!["normal", "fast", "reduced"].includes(motionMode)) motionMode = "normal";
let showInstructions = readPreference("instructions-seen", "false") !== "true";

function minimalMotion() { return reducedMotion.matches || motionMode === "reduced"; }
function motionDuration(normal, fast) { return minimalMotion() ? 0 : motionMode === "fast" ? fast : normal; }
function updateMotion() {
  scene.classList.toggle("motion-reduced", minimalMotion());
  scene.style.setProperty("--flip-duration", minimalMotion() ? "0s" : motionMode === "fast" ? ".38s" : ".72s");
  motionSelect.value = minimalMotion() ? "reduced" : motionMode;
  // Always respect the operating system's reduced-motion preference.
  motionSelect.querySelector('[value="normal"]').disabled = reducedMotion.matches;
  motionSelect.querySelector('[value="fast"]').disabled = reducedMotion.matches;
}
motionSelect.addEventListener("change", () => {
  motionMode = motionSelect.value;
  writePreference("motion", motionMode);
  updateMotion();
});
reducedMotion.addEventListener?.("change", updateMotion);
updateMotion();

function randomInteger(maxInclusive) {
  if (!window.crypto?.getRandomValues) return Math.floor(Math.random() * (maxInclusive + 1));
  const range = maxInclusive + 1;
  const limit = 0x100000000 - (0x100000000 % range);
  const value = new Uint32Array(1);
  do { window.crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % range;
}

function shuffledIds(firstTwoGreen = false) {
  const ids = QUESTIONS.map(question => question.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInteger(i);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (!firstTwoGreen) return ids;
  const first = ids.filter(id => questionById.get(id).level === 1).slice(0, 2);
  const selected = new Set(first);
  return [...first, ...ids.filter(id => !selected.has(id))];
}

// A new page visit starts with two different green cards. Later blocks are fully random.
let session = { order: shuffledIds(true), index: 0, block: 1 };
let state = STATES.IDLE_CLOSED;
let activeCard;
let pendingFlip = false;
let layoutFrame;

function readyForInput() { return state === STATES.IDLE_CLOSED || state === STATES.IDLE_OPEN; }
function updateInterface() {
  const ready = readyForInput() && !activeCard?.interaction?.pointer;
  newGameButton.disabled = !ready;
  skipButton.disabled = !ready;
  motionSelect.disabled = !ready;
  const countText = `Carta ${session.index + 1} de ${session.order.length}`;
  const blockText = `Baralho ${session.block}`;
  if (cardCount.textContent !== countText) cardCount.textContent = countText;
  if (deckCount.textContent !== blockText) deckCount.textContent = blockText;
  updateInstruction();
  cancelAnimationFrame(layoutFrame);
  if (ready) layoutFrame = requestAnimationFrame(fitLayout);
}
function updateInstruction() {
  const questionText = activeCard?.querySelector(".card-question");
  const needsScroll = questionText && questionText.scrollHeight > questionText.clientHeight + 1;
  instruction.hidden = false;
  instruction.textContent = needsScroll
    ? "Clique para virar. Arraste para girar. Para ler tudo: roda do mouse ou dois dedos."
    : "Clique para virar. Arraste para girar. Próximo troca a pergunta.";
}
window.addEventListener("resize", () => { if (activeCard) updateInterface(); });

// Reserve room for controls when text is enlarged or the screen is very short.
// On unusually small screens with large text, scrolling keeps every control usable.
function fitLayout() {
  if (!activeCard || !readyForInput()) return;
  const previousScroll = window.scrollY;
  scene.style.removeProperty("--card-width");
  scene.style.removeProperty("--card-top");
  scene.style.removeProperty("height");
  document.documentElement.classList.remove("needs-scroll");
  updateInstruction();
  const toolbar = document.querySelector(".game-toolbar");
  const actions = document.querySelector(".card-actions");
  const sceneBounds = scene.getBoundingClientRect();
  const upper = toolbar.getBoundingClientRect().bottom - sceneBounds.top + 12;
  const originalWidth = activeCard.getBoundingClientRect().width;
  const sidebar = window.matchMedia("(max-height: 540px) and (orientation: landscape)").matches;
  for (let pass = 0; pass < 2; pass++) {
    let lower = sidebar ? scene.clientHeight - 40 : actions.getBoundingClientRect().top - sceneBounds.top - 16;
    const minimumHeight = Math.min(originalWidth * 1.4, 220);
    if (lower - upper < minimumHeight) {
      scene.style.height = `${scene.clientHeight + minimumHeight - (lower - upper)}px`;
      document.documentElement.classList.add("needs-scroll");
      lower = sidebar ? scene.clientHeight - 40 : actions.getBoundingClientRect().top - sceneBounds.top - 16;
    }
    const bounds = activeCard.getBoundingClientRect();
    const top = bounds.top - sceneBounds.top;
    const bottom = bounds.bottom - sceneBounds.top;
    if (top < upper || bottom > lower) {
      scene.style.setProperty("--card-width", `${Math.min(originalWidth, (lower - upper) / 1.4)}px`);
      scene.style.setProperty("--card-top", `${(upper + lower) / 2}px`);
    }
    updateInstruction();
  }
  if (previousScroll && document.documentElement.classList.contains("needs-scroll")) window.scrollTo(0, previousScroll);
}
function setState(next) { state = next; updateInterface(); }
function finishInstructions() {
  showInstructions = false;
  writePreference("instructions-seen", "true");
}
function reportFailure(error) {
  console.error("Não foi possível concluir a troca de carta.", error);
  pendingFlip = false;
  for (const card of [...layer.children]) if (card !== activeCard) card.remove();
  activeCard.getAnimations().forEach(animation => animation.cancel());
  activeCard.classList.remove("is-behind-shoe", "is-in-flight", "can-queue-flip");
  activeCard.style.transform = CENTER;
  activeCard.removeAttribute("aria-hidden");
  cancelInteraction(activeCard);
  const open = activeCard.interaction.textVisible;
  applyOrientation(activeCard, open ? [0, 1, 0, 0] : [0, 0, 0, 1]);
  setState(open ? STATES.IDLE_OPEN : STATES.IDLE_CLOSED);
  unlock(activeCard);
  announcement.textContent = "A carta está pronta. Você pode continuar.";
}
function runAction(action) {
  try { return Promise.resolve(action()).catch(reportFailure); }
  catch (error) { reportFailure(error); return Promise.resolve(); }
}

function currentQuestion() { return questionById.get(session.order[session.index]); }
function pause(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

function makeCard(question, revealed = false) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = question.id;
  card.dataset.level = String(question.level);

  const bob = document.createElement("div");
  bob.className = "card-bob";
  const button = document.createElement("button");
  button.className = "card-button";
  button.type = "button";
  button.setAttribute("aria-label", revealed ? "Virar para o lado em branco" : "Virar para mostrar a pergunta");
  button.setAttribute("aria-pressed", String(revealed));
  button.setAttribute("aria-describedby", "game-instruction");
  const rotor = document.createElement("span");
  rotor.className = "card-rotor" + (revealed ? " is-open" : "");
  const back = document.createElement("span");
  back.className = "card-face card-face--back";
  back.setAttribute("aria-hidden", revealed ? "true" : "false");
  const front = document.createElement("span");
  front.className = "card-face card-face--front";
  front.setAttribute("aria-hidden", revealed ? "false" : "true");
  const text = document.createElement("span");
  text.className = "card-question";
  text.textContent = question.text;
  const level = document.createElement("span");
  level.className = "card-level";
  level.textContent = `NÍVEL ${question.level}`;
  front.append(text, level);
  for (const side of ["left", "right", "top", "bottom"]) {
    const edge = document.createElement("span");
    edge.className = `card-edge card-edge--${side}`;
    edge.setAttribute("aria-hidden", "true");
    rotor.append(edge);
  }
  rotor.append(back, front);
  button.append(rotor);
  bob.append(button);
  card.append(bob);
  card.interaction = { q: revealed ? [0, 1, 0, 0] : [0, 0, 0, 1], textVisible: revealed,
    pointer: null, reader: null, suppressClick: false, frame: null, finish: null };
  attachInteraction(card, button);
  applyOrientation(card, card.interaction.q);
  return card;
}

// Quaternions avoid inverted axes and angle jumps after combined horizontal/vertical turns.
function normalizeQuaternion(q) {
  const length = Math.hypot(...q);
  return q.map(value => value / length);
}
function multiplyQuaternion(a, b) {
  const [x, y, z, w] = a;
  const [u, v, s, t] = b;
  return normalizeQuaternion([
    w * u + x * t + y * s - z * v,
    w * v - x * s + y * t + z * u,
    w * s + x * v - y * u + z * t,
    w * t - x * u - y * v - z * s
  ]);
}
function interpolateQuaternion(from, to, amount) {
  let dot = from.reduce((sum, value, i) => sum + value * to[i], 0);
  if (dot < 0) { to = to.map(value => -value); dot = -dot; }
  if (dot > .9995) return normalizeQuaternion(from.map((value, i) => value + (to[i] - value) * amount));
  const angle = Math.acos(Math.min(1, dot));
  const a = Math.sin((1 - amount) * angle) / Math.sin(angle);
  const b = Math.sin(amount * angle) / Math.sin(angle);
  return from.map((value, i) => value * a + to[i] * b);
}
function applyOrientation(card, q) {
  const interaction = card.interaction;
  interaction.q = normalizeQuaternion(q);
  const [x, y, z, w] = interaction.q;
  // CSS matrices use column-major order. The local blank-face normal is +Z.
  const matrix = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    0, 0, 0, 1
  ];
  const normalZ = matrix[10];
  // At exactly 90 degrees retain the last predominant face, avoiding jitter.
  if (Math.abs(normalZ) > 1e-6) interaction.textVisible = normalZ < 0;
  card.querySelector(".card-rotor").style.transform = `matrix3d(${matrix.join(",")})`;
  card.querySelector(".card-rotor").classList.toggle("is-open", interaction.textVisible);
  card.querySelector(".card-face--back").setAttribute("aria-hidden", String(interaction.textVisible));
  card.querySelector(".card-face--front").setAttribute("aria-hidden", String(!interaction.textVisible));
  const button = card.querySelector("button");
  button.setAttribute("aria-pressed", String(interaction.textVisible));
  button.setAttribute("aria-label", interaction.textVisible ? "Virar para o lado em branco" : "Virar para mostrar a pergunta");
}
function settleFace(card) {
  setState(card.interaction.textVisible ? STATES.IDLE_OPEN : STATES.IDLE_CLOSED);
}
function releasePointer(card) {
  const interaction = card.interaction;
  const pointer = interaction.pointer;
  const reader = interaction.reader;
  interaction.pointer = null;
  interaction.reader = null;
  const button = card.querySelector("button");
  button.classList.remove("is-dragging");
  card.classList.remove("is-interacting");
  if (reader && button.hasPointerCapture?.(reader.id)) button.releasePointerCapture(reader.id);
  if (pointer && button.hasPointerCapture?.(pointer.id)) button.releasePointerCapture(pointer.id);
}
function cancelInteraction(card) {
  releasePointer(card);
  const interaction = card.interaction;
  cancelAnimationFrame(interaction.frame);
  interaction.frame = null;
  if (interaction.finish) { interaction.finish(); interaction.finish = null; }
}
function attachInteraction(card, button) {
  const interaction = card.interaction;
  button.addEventListener("pointerdown", event => {
    const text = card.querySelector(".card-question");
    // One finger rotates. Two fingers scroll only when a question actually overflows.
    if (card === activeCard && interaction.pointer && !interaction.reader &&
        event.pointerType === "touch" && interaction.textVisible && text.scrollHeight > text.clientHeight) {
      interaction.reader = { id: event.pointerId, y: event.clientY };
      interaction.pointer.scrolling = true;
      interaction.pointer.moved = true;
      interaction.suppressClick = true;
      button.setPointerCapture(event.pointerId);
      return;
    }
    if (card !== activeCard || !readyForInput() || interaction.pointer || !event.isPrimary || event.button !== 0) return;
    interaction.suppressClick = false;
    interaction.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false, gain: Math.PI * 1.25 / button.offsetWidth };
    button.setPointerCapture(event.pointerId);
    card.classList.add("is-interacting");
    updateInterface();
  });
  button.addEventListener("pointermove", event => {
    const pointer = interaction.pointer;
    const reader = interaction.reader;
    if (reader && reader.id === event.pointerId) {
      card.querySelector(".card-question").scrollTop += (reader.y - event.clientY) / 2;
      reader.y = event.clientY;
      event.preventDefault();
      return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.scrolling) {
      card.querySelector(".card-question").scrollTop += (pointer.y - event.clientY) / (reader ? 2 : 1);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      event.preventDefault();
      return;
    }
    if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 7) return;
    pointer.moved = true;
    interaction.suppressClick = true;
    button.classList.add("is-dragging");
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const length = Math.hypot(dx, dy);
    if (length) {
      const halfAngle = length * pointer.gain / 2;
      const sin = Math.sin(halfAngle) / length;
      applyOrientation(card, multiplyQuaternion([-dy * sin, dx * sin, 0, Math.cos(halfAngle)], interaction.q));
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    event.preventDefault();
  });
  function endPointer(event) {
    const pointer = interaction.pointer;
    if (interaction.reader?.id === event.pointerId) {
      interaction.reader = null;
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
      return;
    }
    if (!pointer || (event.pointerId !== undefined && pointer.id !== event.pointerId)) return;
    if (event.type !== "pointerup") interaction.suppressClick = true;
    const wasTextVisible = state === STATES.IDLE_OPEN;
    releasePointer(card);
    settleFace(card);
    if (pointer.moved && interaction.textVisible && !wasTextVisible) announceQuestion(questionById.get(card.dataset.id));
  }
  button.addEventListener("pointerup", endPointer);
  button.addEventListener("pointercancel", endPointer);
  button.addEventListener("lostpointercapture", endPointer);
  button.addEventListener("click", event => {
    // A browser-generated click after dragging must never trigger a flip.
    if (interaction.suppressClick && event.detail !== 0) {
      interaction.suppressClick = false;
      event.preventDefault();
      return;
    }
    if (card === activeCard) void activate();
  });
  // Keep long questions readable without taking a touch drag away from rotation.
  button.addEventListener("wheel", event => {
    const text = card.querySelector(".card-question");
    if (!readyForInput() || !interaction.textVisible || text.scrollHeight <= text.clientHeight) return;
    text.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? text.clientHeight : 1);
    event.preventDefault();
  }, { passive: false });
}

// Only the active card needs window-level cleanup, even after many new decks.
window.addEventListener("blur", () => {
  if (!activeCard?.interaction.pointer) return;
  activeCard.interaction.suppressClick = true;
  releasePointer(activeCard);
  settleFace(activeCard);
});

function unlock(card) {
  const button = card.querySelector("button");
  button.tabIndex = 0;
  button.removeAttribute("aria-disabled");
  card.classList.add("is-resting");
}

function lock(card) {
  const button = card.querySelector("button");
  button.tabIndex = -1;
  button.setAttribute("aria-disabled", "true");
  card.classList.remove("is-resting");
}

function announceQuestion(question) {
  announcement.textContent = `Nível ${question.level}. ${question.text}`;
}

async function flipCard() {
  if (!readyForInput() || activeCard.interaction.pointer) return;
  const card = activeCard;
  const interaction = card.interaction;
  const reveal = !interaction.textVisible;
  setState(STATES.FLIPPING_OPEN);
  lock(card);
  const from = [...interaction.q];
  // Canonical orientations ensure that the text is upright after EVERY click.
  const to = reveal ? [0, 1, 0, 0] : [0, 0, 0, 1];
  const duration = motionDuration(720, 380);
  if (duration) {
    await new Promise(resolve => {
      interaction.finish = resolve;
      let start;
      function frame(now) {
        start ??= now;
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        applyOrientation(card, interpolateQuaternion(from, to, eased));
        if (progress < 1) interaction.frame = requestAnimationFrame(frame);
        else { interaction.frame = null; interaction.finish = null; resolve(); }
      }
      interaction.frame = requestAnimationFrame(frame);
    });
  }
  applyOrientation(card, to);
  if (reveal) announceQuestion(currentQuestion());
  else announcement.textContent = "Lado em branco. Clique para mostrar a mesma pergunta.";
  settleFace(card);
  unlock(card);
}

function flightPose(screenX, screenY, depth, scale, tilt, turn = 0) {
  const projection = 1200 / (1200 - depth);
  return `translate(-50%, -50%) translate3d(${screenX / projection}px, ${screenY / projection}px, ${depth}px) scale(${scale}) rotateX(${tilt}deg) rotateY(${turn}deg)`;
}

function shoeTransform() {
  const deck = shoeDeck.getBoundingClientRect();
  const centeredCard = activeCard.getBoundingClientRect();
  const travelX = deck.left + deck.width * .5 - (centeredCard.left + centeredCard.width * .5);
  const travelY = deck.top + deck.height * .48 - (centeredCard.top + centeredCard.height * .5);
  return { travelX, travelY, pose: flightPose(travelX, travelY, -620, .24, 70) };
}

const CENTER = flightPose(0, 0, 0, 1, 0);
const CENTER_AFTER_TURN = flightPose(0, 0, 0, 1, 0, 360);
// Original entrance: 2.6 seconds; fast entrance: 0.9 seconds.

function offscreenPath(card) {
  const screen = scene.getBoundingClientRect();
  const bounds = card.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  return {
    above: screen.top - centerY - bounds.height * .7 - 30,
    below: screen.top + screen.height - centerY + bounds.height * .7 + 30,
    left: screen.left - centerX - bounds.width * .7 - 30
  };
}

async function move(card, frames, duration, easing) {
  const animation = card.animate(frames, { duration, easing, fill: "both" });
  try { await animation.finished; }
  finally {
    card.style.transform = frames[frames.length - 1].transform;
    animation.cancel();
  }
}

async function arriveFromShoe(card, travelX, travelY, pose, outside) {
  if (!minimalMotion()) {
    const duration = motionDuration(2600, 900);
    const flight = move(card, [
      { transform: pose, offset: 0 },
      { transform: flightPose(travelX * .89, travelY + 50, -510, .33, 60, 35), offset: .14 },
      { transform: flightPose(travelX * .69, travelY + Math.min(145, scene.clientHeight * .18), -340, .48, 49, 105), offset: .29 },
      { transform: flightPose(travelX * .41, -scene.clientHeight * .2, -130, .76, 25, 210), offset: .48 },
      { transform: flightPose(0, outside.above, 110, 1.08, -5, 360), offset: .70 },
      { transform: flightPose(0, outside.above * .48, 70, 1.06, 0, 360), offset: .84 },
      { transform: flightPose(0, -20, 15, 1.02, 0, 360), offset: .96 },
      { transform: CENTER_AFTER_TURN, offset: 1 }
    ], duration, "cubic-bezier(.25, .4, .18, 1)");
    const riseAbove = setTimeout(() => card.classList.remove("is-behind-shoe"), duration * .05);
    const allowFinalClick = setTimeout(() => {
      card.classList.add("can-queue-flip");
      card.removeAttribute("aria-hidden");
      const button = card.querySelector("button");
      button.removeAttribute("aria-disabled");
      button.tabIndex = 0;
    }, duration * .84);
    try { await flight; }
    finally {
      clearTimeout(riseAbove);
      clearTimeout(allowFinalClick);
    }
  }
  card.classList.remove("is-behind-shoe");
  card.classList.remove("is-in-flight");
  card.classList.remove("can-queue-flip");
  card.style.transform = CENTER;
}

async function dealNext(restart = false) {
  if (!readyForInput() || activeCard.interaction.pointer) return;
  finishInstructions();
  setState(STATES.RETURNING_TO_SHOE);
  pendingFlip = false;
  const outgoing = activeCard;
  cancelInteraction(outgoing);
  const hadFocus = outgoing.contains(document.activeElement);
  lock(outgoing);
  if (hadFocus) document.activeElement.blur();
  outgoing.setAttribute("aria-hidden", "true");
  if (restart) {
    session = { order: shuffledIds(true), index: 0, block: 1 };
  } else if (session.index === session.order.length - 1) {
    session.order = shuffledIds();
    session.index = 0;
    session.block += 1;
  } else {
    session.index += 1;
  }
  announcement.textContent = "";
  updateInterface();

  const incoming = makeCard(currentQuestion());
  const { travelX, travelY, pose } = shoeTransform();
  const outside = offscreenPath(outgoing);
  incoming.style.transform = pose;
  incoming.classList.add("is-behind-shoe", "is-in-flight");
  incoming.setAttribute("aria-hidden", "true");
  lock(incoming);
  layer.append(incoming);
  activeCard = incoming;

  if (minimalMotion()) {
    await arriveFromShoe(incoming, travelX, travelY, pose, outside);
    outgoing.remove();
  } else {
    const returnDuration = motionDuration(1400, 500);
    const retreat = move(outgoing, [
      { transform: CENTER, offset: 0 },
      { transform: flightPose(0, outside.below * .56, -70, .89, 20), offset: .17 },
      { transform: flightPose(0, outside.below, -170, .71, 45), offset: .33 },
      { transform: flightPose(outside.left, outside.below, -420, .43, 67), offset: .55 },
      { transform: flightPose(outside.left, travelY - 85, -560, .26, 73), offset: .74 },
      { transform: flightPose(travelX - 45, travelY - 65, -620, .24, 70), offset: .89 },
      { transform: pose, offset: 1 }
    ], returnDuration, "cubic-bezier(.35, .08, .65, .92)");
    const sinkBehind = setTimeout(() => outgoing.classList.add("is-behind-shoe"), returnDuration * .714);
    const completedRetreat = retreat.then(() => {
      clearTimeout(sinkBehind);
      outgoing.remove();
    });

    // The next card only emerges after the previous one has circled behind the shoe.
    await pause(returnDuration * .8);
    setState(STATES.DEALING_NEXT);
    const advance = arriveFromShoe(incoming, travelX, travelY, pose, outside);
    await Promise.all([completedRetreat, advance]);
  }

  incoming.removeAttribute("aria-hidden");
  setState(STATES.IDLE_CLOSED);
  unlock(incoming);
  if (hadFocus) incoming.querySelector("button").focus({ preventScroll: true });
  if (pendingFlip) {
    pendingFlip = false;
    void runAction(flipCard);
  }
}

function activate() {
  if (readyForInput()) return runAction(flipCard);
  if (state === STATES.DEALING_NEXT && activeCard?.classList.contains("can-queue-flip")) {
    pendingFlip = true;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

skipButton.addEventListener("click", () => { if (readyForInput()) void runAction(() => dealNext()); });
newGameButton.addEventListener("click", () => { if (readyForInput()) void runAction(() => dealNext(true)); });

// Buttons already handle Enter and Space when focused. These keys also work
// immediately after opening the page, before a keyboard user presses Tab.
document.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " " || event.key === "Spacebar") &&
      (event.target === document.body || event.target === document.documentElement || event.target === scene)) {
    event.preventDefault();
    void activate();
  }
});

function registerBrowserTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const inputSchema = { type: "object", properties: {}, additionalProperties: false };
  for (const [name, title, description] of [
    ["reveal_question", "Virar carta", "Vira a carta fechada e mostra a pergunta atual."],
    ["advance_card", "Próxima carta", "Devolve a carta atual e distribui a próxima carta fechada."]
  ]) {
    try {
      Promise.resolve(context.registerTool({
        name, title, description, inputSchema,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
            throw new Error("Esta ação não recebe parâmetros.");
          }
          if (!readyForInput() || activeCard.interaction.pointer ||
              (name === "reveal_question" && activeCard.interaction.textVisible)) {
            throw new Error("A carta ainda não está pronta para esta ação.");
          }
          if (name === "advance_card") await runAction(() => dealNext());
          else await runAction(flipCard);
          const question = currentQuestion();
          return { id: question.id, level: question.level,
            ...(name === "reveal_question" ? { question: question.text } : { closed: true }) };
        }
      })).catch(() => {});
    } catch { /* Browsers without WebMCP keep the same card interaction. */ }
  }
}

activeCard = makeCard(currentQuestion());
layer.append(activeCard);
const { travelX, travelY, pose } = shoeTransform();
const outside = offscreenPath(activeCard);
activeCard.style.transform = pose;
activeCard.classList.add("is-behind-shoe", "is-in-flight");
activeCard.setAttribute("aria-hidden", "true");
lock(activeCard);
setState(STATES.DEALING_NEXT);
void arriveFromShoe(activeCard, travelX, travelY, pose, outside).then(() => {
  activeCard.classList.remove("is-behind-shoe", "is-in-flight");
  activeCard.style.transform = CENTER;
  activeCard.removeAttribute("aria-hidden");
  setState(STATES.IDLE_CLOSED);
  unlock(activeCard);
  if (pendingFlip) {
    pendingFlip = false;
    void runAction(flipCard);
  }
}).catch(reportFailure);
registerBrowserTools();
