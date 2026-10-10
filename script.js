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
  description.textContent = describeState(volume, pressure);

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

motionToggle.addEventListener("click", () => {
  const paused = particleLayer.classList.toggle("paused");
  motionToggle.setAttribute("aria-pressed", String(paused));
  motionToggle.textContent = paused ? "Resume particle motion" : "Pause particle motion";
});

speakButton.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    description.textContent += " Speech is not supported in this browser.";
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(description.textContent);
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
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

textSizeToggle.addEventListener("click", () => {
  const active = document.body.classList.toggle("large-text");
  textSizeToggle.setAttribute("aria-pressed", String(active));
  textSizeToggle.textContent = active ? "Standard text" : "Larger text";
});

contrastToggle.addEventListener("click", () => {
  const active = document.body.classList.toggle("high-contrast");
  contrastToggle.setAttribute("aria-pressed", String(active));
  contrastToggle.textContent = active ? "Standard contrast" : "High contrast";
});

const translations = {
  en: { predict:"Predict · Test · Explain", notice:"What do you notice?", play:"Play", pressure:"Pressure", low:"Low", high:"High", lang:"English" },
  es: { predict:"Predice · Prueba · Explica", notice:"¿Qué observas?", play:"Reproducir", pressure:"Presión", low:"Baja", high:"Alta", lang:"Español" },
  fr: { predict:"Prédire · Tester · Expliquer", notice:"Que remarquez-vous ?", play:"Lire", pressure:"Pression", low:"Faible", high:"Élevée", lang:"Français" },
  yo: { predict:"Sọtẹ́lẹ̀ · Dánwò · Ṣàlàyé", notice:"Kí ni o ṣàkíyèsí?", play:"Bẹ̀rẹ̀", pressure:"Ìfúnpá", low:"Kéré", high:"Púpọ̀", lang:"Yorùbá" }
};

languageSelect.addEventListener("change", () => {
  const t = translations[languageSelect.value];
  document.documentElement.lang = languageSelect.value;
  document.querySelector(".inquiry-panel .eyebrow").textContent = t.predict;
  document.querySelector("#inquiry-title").textContent = t.notice;
  document.querySelector("#micro-play").textContent = t.play;
  document.querySelector(".micro-meter span").textContent = t.pressure;
  const isHigh = document.querySelector("#micro-stage").classList.contains("compress");
  document.querySelector("#micro-pressure").textContent = isHigh ? t.high : t.low;
});

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
function showMicroScene(scene) {
  microStage.classList.toggle("compress", scene.compress);
  microCaption.textContent = scene.text;
  const t = translations[languageSelect.value];
  microPressure.textContent = scene.compress ? t.high : t.low;
  if (narrationOn && "speechSynthesis" in window) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(scene.text));
  }
}
function playMicroLesson() {
  clearMicroLesson();
  microScenes.forEach(scene => microTimers.push(window.setTimeout(() => showMicroScene(scene), scene.time)));
}
microPlay.addEventListener("click", playMicroLesson);
microRestart.addEventListener("click", () => { clearMicroLesson(); microStage.classList.remove("compress"); microCaption.textContent="Press Play to begin the captioned explanation."; microPressure.textContent=translations[languageSelect.value].low; });
microNarration.addEventListener("click", () => { narrationOn=!narrationOn; microNarration.setAttribute("aria-pressed",String(narrationOn)); microNarration.textContent=narrationOn?"Narration on":"Narration off"; });

const samrData = {
  s:{badge:"S",title:"Substitution",task:"Students type answers into a digital worksheet instead of writing on paper.",contribution:"Direct tool replacement with no major functional change.",caution:"This can still be appropriate when it improves access or logistics; it is not automatically poor teaching."},
  a:{badge:"A",title:"Augmentation",task:"Students enter pressure and volume values and receive automatic calculation checks and audio directions.",contribution:"The basic task remains, but functional improvements support accuracy and access.",caution:"Added features should address a learner need rather than create distraction."},
  m:{badge:"M",title:"Modification",task:"Students manipulate volume, observe particle behavior, collect live data, graph the relationship, and revise an explanation.",contribution:"Technology enables a significant redesign of investigation and feedback.",caution:"The redesign must keep Boyle's law—not operating the tool—as the learning focus."},
  r:{badge:"R",title:"Redefinition",task:"Students create accessible multimedia explanations, exchange them with another class, and revise using authentic peer questions.",contribution:"Technology enables audience, formats, and collaboration that would otherwise be difficult.",caution:"Redefinition is not automatically superior; use it only when the authentic audience advances the learning goal."}
};
document.querySelectorAll(".samr-tabs button").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".samr-tabs button").forEach(b=>b.setAttribute("aria-selected","false"));
  button.setAttribute("aria-selected","true");
  const d=samrData[button.dataset.level];
  document.querySelector("#samr-badge").textContent=d.badge;
  document.querySelector("#samr-level-title").textContent=d.title;
  document.querySelector("#samr-task").textContent=d.task;
  document.querySelector("#samr-contribution").textContent=d.contribution;
  document.querySelector("#samr-caution").textContent=d.caution;
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

document.querySelector("#check-visual").addEventListener("click", () => {
  const large=document.querySelector("#large-volume-choice").value;
  const small=document.querySelector("#small-volume-choice").value;
  const reason=document.querySelector("#visual-reason").value.trim();
  const correct=large==="Lower pressure" && small==="Higher pressure";
  document.querySelector("#visual-feedback").textContent = correct && reason ? "Your relationship is correct. Check that your explanation mentions more frequent wall collisions in the smaller volume." : "Revisit the simulation: larger volume corresponds to lower pressure, while smaller volume corresponds to higher pressure. Add a collision explanation.";
});

let mediaRecorder;
let recordedChunks=[];
const recordStart=document.querySelector("#record-start"), recordStop=document.querySelector("#record-stop"), recordStatus=document.querySelector("#record-status"), recordPlayback=document.querySelector("#record-playback"), recordDownload=document.querySelector("#record-download");
recordStart.addEventListener("click", async () => {
  if(!navigator.mediaDevices || !window.MediaRecorder){ recordStatus.textContent="Audio recording is not supported in this browser. Use the written or visual option."; return; }
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:true}); recordedChunks=[]; mediaRecorder=new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable",e=>{if(e.data.size) recordedChunks.push(e.data)});
    mediaRecorder.addEventListener("stop",()=>{ const blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType}); const url=URL.createObjectURL(blob); recordPlayback.src=url; recordPlayback.hidden=false; recordDownload.href=url; recordDownload.download="boyles-law-audio-response.webm"; recordDownload.hidden=false; stream.getTracks().forEach(t=>t.stop()); recordStatus.textContent="Recording complete. Listen or download your response."; });
    mediaRecorder.start(); recordStart.disabled=true; recordStop.disabled=false; recordStatus.textContent="Recording… Explain the relationship using evidence.";
  } catch { recordStatus.textContent="Microphone access was not granted. Choose the written or visual response instead."; }
});
recordStop.addEventListener("click",()=>{ if(mediaRecorder && mediaRecorder.state==="recording") mediaRecorder.stop(); recordStart.disabled=false; recordStop.disabled=true; });

const quiz = document.querySelector("#framework-quiz");
const quizSummary = document.querySelector("#quiz-summary");
const explanations = {
  udl: "UDL is the strongest lens because the alternatives reduce barriers to perceiving and participating in the learning experience.",
  tpack: "TPACK is the strongest lens because the decision examines the fit among science content, inquiry pedagogy, and the technology's affordances.",
  samr: "SAMR is the strongest lens because the comparison focuses on how technology changes the structure of the original learning task."
};

quiz.addEventListener("submit", (event) => {
  event.preventDefault();
  let correct = 0;
  let answered = 0;

  quiz.querySelectorAll(".quiz-card").forEach((card) => {
    const selected = card.querySelector("input:checked");
    const feedback = card.querySelector(".feedback");
    const answer = card.dataset.answer;
    card.classList.remove("correct", "incorrect");

    if (!selected) {
      feedback.textContent = "Choose an answer before checking.";
      return;
    }

    answered += 1;
    if (selected.value === answer) {
      correct += 1;
      card.classList.add("correct");
      feedback.textContent = `Correct. ${explanations[answer]}`;
    } else {
      card.classList.add("incorrect");
      feedback.textContent = `Consider ${answer.toUpperCase()}. ${explanations[answer]}`;
    }
  });

  quizSummary.textContent = answered < 3
    ? `You answered ${answered} of 3 questions. Complete the remaining question${answered === 2 ? "" : "s"}.`
    : `You identified ${correct} of 3 strongest starting lenses. Review the explanations and try again if needed.`;
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
