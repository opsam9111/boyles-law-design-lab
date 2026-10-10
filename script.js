"use strict";

const slider = document.querySelector("#volume-slider");
const volumeOutput = document.querySelector("#volume-output");
const volumeReadout = document.querySelector("#volume-readout");
const pressureReadout = document.querySelector("#pressure-readout");
const gaugeValue = document.querySelector("#gauge-value");
const constantReadout = document.querySelector("#constant-readout");
const description = document.querySelector("#sim-description");
const chamber = document.querySelector("#gas-chamber");
const particleLayer = document.querySelector("#particles");
const motionToggle = document.querySelector("#motion-toggle");
const speakButton = document.querySelector("#speak-button");
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector("#site-nav");
const languageSelect = document.querySelector("#language-select");
const textSizeToggle = document.querySelector("#text-size-toggle");
const contrastToggle = document.querySelector("#contrast-toggle");
const languageStatus = document.querySelector("#language-status");

const languageProfiles = {
  en: { locale: "en-US", working: "Changing language…", ready: "English displayed", error: "Translation could not be completed." },
  es: { locale: "es-ES", working: "Traduciendo toda la página…", ready: "Página completa en español", error: "No se pudo completar la traducción." },
  fr: { locale: "fr-FR", working: "Traduction de toute la page…", ready: "Page entièrement en français", error: "La traduction n’a pas pu être terminée." },
  yo: { locale: "yo-NG", working: "À ń túmọ̀ gbogbo ojú-ìwé…", ready: "Gbogbo ojú-ìwé wà ní Yorùbá", error: "A kò lè parí ìtumọ̀ náà." }
};
const translationCache = new Map();
let pageItems = [];
let currentLanguage = "en";
let languageChangeToken = 0;

function isTranslatableText(text) {
  const value = text.trim();
  if (!value || /^(TPACK|SAMR|UDL|[TSA MRU]|\d+|P₁V₁ = P₂V₂|P × V|P = 100 ÷ V|atm|→|⇄)$/u.test(value)) return false;
  return /[A-Za-z]/.test(value);
}

function capturePageLanguageItems() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const items = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest("#language-select, script, style")) continue;
    if (isTranslatableText(node.nodeValue)) items.push({ kind: "text", node, original: node.nodeValue });
  }
  document.querySelectorAll("[aria-label], [placeholder], [title]").forEach(element => {
    if (element.closest("#language-select")) return;
    ["aria-label", "placeholder", "title"].forEach(attribute => {
      const original = element.getAttribute(attribute);
      if (original && isTranslatableText(original)) items.push({ kind: "attribute", element, attribute, original });
    });
  });
  return items;
}

async function requestTranslation(text, language) {
  if (language === "en" || !isTranslatableText(text)) return text;
  const key = `${language}::${text}`;
  if (translationCache.has(key)) return translationCache.get(key);
  const storageKey = `opsam-i18n-${key}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) { translationCache.set(key, saved); return saved; }
  let translated;
  try {
    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${language}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Primary translation request failed: ${response.status}`);
    const data = await response.json();
    translated = data[0].map(part => part[0]).join("");
  } catch (primaryError) {
    const fallback = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7C${language}`;
    const response = await fetch(fallback);
    if (!response.ok) throw primaryError;
    const data = await response.json();
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) throw primaryError;
    translated = data.responseData.translatedText;
  }
  translationCache.set(key, translated);
  try { localStorage.setItem(storageKey, translated); } catch (_) { /* Optional cache. */ }
  return translated;
}

async function translateInBatches(values, language) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await requestTranslation(values[index].trim(), language);
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, values.length) }, worker));
  return results;
}

function restoreEnglishPage() {
  pageItems.forEach(item => {
    if (item.kind === "text") item.node.nodeValue = item.original;
    else item.element.setAttribute(item.attribute, item.original);
  });
  document.title = "Boyle's Law Design Lab | One Lesson Through Three Frameworks";
}

function speakLocalized(text) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = languageProfiles[currentLanguage].locale;
  const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(currentLanguage));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function localized(text) {
  return currentLanguage === "en" ? text : requestTranslation(text, currentLanguage);
}

async function changePageLanguage(language) {
  const token = ++languageChangeToken;
  const profile = languageProfiles[language];
  document.body.classList.add("is-translating");
  languageStatus.textContent = profile.working;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  clearMicroLesson();
  try {
    restoreEnglishPage();
    if (language !== "en") {
      const translated = await translateInBatches(pageItems.map(item => item.original), language);
      if (token !== languageChangeToken) return;
      pageItems.forEach((item, index) => {
        const original = item.original;
        const leading = original.match(/^\s*/)[0];
        const trailing = original.match(/\s*$/)[0];
        const value = `${leading}${translated[index]}${trailing}`;
        if (item.kind === "text") item.node.nodeValue = value;
        else item.element.setAttribute(item.attribute, value.trim());
      });
      document.title = await requestTranslation("Boyle's Law Design Lab | One Lesson Through Three Frameworks", language);
    }
    currentLanguage = language;
    document.documentElement.lang = language;
    localStorage.setItem("opsam-language", language);
    updateSimulation();
    await resetMicroLesson();
    await renderSamrLevel(document.querySelector('.samr-tabs button[aria-selected="true"]')?.dataset.level || "s");
    languageStatus.textContent = profile.ready;
  } catch (error) {
    console.error(error);
    restoreEnglishPage();
    currentLanguage = "en";
    languageSelect.value = "en";
    document.documentElement.lang = "en";
    languageStatus.textContent = profile.error;
  } finally {
    if (token === languageChangeToken) document.body.classList.remove("is-translating");
  }
}

const particlePositions = [
  [8, 12], [21, 28], [38, 14], [54, 31], [72, 12], [88, 27],
  [12, 52], [29, 68], [45, 49], [63, 70], [80, 52], [92, 73],
  [8, 87], [37, 88], [68, 89], [86, 91]
];

function createParticles() {
  particlePositions.forEach(([x, y], index) => {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.top = `${y}%`;
    particle.style.animationDelay = `${(index % 5) * -0.38}s`;
    particle.dataset.baseX = x;
    particleLayer.appendChild(particle);
  });
}

function pressureFor(volume) {
  return 100 / volume;
}

function describeState(volume, pressure) {
  let state = "most of the container";
  let collision = "occasionally";
  if (volume <= 35) {
    state = "a small, highly compressed part of the container";
    collision = "much more frequently";
  } else if (volume <= 60) {
    state = "about half of the container";
    collision = "more frequently";
  } else if (volume < 95) {
    state = "a reduced portion of the container";
    collision = "somewhat more frequently";
  }
  return `The gas occupies ${state}. At ${volume} volume units, pressure is ${pressure.toFixed(2)} atmospheres. As space decreases, particles collide with the walls ${collision}.`;
}

function updateSimulation() {
  const volume = Number(slider.value);
  const pressure = pressureFor(volume);
  const width = `${volume}%`;

  chamber.style.setProperty("--gas-width", width);
  volumeOutput.textContent = volume;
  volumeReadout.textContent = `${volume} units`;
  pressureReadout.textContent = `${pressure.toFixed(2)} atm`;
  gaugeValue.textContent = pressure.toFixed(2);
  constantReadout.textContent = Math.round(pressure * volume);
  const englishDescription = describeState(volume, pressure);
  const requestedLanguage = currentLanguage;
  if (requestedLanguage === "en") description.textContent = englishDescription;
  else requestTranslation(englishDescription, requestedLanguage).then(value => {
    if (currentLanguage === requestedLanguage && Number(slider.value) === volume) description.textContent = value;
  }).catch(() => { description.textContent = englishDescription; });

  particleLayer.querySelectorAll(".particle").forEach((particle) => {
    const baseX = Number(particle.dataset.baseX);
    const adjustedX = Math.max(2, Math.min(volume - 5, (baseX / 100) * volume));
    particle.style.left = `${adjustedX}%`;
    particle.style.animationDuration = `${Math.max(0.65, 2.9 - pressure * 0.45)}s`;
  });
}

createParticles();
updateSimulation();
slider.addEventListener("input", updateSimulation);

motionToggle.addEventListener("click", async () => {
  const paused = particleLayer.classList.toggle("paused");
  motionToggle.setAttribute("aria-pressed", String(paused));
  motionToggle.textContent = await localized(paused ? "Resume particle motion" : "Pause particle motion");
});

speakButton.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    description.textContent += " Speech is not supported in this browser.";
    return;
  }
  speakLocalized(description.textContent);
});

menuButton.addEventListener("click", () => {
  const open = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

navigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

textSizeToggle.addEventListener("click", async () => {
  const active = document.body.classList.toggle("large-text");
  textSizeToggle.setAttribute("aria-pressed", String(active));
  textSizeToggle.textContent = await localized(active ? "Standard text" : "Larger text");
});

contrastToggle.addEventListener("click", async () => {
  const active = document.body.classList.toggle("high-contrast");
  contrastToggle.setAttribute("aria-pressed", String(active));
  contrastToggle.textContent = await localized(active ? "Standard contrast" : "High contrast");
});

languageSelect.addEventListener("change", () => changePageLanguage(languageSelect.value));

const microStage = document.querySelector("#micro-stage");
const microCaption = document.querySelector("#micro-caption");
const microPressure = document.querySelector("#micro-pressure");
const microPlay = document.querySelector("#micro-play");
const microNarration = document.querySelector("#micro-narration");
const microRestart = document.querySelector("#micro-restart");
let microTimers = [];
let narrationOn = false;
const microScenes = [
  {time:0, compress:false, text:"A gas contains particles moving in every direction."},
  {time:3500, compress:true, text:"When the same gas is pushed into a smaller volume, the particles have less space."},
  {time:7000, compress:true, text:"They collide with the container walls more frequently, so pressure increases."},
  {time:10500, compress:true, text:"At constant temperature, pressure and volume have an inverse relationship. This is Boyle's law."}
];

function clearMicroLesson() {
  microTimers.forEach(window.clearTimeout);
  microTimers = [];
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
async function showMicroScene(scene) {
  microStage.classList.toggle("compress", scene.compress);
  const requestedLanguage = currentLanguage;
  let sceneText = scene.text;
  let pressureText = scene.compress ? "High" : "Low";
  if (requestedLanguage !== "en") {
    [sceneText, pressureText] = await Promise.all([
      requestTranslation(scene.text, requestedLanguage),
      requestTranslation(pressureText, requestedLanguage)
    ]);
  }
  if (requestedLanguage !== currentLanguage) return;
  microCaption.textContent = sceneText;
  microPressure.textContent = pressureText;
  if (narrationOn) speakLocalized(sceneText);
}
function playMicroLesson() {
  clearMicroLesson();
  microScenes.forEach(scene => microTimers.push(window.setTimeout(() => showMicroScene(scene), scene.time)));
}
microPlay.addEventListener("click", playMicroLesson);
async function resetMicroLesson() {
  clearMicroLesson();
  microStage.classList.remove("compress");
  let caption = "Press Play to begin the captioned explanation.";
  let pressure = "Low";
  if (currentLanguage !== "en") [caption, pressure] = await Promise.all([requestTranslation(caption, currentLanguage), requestTranslation(pressure, currentLanguage)]);
  microCaption.textContent = caption;
  microPressure.textContent = pressure;
}
microRestart.addEventListener("click", resetMicroLesson);
microNarration.addEventListener("click", async () => {
  narrationOn = !narrationOn;
  microNarration.setAttribute("aria-pressed", String(narrationOn));
  let label = narrationOn ? "Narration on" : "Narration off";
  if (currentLanguage !== "en") label = await requestTranslation(label, currentLanguage);
  microNarration.textContent = label;
});

const samrData = {
  s:{badge:"S",title:"Substitution",task:"Students type answers into a digital worksheet instead of writing on paper.",contribution:"Direct tool replacement with no major functional change.",caution:"This can still be appropriate when it improves access or logistics; it is not automatically poor teaching."},
  a:{badge:"A",title:"Augmentation",task:"Students enter pressure and volume values and receive automatic calculation checks and audio directions.",contribution:"The basic task remains, but functional improvements support accuracy and access.",caution:"Added features should address a learner need rather than create distraction."},
  m:{badge:"M",title:"Modification",task:"Students manipulate volume, observe particle behavior, collect live data, graph the relationship, and revise an explanation.",contribution:"Technology enables a significant redesign of investigation and feedback.",caution:"The redesign must keep Boyle's law—not operating the tool—as the learning focus."},
  r:{badge:"R",title:"Redefinition",task:"Students create accessible multimedia explanations, exchange them with another class, and revise using authentic peer questions.",contribution:"Technology enables audience, formats, and collaboration that would otherwise be difficult.",caution:"Redefinition is not automatically superior; use it only when the authentic audience advances the learning goal."}
};
async function renderSamrLevel(level) {
  const d = samrData[level];
  let values = [d.title, d.task, d.contribution, d.caution];
  if (currentLanguage !== "en") values = await translateInBatches(values, currentLanguage);
  document.querySelector("#samr-badge").textContent = d.badge;
  document.querySelector("#samr-level-title").textContent = values[0];
  document.querySelector("#samr-task").textContent = values[1];
  document.querySelector("#samr-contribution").textContent = values[2];
  document.querySelector("#samr-caution").textContent = values[3];
}
document.querySelectorAll(".samr-tabs button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".samr-tabs button").forEach(b=>b.setAttribute("aria-selected","false"));
  button.setAttribute("aria-selected","true");
  renderSamrLevel(button.dataset.level);
}));

document.querySelectorAll(".response-tabs button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".response-tabs button").forEach(b=>b.setAttribute("aria-selected","false"));
  button.setAttribute("aria-selected","true");
  document.querySelectorAll(".response-panel").forEach(panel=>{ const active=panel.dataset.panel===button.dataset.response; panel.hidden=!active; panel.classList.toggle("active",active); });
}));

document.querySelector("#download-writing").addEventListener("click", () => {
  const text=document.querySelector("#written-response").value.trim();
  if(!text){ document.querySelector("#written-response").focus(); return; }
  const blob=new Blob([`Boyle's Law Explanation\n\n${text}`],{type:"text/plain"});
  const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download="boyles-law-explanation.txt"; link.click(); URL.revokeObjectURL(link.href);
});

document.querySelector("#check-visual").addEventListener("click", async () => {
  const large=document.querySelector("#large-volume-choice").value;
  const small=document.querySelector("#small-volume-choice").value;
  const reason=document.querySelector("#visual-reason").value.trim();
  const correct=large==="Lower pressure" && small==="Higher pressure";
  const message = correct && reason ? "Your relationship is correct. Check that your explanation mentions more frequent wall collisions in the smaller volume." : "Revisit the simulation: larger volume corresponds to lower pressure, while smaller volume corresponds to higher pressure. Add a collision explanation.";
  document.querySelector("#visual-feedback").textContent = await localized(message);
});

let mediaRecorder;
let recordedChunks=[];
const recordStart=document.querySelector("#record-start"), recordStop=document.querySelector("#record-stop"), recordStatus=document.querySelector("#record-status"), recordPlayback=document.querySelector("#record-playback"), recordDownload=document.querySelector("#record-download");
recordStart.addEventListener("click", async () => {
  if(!navigator.mediaDevices || !window.MediaRecorder){ recordStatus.textContent=await localized("Audio recording is not supported in this browser. Use the written or visual option."); return; }
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:true}); recordedChunks=[]; mediaRecorder=new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable",e=>{if(e.data.size) recordedChunks.push(e.data)});
    mediaRecorder.addEventListener("stop",async()=>{ const blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType}); const url=URL.createObjectURL(blob); recordPlayback.src=url; recordPlayback.hidden=false; recordDownload.href=url; recordDownload.download="boyles-law-audio-response.webm"; recordDownload.hidden=false; stream.getTracks().forEach(t=>t.stop()); recordStatus.textContent=await localized("Recording complete. Listen or download your response."); });
    mediaRecorder.start(); recordStart.disabled=true; recordStop.disabled=false; recordStatus.textContent=await localized("Recording… Explain the relationship using evidence.");
  } catch { recordStatus.textContent=await localized("Microphone access was not granted. Choose the written or visual response instead."); }
});
recordStop.addEventListener("click",()=>{ if(mediaRecorder && mediaRecorder.state==="recording") mediaRecorder.stop(); recordStart.disabled=false; recordStop.disabled=true; });

const quiz = document.querySelector("#framework-quiz");
const quizSummary = document.querySelector("#quiz-summary");
const explanations = {
  udl: "UDL is the strongest lens because the alternatives reduce barriers to perceiving and participating in the learning experience.",
  tpack: "TPACK is the strongest lens because the decision examines the fit among science content, inquiry pedagogy, and the technology's affordances.",
  samr: "SAMR is the strongest lens because the comparison focuses on how technology changes the structure of the original learning task."
};

quiz.addEventListener("submit", async (event) => {
  event.preventDefault();
  let correct = 0;
  let answered = 0;

  for (const card of quiz.querySelectorAll(".quiz-card")) {
    const selected = card.querySelector("input:checked");
    const feedback = card.querySelector(".feedback");
    const answer = card.dataset.answer;
    card.classList.remove("correct", "incorrect");

    if (!selected) {
      feedback.textContent = await localized("Choose an answer before checking.");
      return;
    }

    answered += 1;
    if (selected.value === answer) {
      correct += 1;
      card.classList.add("correct");
      feedback.textContent = await localized(`Correct. ${explanations[answer]}`);
    } else {
      card.classList.add("incorrect");
      feedback.textContent = await localized(`Consider ${answer.toUpperCase()}. ${explanations[answer]}`);
    }
  }

  const summary = answered < 3
    ? `You answered ${answered} of 3 questions. Complete the remaining question${answered === 2 ? "" : "s"}.`
    : `You identified ${correct} of 3 strongest starting lenses. Review the explanations and try again if needed.`;
  quizSummary.textContent = await localized(summary);
});

quiz.addEventListener("reset", () => {
  window.setTimeout(() => {
    quiz.querySelectorAll(".quiz-card").forEach((card) => {
      card.classList.remove("correct", "incorrect");
      card.querySelector(".feedback").textContent = "";
    });
    quizSummary.textContent = "";
  }, 0);
});

pageItems = capturePageLanguageItems();
const savedLanguage = localStorage.getItem("opsam-language");
if (savedLanguage && languageProfiles[savedLanguage]) {
  languageSelect.value = savedLanguage;
  if (savedLanguage !== "en") changePageLanguage(savedLanguage);
}
