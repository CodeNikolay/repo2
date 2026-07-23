let sessionId = null;
let stepCount = 0;
let running = false;
let playTimer = null;
let size = 80;

const p_slider = document.getElementById("p-slider")
const f_slider = document.getElementById("f-slider")
const grid_slider = document.getElementById("grid-slider");
const fps_slider = document.getElementById("fps-slider")

async function createSession(grid_size = grid_slider.value, p = p_slider.value, f = f_slider.value, seed = null){
    const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: grid_size, p, f, seed })
    });
    const data = await res.json();
    sessionId = data.session_id;
    stepCount = 0;
    size = data.size;
    drawGrid(data.grid);
    document.getElementById("step-count").textContent = stepCount;
    document.getElementById("density-out").textContent = Math.round(data.density * 100) + "%";
}

async function step() {
    const res = await fetch(`/api/session/${sessionId}/step`, {method: "POST"});
    const data = await res.json();
    stepCount++;
    drawGrid(data.grid);
    document.getElementById("step-count").textContent = stepCount;
    document.getElementById("density-out").textContent = Math.round(data.density * 100) + "%";
}

async function drawGrid(flatGrid) {
    const canvas = document.getElementById("grid-canvas");
    const ctx = canvas.getContext("2d");
    const cell = canvas.width / size;
    const colors = { 0: "#3d2b1f", 1: "#2d5a27", 2: "#e25822" };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            ctx.fillStyle = colors[flatGrid[y * size + x]];
            ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
        }
    }
}

async function changeParameters(p = p_slider.value, f = f_slider.value) {
    const res = await fetch(`/api/session/${sessionId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p, f })
    });
}

function setRunning(r) {
  running = r;
  document.getElementById("btn-play").textContent = running ? "Pause" : "Play";
}

function restartTimer() {
    if (playTimer) clearInterval(playTimer);
    if (running) playTimer = setInterval(step, 1000 / fps_slider.value);
}

document.getElementById("btn-step").onclick = () => { setRunning(false); step(); };
document.getElementById("btn-play").onclick = () => { setRunning(!running); restartTimer(); };
document.getElementById("btn-reset").onclick = () => { setRunning(false); restartTimer(); createSession(); };

p_slider.addEventListener("input", (e) => {
    changeParameters();
    document.getElementById("p-out").textContent = e.target.value;
});
f_slider.addEventListener("input", (e) => {
    changeParameters();
    document.getElementById("f-out").textContent = e.target.value;
});
grid_slider.addEventListener("input", (e) => {
    setRunning(false); restartTimer(); createSession();
    document.getElementById("size").textContent = e.target.value;
});
fps_slider.addEventListener("input", (e) => {
    restartTimer();
    document.getElementById("fps").textContent = e.target.value;
});

createSession();