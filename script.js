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
