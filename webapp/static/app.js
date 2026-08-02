let sessionId = null;
let stepCount = 0;
let running = false;
let playTimer = null;
let size = 80;
let stepInProgress = false;

const p_slider = document.getElementById("p-slider")
const f_slider = document.getElementById("f-slider")
const grid_slider = document.getElementById("grid-slider");
const fps_slider = document.getElementById("fps-slider")
const animation_toggle = document.getElementById("animation-toggle");
const seed_input = document.getElementById("seed-input");
const offscreen = document.createElement("canvas");
const offCtx = offscreen.getContext("2d");
const colors = { 0: "#000000", 1: "#023020", 2: "#ffe135" };

// hex values matching styles.css theme (Chart.js canvas can't resolve CSS vars)
const CHART_BORDER = "#30363d";
const CHART_TEXT_MUTED = "#8b949e";
const CHART_ACCENT = "#58a6ff";
let fireChart = null;

async function createSession(grid_size = grid_slider.value, p = p_slider.value, f = f_slider.value, seed = seed_input.value){
    stepInProgress = false;
    document.getElementById("btn-step").disabled = false;
    if (seed === "") { seed = null; }

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
    updateStats(data);
}

async function step() {
    if (stepInProgress) return;
    stepInProgress = true;
    document.getElementById("btn-step").disabled = true;

    const res = await fetch(`/api/session/${sessionId}/step`, {method: "POST"});
    const data = await res.json();
    stepCount++;

    let preGrid = data.grid.slice();
    if (animation_toggle.checked) {
        const newlyBurned = new Set();
        for (let i = 0; i < data.grid.length; i++) {
            if (data.grid[i] === 2) newlyBurned.add(i);
            if (preGrid[i] === 2) preGrid[i] = 1;
        }
        if (newlyBurned.size === 0) {
        drawGrid(data.grid); // nothing burned — draw instantly, no animation delay
        } else {
            let struckCoords = data.last_struck.map(([y, x]) => ({x, y}));
            let rings = computeFireRings(newlyBurned, struckCoords, size);
            await animateFire(rings, preGrid);
        }
    } else {
        drawGrid(data.grid);
    }

    updateStats(data);

    stepInProgress = false;
    document.getElementById("btn-step").disabled = false;
}

function computeFireRings(newlyBurned, struckCoords, size) {
    const depth = new Int32Array(size * size).fill(-1);
    let frontier = [];
    for (const {x, y} of struckCoords) {
        const idx = y * size + x;
        depth[idx] = 0;
        frontier.push(idx);
    }

    let ring = 0;
    const rings = [frontier.slice()]; // rings[0] = ignition points

    while (frontier.length) {
        const next = [];
        for (const idx of frontier) {
            const x = idx % size, y = (idx / size) | 0;
            const neighbors = [
                [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
            ];
            for (const [nx, ny] of neighbors) {
                if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
                const nIdx = ny * size + nx;
                if (depth[nIdx] !== -1) continue;
                if (!newlyBurned.has(nIdx)) continue; // only expand into cells that actually burned
                depth[nIdx] = ring + 1;
                next.push(nIdx);
            }
        }
        ring++;
        if (next.length) rings.push(next);
        frontier = next;
    }
    return rings; // rings[k] = array of flat indices that are k steps from ignition
}

const trailLength = 3; // "burning" for this many rings
function drawFireFrame(rings, currentRing, preGrid) {
    const frame = preGrid.slice();
    for (let r = Math.max(0, currentRing - trailLength); r <= currentRing; r++) {
        if (!rings[r]) continue;
        for (const idx of rings[r]) frame[idx] = 2; // BURNING
    }
    for (let r = 0; r < currentRing - trailLength; r++) {
        if (!rings[r]) continue;
        for (const idx of rings[r]) frame[idx] = 0; // EMPTY, already burned out
    }
    drawGrid(frame);
}

function animateFire(rings, preGrid, msPerRing = 30) {
    return new Promise((resolve) => {
        let r = 0;
        const totalRings = rings.length + trailLength;
        const timer = setInterval(() => {
            drawFireFrame(rings, r, preGrid);
            r++;
            if (r >= totalRings) {
                clearInterval(timer);
                resolve();
            }
        }, msPerRing);
    });
}

async function drawGrid(flatGrid) {
    const canvas = document.getElementById("grid-canvas");

    if (offscreen.width !== size || offscreen.height !== size) {
        offscreen.width = size;
        offscreen.height = size;
    }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            offCtx.fillStyle = colors[flatGrid[y * size + x]];
            offCtx.fillRect(x, y, 1, 1);
        }
    }

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

// shared by createSession() and step(): both need step-count, density, and
// the fire-size chart refreshed from the response payload
function updateStats(data) {
    document.getElementById("step-count").textContent = stepCount;
    document.getElementById("density-out").textContent = Math.round(data.density * 100) + "%";
    drawFireSizeChart(data.fire_sizes);
}

// fire_sizes: { "<size>": <count>, ... } cumulative dict from the backend.
// Renders/updates a log-log scatter of fire size (x) vs. frequency (y).
function drawFireSizeChart(fireSizes) {
    const points = Object.entries(fireSizes || {})
        .map(([s, c]) => ({ x: Number(s), y: Number(c) }))
        .filter(p => p.x > 0 && p.y > 0);

    if (fireChart) {
        fireChart.data.datasets[0].data = points;
        fireChart.update();
        return;
    }

    const ctx = document.getElementById("fire-size-canvas");
    fireChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [{
                label: "Fire sizes",
                data: points,
                backgroundColor: CHART_ACCENT,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "logarithmic",
                    title: { display: true, text: "Fire size (cells)", color: CHART_TEXT_MUTED },
                    ticks: { color: CHART_TEXT_MUTED },
                    grid: { color: CHART_BORDER }
                },
                y: {
                    type: "logarithmic",
                    title: { display: true, text: "Frequency", color: CHART_TEXT_MUTED },
                    ticks: { color: CHART_TEXT_MUTED },
                    grid: { color: CHART_BORDER }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
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
seed_input.addEventListener("input", () => {
    if (seed_input.value === "") return;
    setRunning(false);
    restartTimer();
    createSession();
});

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

function setupCanvasDPR() {
    const canvas = document.getElementById("grid-canvas");
    const dpr = window.devicePixelRatio || 1;
    const cssSize = 440; // matches your current width/height attrs
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
}

setupCanvasDPR();
createSession();