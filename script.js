/* Para trocar uma pergunta, altere apenas o texto entre aspas abaixo.
   Mantenha o id e o nível: eles preservam a sequência e a cor da carta. */
const DEFAULT_QUESTIONS = [
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

let QUESTIONS = loadQuestions();
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
const menuToggle = document.getElementById("menu-toggle");
const drawer = document.getElementById("question-drawer");
const backdrop = document.getElementById("drawer-backdrop");
const emptyState = document.getElementById("empty-state");
let drawerOpen = false;

// Questions and preferences are local to this browser. Each visit shuffles a fresh game.
function readPreference(key, fallback) {
  try { return localStorage.getItem(`vitor-cards:${key}`) ?? fallback; }
  catch { return fallback; }
}
function writePreference(key, value) {
  try { localStorage.setItem(`vitor-cards:${key}`, value); return true; }
  catch { return false; }
}
function validateQuestions(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const questions = [];
  for (const question of value) {
    if (!question || typeof question.id !== "string" || !question.id || seen.has(question.id) ||
        typeof question.text !== "string" || !question.text.trim() || question.text.length > 1000 ||
        ![1, 2, 3].includes(question.level)) return null;
    seen.add(question.id);
    questions.push({ id: question.id, text: question.text.trim(), level: question.level });
  }
  return questions;
}
function loadQuestions() {
  try {
    const saved = readPreference("questions-v2", null);
    if (saved !== null) {
      const valid = validateQuestions(JSON.parse(saved));
      if (valid) return valid;
    }
  } catch { /* A malformed save never prevents opening the original game. */ }
  return DEFAULT_QUESTIONS.map(question => ({ ...question }));
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
  diceTable?.motionChanged();
  if (minimalMotion() && activeCard) {
    stopInertia(activeCard);
    if (readyForInput()) settleFace(activeCard);
  }
});
reducedMotion.addEventListener?.("change", () => {
  updateMotion();
  diceTable?.motionChanged();
  if (minimalMotion() && activeCard) {
    stopInertia(activeCard);
    if (readyForInput()) settleFace(activeCard);
  }
});
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
let gameMode = readPreference("game-mode", "random") === "dice" ? "dice" : "random";
let diceBusy = false;
let diceDeck;
let diceTable;
let diceLastResult = null;
const diceResult = document.getElementById("dice-result");
const diceNumber = document.getElementById("dice-result-number");
const diceLevel = document.getElementById("dice-result-level");
const diceDetail = document.getElementById("dice-result-detail");
const diceHint = document.getElementById("dice-hint");

function readyForInput() { return state === STATES.IDLE_CLOSED || state === STATES.IDLE_OPEN; }
function updateInterface() {
  const ready = readyForInput() && !activeCard?.interaction?.pointer;
  newGameButton.disabled = !ready || drawerOpen || diceBusy || !QUESTIONS.length || (gameMode === "random" && !activeCard);
  skipButton.disabled = !ready || drawerOpen || !activeCard || gameMode === "dice";
  skipButton.hidden = gameMode === "dice";
  motionSelect.disabled = !ready || drawerOpen || diceBusy;
  menuToggle.disabled = !ready || diceBusy;
  diceTable?.setDisabled(!canRollDice());
  emptyState.hidden = gameMode === "dice" ? Boolean(QUESTIONS.length) : Boolean(activeCard);
  const countText = gameMode === "dice" ? `Sorteadas ${diceDeck?.used ?? 0} de ${QUESTIONS.length}` : session.order.length ? `Carta ${session.index + 1} de ${session.order.length}` : "Sem perguntas";
  const blockText = gameMode === "dice" ? `Dado de 10 lados · ${diceDeck?.remaining() ?? QUESTIONS.length} restantes` : `Baralho ${session.block}`;
  if (cardCount.textContent !== countText) cardCount.textContent = countText;
  if (deckCount.textContent !== blockText) deckCount.textContent = blockText;
  updateInstruction();
  cancelAnimationFrame(layoutFrame);
  if (ready) layoutFrame = requestAnimationFrame(fitLayout);
}
function updateInstruction() {
  const questionText = activeCard?.querySelector(".card-question");
  const needsScroll = questionText && questionText.scrollHeight > questionText.clientHeight + 1;
  instruction.hidden = !activeCard || gameMode === "dice";
  instruction.textContent = needsScroll
    ? "Clique para virar. Arraste para girar. Para ler tudo: roda do mouse ou dois dedos."
    : "Clique para virar. Arraste e solte para girar. Próximo troca a pergunta.";
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
  if (!activeCard) { setState(STATES.IDLE_CLOSED); return; }
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

function currentQuestion() { return gameMode === "dice" ? diceLastResult?.question : questionById.get(session.order[session.index]); }
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
    pointer: null, reader: null, suppressClick: false, frame: null, finish: null,
    inertiaFrame: null, angularVelocity: [0, 0, 0] };
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

// The same world-space angular vector drives dragging and free rotation on all
// three axes. No Euler angles: combined turns remain stable and text can always
// return to the canonical upright pose when clicked.
const MAX_ANGULAR_SPEED = 18; // radians/second, magnitude across all three axes
const INERTIA_FRICTION = 3.7; // exponential damping per second
const MIN_ANGULAR_SPEED = .045;
function rotateByVector(card, vector) {
  const angle = Math.hypot(...vector);
  if (!angle) return;
  const scale = Math.sin(angle / 2) / angle;
  applyOrientation(card, multiplyQuaternion([
    vector[0] * scale, vector[1] * scale, vector[2] * scale, Math.cos(angle / 2)
  ], card.interaction.q));
}
function stopInertia(card) {
  const interaction = card.interaction;
  cancelAnimationFrame(interaction.inertiaFrame);
  interaction.inertiaFrame = null;
  interaction.angularVelocity = [0, 0, 0];
  card.classList.remove("is-spinning");
}
function releaseVelocity(pointer, now) {
  const samples = pointer.samples.filter(sample => now - sample.at <= 120);
  if (!samples.length || pointer.scrolling) return [0, 0, 0];
  // Time-weighted recent samples keep a tiny final move from erasing a throw.
  // Pausing before release deliberately stops the card instead of reviving a
  // gesture from earlier in the drag.
  const age = Math.max(0, now - samples.at(-1).at);
  if (age >= 120) return [0, 0, 0];
  let weight = 0;
  const velocity = [0, 0, 0];
  for (const sample of samples) {
    const w = Math.min(sample.duration, .05) * Math.exp(-(now - sample.at) / 90);
    weight += w;
    for (let axis = 0; axis < 3; axis++) velocity[axis] += sample.velocity[axis] * w;
  }
  if (!weight) return [0, 0, 0];
  const torque = (.5 + .5 * pointer.leverage) * Math.exp(-age / 70);
  const average = velocity.map(value => value / weight * torque);
  const speed = Math.hypot(...average);
  return average.map(value => value * Math.min(1, MAX_ANGULAR_SPEED / (speed || 1)));
}
function startInertia(card, velocity) {
  stopInertia(card);
  if (minimalMotion() || Math.hypot(...velocity) < MIN_ANGULAR_SPEED) return;
  const interaction = card.interaction;
  interaction.angularVelocity = velocity;
  card.classList.add("is-spinning");
  let last = performance.now();
  function frame(now) {
    interaction.inertiaFrame = null;
    if (card !== activeCard || drawerOpen || !readyForInput() || interaction.pointer || minimalMotion()) {
      stopInertia(card);
      return;
    }
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    const friction = motionMode === "fast" ? 5.8 : INERTIA_FRICTION;
    const decay = Math.exp(-friction * elapsed);
    // Integrate the damped velocity exactly: the travel and stopping point are
    // equivalent at 30, 60 or 120 Hz, rather than depending on the frame rate.
    let travel = (1 - decay) / friction;
    // A delayed frame still loses its elapsed energy, but displays at most a
    // 20-degree step instead of jumping through several turns. Hidden tabs are
    // stopped by visibilitychange, independently of the render schedule.
    if (elapsed > .1) travel = Math.min(travel, .35 / Math.hypot(...interaction.angularVelocity));
    rotateByVector(card, interaction.angularVelocity.map(value => value * travel));
    interaction.angularVelocity = interaction.angularVelocity.map(value => value * decay);
    if (Math.hypot(...interaction.angularVelocity) >= MIN_ANGULAR_SPEED) {
      interaction.inertiaFrame = requestAnimationFrame(frame);
    } else {
      stopInertia(card);
      settleFace(card);
      if (interaction.textVisible) announceQuestion(questionById.get(card.dataset.id));
    }
  }
  interaction.inertiaFrame = requestAnimationFrame(frame);
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
  stopInertia(card);
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
    if (drawerOpen || diceBusy || card !== activeCard || !readyForInput() || interaction.pointer || !event.isPrimary || event.button !== 0) return;
    stopInertia(card);
    // The card wrapper stays centered while its inner rotor turns. Capture the
    // grab point from that stable rectangle, not from the rotating face bounds.
    const bounds = card.getBoundingClientRect();
    const grabX = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)));
    const grabY = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)));
    interaction.suppressClick = false;
    interaction.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false, gain: Math.PI * 1.25 / button.offsetWidth,
      grabX, grabY, leverage: Math.min(1, Math.hypot(grabX, grabY)), samples: [], time: performance.now() };
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
    const vector = [-dy * pointer.gain, dx * pointer.gain,
      (pointer.grabX * dy - pointer.grabY * dx) * pointer.gain * .9];
    rotateByVector(card, vector);
    const now = performance.now();
    const duration = Math.max(1 / 240, (now - pointer.time) / 1000);
    pointer.samples.push({ at: now, duration, velocity: vector.map(value => value / duration) });
    if (pointer.samples.length > 6) pointer.samples.shift();
    pointer.time = now;
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
    const velocity = event.type === "pointerup" && pointer.moved && !pointer.scrolling
      ? releaseVelocity(pointer, performance.now()) : [0, 0, 0];
    releasePointer(card);
    settleFace(card);
    startInertia(card, velocity);
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
  if (!activeCard || (!activeCard.interaction.pointer && activeCard.interaction.inertiaFrame === null)) return;
  if (activeCard.interaction.pointer) activeCard.interaction.suppressClick = true;
  stopInertia(activeCard);
  releasePointer(activeCard);
  settleFace(activeCard);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden || !activeCard || !readyForInput()) return;
  if (activeCard.interaction.pointer) activeCard.interaction.suppressClick = true;
  stopInertia(activeCard);
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
  if (!readyForInput() || drawerOpen || diceBusy || !activeCard || activeCard.interaction.pointer) return;
  const card = activeCard;
  const interaction = card.interaction;
  stopInertia(card);
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

async function dealNext(restart = false, diceQuestion = null) {
  if (gameMode === "dice" && !diceQuestion) return;
  if (!readyForInput() || drawerOpen || !activeCard || activeCard.interaction.pointer) return;
  finishInstructions();
  setState(STATES.RETURNING_TO_SHOE);
  pendingFlip = false;
  const outgoing = activeCard;
  cancelInteraction(outgoing);
  const hadFocus = outgoing.contains(document.activeElement);
  lock(outgoing);
  if (hadFocus) document.activeElement.blur();
  outgoing.setAttribute("aria-hidden", "true");
  if (diceQuestion) {
    // The D10 bag already consumed this question. Never reshuffle it here.
  } else if (restart) {
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

  const incoming = makeCard(diceQuestion ?? currentQuestion());
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
  if (drawerOpen || diceBusy || !activeCard) return Promise.resolve(false);
  if (readyForInput()) return runAction(flipCard);
  if (state === STATES.DEALING_NEXT && activeCard?.classList.contains("can-queue-flip")) {
    pendingFlip = true;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

skipButton.addEventListener("click", () => { if (readyForInput()) void runAction(() => dealNext()); });
newGameButton.addEventListener("click", () => {
  if (!readyForInput() || drawerOpen || diceBusy) return;
  if (gameMode === "dice") { resetBoard(); announcement.textContent = "Novo jogo. Todos os números foram restaurados. Role o dado."; }
  else void runAction(() => dealNext(true));
});

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
          if (!readyForInput() || drawerOpen || !activeCard || activeCard.interaction.pointer ||
              (name === "reveal_question" && activeCard.interaction.textVisible)) {
            throw new Error("A carta ainda não está pronta para esta ação.");
          }
          if (name === "advance_card") {
            if (gameMode === "dice") throw new Error("No modo de dado, role o dado para trocar a pergunta.");
            await runAction(() => dealNext());
          }
          else await runAction(flipCard);
          const question = currentQuestion();
          return { id: question.id, level: question.level,
            ...(name === "reveal_question" ? { question: question.text } : { closed: true }) };
        }
      })).catch(() => {});
    } catch { /* Browsers without WebMCP keep the same card interaction. */ }
  }
}

function resetBoard(animate=false) {
  diceBusy=false; diceLastResult=null; diceDeck=new window.VitorDice.DiceDeck(QUESTIONS,randomInteger);
  diceTable?.setEnabled(gameMode === "dice");
  if(gameMode === "dice") diceTable?.reset();
  resetDiceResult();
  if(activeCard) { cancelInteraction(activeCard); activeCard.getAnimations().forEach(animation=>animation.cancel()); activeCard.remove(); }
  activeCard=null; pendingFlip=false;
  session={order:shuffledIds(true),index:0,block:1};
  scene.style.removeProperty("--card-width"); scene.style.removeProperty("--card-top"); scene.style.removeProperty("height");
  document.documentElement.classList.remove("needs-scroll");
  announcement.textContent="";
  if(!QUESTIONS.length || gameMode === "dice") { setState(STATES.IDLE_CLOSED); return; }
  activeCard=makeCard(currentQuestion()); layer.append(activeCard);
  if(!animate) { activeCard.style.transform=CENTER; unlock(activeCard); setState(STATES.IDLE_CLOSED); return; }
  const card=activeCard, {travelX,travelY,pose}=shoeTransform(), outside=offscreenPath(card);
  card.style.transform=pose; card.classList.add("is-behind-shoe","is-in-flight"); card.setAttribute("aria-hidden","true"); lock(card);
  setState(STATES.DEALING_NEXT);
  void arriveFromShoe(card,travelX,travelY,pose,outside).then(()=>{
    card.classList.remove("is-behind-shoe","is-in-flight"); card.style.transform=CENTER; card.removeAttribute("aria-hidden");
    setState(STATES.IDLE_CLOSED); unlock(card);
    if(pendingFlip) { pendingFlip=false; void runAction(flipCard); }
  }).catch(reportFailure);
}

const questionList=document.getElementById("question-list");
const questionTotal=document.getElementById("question-total");
const questionForm=document.getElementById("question-form");
const questionTextInput=document.getElementById("question-text");
const questionLevelInput=document.getElementById("question-level");
const feedback=document.getElementById("editor-feedback");
const undoButton=document.getElementById("undo-edit");
let editQuestionId=null;
const questionUndo=[];
function renderQuestionList() {
  questionList.replaceChildren(); questionTotal.textContent=String(QUESTIONS.length); undoButton.hidden=!questionUndo.length;
  if(!QUESTIONS.length) {
    const message=document.createElement("p"); message.className="empty-list"; message.textContent="Nenhuma pergunta. Adicione uma para começar."; questionList.append(message); return;
  }
  for(const [index, question] of QUESTIONS.entries()) {
    const item=document.createElement("article"); item.className="question-item"; item.dataset.level=String(question.level); item.dataset.id=question.id;
    const meta=document.createElement("span"); meta.className="question-meta"; meta.textContent=`PERGUNTA ${index + 1} · NÍVEL ${question.level}`;
    const text=document.createElement("p"); text.textContent=question.text;
    const actions=document.createElement("div"); actions.className="question-item-actions";
    const edit=document.createElement("button"); edit.type="button"; edit.className="quiet-button"; edit.textContent="Editar";
    edit.setAttribute("aria-label",`Editar pergunta ${index + 1}, nível ${question.level}`); edit.addEventListener("click",()=>openQuestionForm(question));
    const remove=document.createElement("button"); remove.type="button"; remove.className="quiet-button delete-button"; remove.textContent="Apagar";
    remove.setAttribute("aria-label",`Apagar pergunta ${index + 1}, nível ${question.level}`);
    remove.addEventListener("click",()=>{
      if(!readyForInput()) return;
      if(editQuestionId===question.id) closeQuestionForm();
      commitQuestions(QUESTIONS.filter(item=>item.id!==question.id),"Pergunta apagada. Você pode desfazer abaixo.");
      undoButton.focus();
    });
    actions.append(edit,remove); item.append(meta,text,actions); questionList.append(item);
  }
}
function openQuestionForm(question=null) {
  editQuestionId=question?.id??null;
  document.getElementById("form-title").textContent=question?"Editar pergunta":"Nova pergunta";
  questionTextInput.value=question?.text??""; questionLevelInput.value=String(question?.level??1);
  questionForm.hidden=false; feedback.textContent="";
  questionForm.scrollIntoView({block:"nearest",behavior:minimalMotion()?"instant":"smooth"});
  questionTextInput.focus({preventScroll:true});
}
function closeQuestionForm() { questionForm.hidden=true; editQuestionId=null; }
function commitQuestions(next,message,remember=true) {
  const validated=validateQuestions(next);
  if(!validated) { feedback.textContent="Confira o texto e o nível da pergunta."; return false; }
  if(remember) { questionUndo.push(QUESTIONS.map(question=>({...question}))); if(questionUndo.length>10) questionUndo.shift(); }
  QUESTIONS=validated; questionById.clear(); for(const question of QUESTIONS) questionById.set(question.id,question);
  const saved=writePreference("questions-v2",JSON.stringify(QUESTIONS));
  resetBoard(); renderQuestionList();
  feedback.textContent=saved?message:`${message} O navegador não permitiu salvar; as alterações valem somente nesta sessão.`;
  return true;
}
questionForm.addEventListener("submit",event=>{
  event.preventDefault(); if(!readyForInput()) return;
  const text=questionTextInput.value.trim(), level=Number(questionLevelInput.value);
  if(!text||text.length>1000||![1,2,3].includes(level)) { feedback.textContent="Escreva uma pergunta e escolha um nível válido."; return; }
  const id=editQuestionId??`custom-${window.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const question={id,text,level}, next=editQuestionId?QUESTIONS.map(item=>item.id===id?question:item):[...QUESTIONS,question];
  if(commitQuestions(next,"Pergunta salva. O baralho foi atualizado.")) { closeQuestionForm(); document.getElementById("add-question").focus(); }
});
document.getElementById("add-question").addEventListener("click",()=>openQuestionForm());
document.getElementById("cancel-edit").addEventListener("click",()=>{ closeQuestionForm(); document.getElementById("add-question").focus(); });
undoButton.addEventListener("click",()=>{
  if(!readyForInput()||!questionUndo.length) return;
  closeQuestionForm(); commitQuestions(questionUndo.pop(),"Alteração desfeita.",false); document.getElementById("add-question").focus();
});
function setDrawer(open) {
  if(open&&(!readyForInput()||diceBusy)) return;
  if(open && activeCard) { stopInertia(activeCard); settleFace(activeCard); }
  drawerOpen=open; drawer.classList.toggle("is-open",open); drawer.setAttribute("aria-hidden",String(!open)); drawer.inert=!open;
  backdrop.hidden=!open; scene.inert=open;
  menuToggle.setAttribute("aria-expanded",String(open)); menuToggle.setAttribute("aria-label",open?"Fechar perguntas e modos":"Abrir perguntas e modos");
  if(open) { renderQuestionList(); document.getElementById("add-question").focus({preventScroll:true}); }
  else menuToggle.focus({preventScroll:true});
  updateInterface();
}
menuToggle.addEventListener("click",()=>setDrawer(!drawerOpen)); backdrop.addEventListener("click",()=>setDrawer(false));
document.addEventListener("keydown",event=>{
  if(!drawerOpen) return;
  if(event.key==="Escape") { event.preventDefault(); setDrawer(false); }
  if(event.key==="Tab") {
    const controls=[menuToggle,...drawer.querySelectorAll('button:not([hidden]),select,textarea,input')].filter(element=>!element.disabled&&element.getClientRects().length);
    const index=controls.indexOf(document.activeElement), next=event.shiftKey?(index<=0?controls.length-1:index-1):(index+1)%controls.length;
    event.preventDefault(); controls[next]?.focus();
  }
});
// Dice UI and tabletop are created once; switching modes never accumulates listeners.
function canRollDice() {
  return gameMode === "dice" && !drawerOpen && !diceBusy && readyForInput() &&
    !activeCard?.interaction.pointer && Boolean(diceDeck?.remaining());
}
function resetDiceResult() {
  const dice = gameMode === "dice";
  scene.classList.toggle("mode-dice",dice);
  diceResult.hidden=!dice; diceHint.hidden=!dice;
  diceResult.removeAttribute("data-level");
  diceNumber.textContent="—";
  diceLevel.textContent=QUESTIONS.length?"Role o dado":"Sem perguntas";
  diceDetail.textContent="Clique ou arraste e solte.";
  diceHint.textContent="Clique no dado ou arraste e solte para lançar.";
  document.getElementById("dice-result-label").textContent="DADO DE 10 LADOS";
  for(const mode of ["random","dice"]) {
    const button=document.getElementById(`mode-${mode}`), selected=mode===gameMode;
    button.setAttribute("aria-pressed",String(selected));
    button.querySelector(".mode-tag").textContent=selected?"Ativo":"Jogar";
  }
}
function beginDiceRoll() {
  if(!canRollDice()) return null;
  if(activeCard) stopInertia(activeCard);
  const result=diceDeck.draw();
  if(!result) return null;
  diceResult.removeAttribute("data-level");
  document.getElementById("dice-result-label").textContent="ROLANDO…";
  diceNumber.textContent="…"; diceLevel.textContent=""; diceDetail.textContent="";
  announcement.textContent="Rolando o dado.";
  return result;
}
async function dealDiceQuestion(result) {
  diceLastResult=result;
  document.getElementById("dice-result-label").textContent="RESULTADO";
  diceNumber.textContent=String(result.number);
  diceLevel.textContent=`Nível ${result.level} · ${["Verde","Amarelo","Vermelho"][result.level-1]}`;
  diceDetail.textContent=`Pergunta ${result.ordinal} · ${diceDeck.remaining()} restantes`;
  diceResult.dataset.level=String(result.level);
  diceHint.textContent=diceDeck.remaining()?"Clique no dado ou arraste e solte para a próxima carta.":"Todas as perguntas saíram. Clique em Novo jogo para recomeçar.";
  announcement.textContent=`Dado: ${result.number}. Nível ${result.level}. Clique na carta para mostrar a pergunta.`;
  if(activeCard) { await dealNext(false,result.question); return; }
  activeCard=makeCard(result.question); layer.append(activeCard);
  const card=activeCard, {travelX,travelY,pose}=shoeTransform(), outside=offscreenPath(card);
  card.style.transform=pose; card.classList.add("is-behind-shoe","is-in-flight"); card.setAttribute("aria-hidden","true"); lock(card);
  setState(STATES.DEALING_NEXT);
  await arriveFromShoe(card,travelX,travelY,pose,outside);
  card.removeAttribute("aria-hidden"); unlock(card); setState(STATES.IDLE_CLOSED);
}
diceTable=new window.VitorDice.D10Table({
  scene, canvas:document.getElementById("dice-canvas"), button:document.getElementById("dice-grab"), floor:document.getElementById("dice-floor"),
  cardRect:()=>{
    if(!activeCard || !readyForInput()) return null;
    const base=scene.getBoundingClientRect(), bounds=activeCard.querySelector(".card-rotor").getBoundingClientRect();
    return {left:bounds.left-base.left,right:bounds.right-base.left,top:bounds.top-base.top,bottom:bounds.bottom-base.top};
  },
  canRoll:canRollDice, begin:beginDiceRoll, complete:result=>void runAction(()=>dealDiceQuestion(result)),
  busy:value=>{diceBusy=value; updateInterface();},
  motion:()=>minimalMotion()?"reduced":motionMode, random:randomInteger
});
for(const mode of ["random","dice"]) document.getElementById(`mode-${mode}`).addEventListener("click",()=>{
  if(gameMode===mode||!readyForInput()||diceBusy) return;
  closeQuestionForm(); setDrawer(false); gameMode=mode; writePreference("game-mode",mode); resetBoard(mode==="random");
  announcement.textContent=mode==="dice"?"Modo de dado. Role o dado para tirar uma carta.":"Modo de baralho aleatório.";
});
renderQuestionList();
resetBoard(true);
registerBrowserTools();
