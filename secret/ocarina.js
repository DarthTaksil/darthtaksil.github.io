const notesContainer = document.getElementById('notes');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let currentInstrument = 'ocarina';

// Staff Lines alignment and Note Overlay
const noteData = {
    "A":  { filename: "d.wav",  position: "0%"    },
    "▼":  { filename: "f.wav",  position: "12%"   },
    "▶":  { filename: "a.wav",  position: "37%"   },
    "◀":  { filename: "b.wav",  position: "50%"   },
    "▲":  { filename: "d2.wav", position: "75%"  }
};

const audioBuffers = {};
const bindings = {};
let activeBindingNote = null;
let currentSource = null;
let currentGain = null;
const previousButtonStates = {};

async function loadAudioBuffers() {
    const promises = Object.entries(noteData).map(async ([key, { filename }]) => {
    const response = await fetch(`/audio/${currentInstrument}/${filename}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioBuffers[key] = audioBuffer;
    });
    await Promise.all(promises);
}

function playNoteWebAudio(noteKey) {
    if (!audioBuffers[noteKey]) {
    console.warn(`Audio buffer for ${noteKey} not loaded`);
    return;
    }

    const now = audioCtx.currentTime;
    const fadeInTime = 0.13;
    const fadeOutTime = 0.05;

    if (currentSource && currentGain) {
    currentGain.gain.cancelScheduledValues(now);
    currentGain.gain.setValueAtTime(currentGain.gain.value, now);
    currentGain.gain.linearRampToValueAtTime(0, now + fadeOutTime);
    currentSource.stop(now + fadeOutTime + 0.35);
    }

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffers[noteKey];

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + fadeInTime);

    source.connect(gainNode).connect(audioCtx.destination);
    source.start(now, 0.01);

    source.onended = () => {
    source.disconnect();
    gainNode.disconnect();
    if (currentSource === source) {
        currentSource = null;
        currentGain = null;
    }
    };

    currentSource = source;
    currentGain = gainNode;
}

function showNote(noteKey) {
    const { position } = noteData[noteKey];
    const noteEl = document.createElement('div');
    noteEl.classList.add('note');
    noteEl.style.bottom = position;
    noteEl.textContent = noteKey;

    if (noteKey === 'A') {
    noteEl.classList.add('note-a');
    } else {
    noteEl.classList.add('note-c');
    }

    notesContainer.appendChild(noteEl);
    setTimeout(() => noteEl.remove(), 3000);
}

function pollGamepads() {
    const gamepads = navigator.getGamepads();
    for (let padIndex = 0; padIndex < gamepads.length; padIndex++) {
    const pad = gamepads[padIndex];
    if (!pad) continue;

    previousButtonStates[padIndex] = previousButtonStates[padIndex] || [];

    pad.buttons.forEach(async (button, index) => {
        const wasPressed = previousButtonStates[padIndex][index] || false;
        const isPressed = button.pressed;

        if (!wasPressed && isPressed) {
        if (activeBindingNote !== null) {
            bindings[index] = activeBindingNote;
            const box = document.querySelector(`.binding-box[data-note="${activeBindingNote}"]`);
            if (box) {
            box.classList.remove('active');
            box.querySelector('span').innerText = `Bound to button ${index}`;
            }
            activeBindingNote = null;
        } else if (bindings[index]) {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            playNoteWebAudio(bindings[index]);
            showNote(bindings[index]);

            // Flash the corresponding onscreen button
            const btn = document.querySelector(`.btn[data-note="${bindings[index]}"]`);
                if (btn) {
                btn.classList.add('active');
                    if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                    }
                setTimeout(() => btn.classList.remove('active'), 150);
                }
        }
        }

        previousButtonStates[padIndex][index] = isPressed;
    });
    }
    requestAnimationFrame(pollGamepads);
}

window.addEventListener('gamepadconnected', () => {
    console.log('Gamepad connected');
    pollGamepads();
});

document.querySelectorAll('.binding-box').forEach(box => {
    box.addEventListener('click', () => {
    document.querySelectorAll('.binding-box').forEach(b => b.classList.remove('active'));
    activeBindingNote = box.getAttribute('data-note');
    box.classList.add('active');
    box.querySelector('span').innerText = "Press a controller button...";
    });
});

document.getElementById('instrument-selector').addEventListener('change', async (e) => {
    currentInstrument = e.target.value;
    await loadAudioBuffers();
    console.log(`Switched to ${currentInstrument}`);
});

loadAudioBuffers().then(() => {
    document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', () => {
        const noteKey = button.getAttribute('data-note');

        if (audioCtx.state === 'suspended') {
            audioCtx.resume(); // <== ADD THIS
        }

        playNoteWebAudio(noteKey);
        showNote(noteKey);

        button.classList.add('active');
        setTimeout(() => button.classList.remove('active'), 150);
        });
    });
});