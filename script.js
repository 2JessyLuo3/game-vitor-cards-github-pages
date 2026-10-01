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
let session = { order: shuffledIds(true), index: 0 };
let state = STATES.IDLE_CLOSED;
let activeCard;
let pendingFlip = false;

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
  button.setAttribute("aria-label", revealed ? "Próxima carta" : "Virar carta");
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
  rotor.append(back, front);
  button.append(rotor);
  bob.append(button);
  card.append(bob);
  button.addEventListener("click", activate);
  return card;
}

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

function awaitTransform(element, timeout) {
  return new Promise(resolve => {
    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      element.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      resolve();
    }
    function onEnd(event) { if (event.target === element && event.propertyName === "transform") finish(); }
    const timer = setTimeout(finish, timeout);
    element.addEventListener("transitionend", onEnd);
  });
}

async function flipOpen() {
  state = STATES.FLIPPING_OPEN;
  lock(activeCard);
  const rotor = activeCard.querySelector(".card-rotor");
  const finished = awaitTransform(rotor, reducedMotion.matches ? 100 : 820);
  rotor.classList.add("is-open");
  await finished;
  activeCard.querySelector(".card-face--back").setAttribute("aria-hidden", "true");
  activeCard.querySelector(".card-face--front").setAttribute("aria-hidden", "false");
  activeCard.querySelector("button").setAttribute("aria-label", "Próxima carta");
  announceQuestion(currentQuestion());
  state = STATES.IDLE_OPEN;
  unlock(activeCard);
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
const ARRIVAL_DURATION = 2600;

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
  if (reducedMotion.matches) {
    await pause(100);
  } else {
    const flight = move(card, [
      { transform: pose, offset: 0 },
      { transform: flightPose(travelX * .89, travelY + 50, -510, .33, 60, 35), offset: .14 },
      { transform: flightPose(travelX * .69, travelY + Math.min(145, scene.clientHeight * .18), -340, .48, 49, 105), offset: .29 },
      { transform: flightPose(travelX * .41, -scene.clientHeight * .2, -130, .76, 25, 210), offset: .48 },
      { transform: flightPose(0, outside.above, 110, 1.08, -5, 360), offset: .70 },
      { transform: flightPose(0, outside.above * .48, 70, 1.06, 0, 360), offset: .84 },
      { transform: flightPose(0, -20, 15, 1.02, 0, 360), offset: .96 },
      { transform: CENTER_AFTER_TURN, offset: 1 }
    ], ARRIVAL_DURATION, "cubic-bezier(.25, .4, .18, 1)");
    const riseAbove = setTimeout(() => card.classList.remove("is-behind-shoe"), 130);
    const allowFinalClick = setTimeout(() => {
      card.classList.add("can-queue-flip");
      card.removeAttribute("aria-hidden");
      const button = card.querySelector("button");
      button.removeAttribute("aria-disabled");
      button.tabIndex = 0;
    }, ARRIVAL_DURATION * .84);
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

async function dealNext() {
  state = STATES.RETURNING_TO_SHOE;
  pendingFlip = false;
  const outgoing = activeCard;
  const hadFocus = outgoing.contains(document.activeElement);
  lock(outgoing);
  if (hadFocus) document.activeElement.blur();
  outgoing.setAttribute("aria-hidden", "true");
  if (session.index === session.order.length - 1) {
    session.order = shuffledIds();
    session.index = 0;
  } else {
    session.index += 1;
  }
  announcement.textContent = "";

  const incoming = makeCard(currentQuestion());
  const { travelX, travelY, pose } = shoeTransform();
  const outside = offscreenPath(outgoing);
  incoming.style.transform = pose;
  incoming.classList.add("is-behind-shoe", "is-in-flight");
  incoming.setAttribute("aria-hidden", "true");
  lock(incoming);
  layer.append(incoming);
  activeCard = incoming;

  if (reducedMotion.matches) {
    await arriveFromShoe(incoming, travelX, travelY, pose, outside);
    outgoing.remove();
  } else {
    const retreat = move(outgoing, [
      { transform: CENTER, offset: 0 },
      { transform: flightPose(0, outside.below * .56, -70, .89, 20), offset: .17 },
      { transform: flightPose(0, outside.below, -170, .71, 45), offset: .33 },
      { transform: flightPose(outside.left, outside.below, -420, .43, 67), offset: .55 },
      { transform: flightPose(outside.left, travelY - 85, -560, .26, 73), offset: .74 },
      { transform: flightPose(travelX - 45, travelY - 65, -620, .24, 70), offset: .89 },
      { transform: pose, offset: 1 }
    ], 1400, "cubic-bezier(.35, .08, .65, .92)");
    const sinkBehind = setTimeout(() => outgoing.classList.add("is-behind-shoe"), 1000);
    const completedRetreat = retreat.then(() => {
      clearTimeout(sinkBehind);
      outgoing.remove();
    });

    // The next card only emerges after the previous one has circled behind the shoe.
    await pause(1120);
    state = STATES.DEALING_NEXT;
    const advance = arriveFromShoe(incoming, travelX, travelY, pose, outside);
    await Promise.all([completedRetreat, advance]);
  }

  incoming.removeAttribute("aria-hidden");
  state = STATES.IDLE_CLOSED;
  unlock(incoming);
  if (hadFocus) incoming.querySelector("button").focus({ preventScroll: true });
  if (pendingFlip) {
    pendingFlip = false;
    void flipOpen();
  }
}

function activate() {
  if (state === STATES.IDLE_CLOSED) return flipOpen();
  if (state === STATES.IDLE_OPEN) return dealNext();
  if (state === STATES.DEALING_NEXT && activeCard?.classList.contains("can-queue-flip")) {
    pendingFlip = true;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

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
  for (const [name, title, expected, description] of [
    ["reveal_question", "Virar carta", STATES.IDLE_CLOSED, "Vira a carta fechada e mostra a pergunta atual."],
    ["advance_card", "Próxima carta", STATES.IDLE_OPEN, "Devolve a carta aberta e distribui a próxima carta fechada."]
  ]) {
    try {
      Promise.resolve(context.registerTool({
        name, title, description, inputSchema,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
            throw new Error("Esta ação não recebe parâmetros.");
          }
          if (state !== expected) throw new Error("A carta ainda não está pronta para esta ação.");
          await activate();
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
state = STATES.DEALING_NEXT;
void arriveFromShoe(activeCard, travelX, travelY, pose, outside).finally(() => {
  activeCard.classList.remove("is-behind-shoe", "is-in-flight");
  activeCard.style.transform = CENTER;
  activeCard.removeAttribute("aria-hidden");
  state = STATES.IDLE_CLOSED;
  unlock(activeCard);
  if (pendingFlip) {
    pendingFlip = false;
    void flipOpen();
  }
});
registerBrowserTools();
