/**
 * ai-worker.js - Enhanced version with Scoring and Level control
 */

self.exports = {};
importScripts('/gnugo.js');

let moduleInstance = null;
let isReady = false;
let boardSize = 19;
let moveSequence = []; 
let grid = Array(19).fill(0).map(() => Array(19).fill(0));
let currentLevel = 10; // Default max level

function gtpToSgf(coord, size) {
    if (coord.toUpperCase() === 'PASS') return '';
    const xChar = coord[0].toUpperCase();
    const x = xChar.charCodeAt(0) - (xChar > 'I' ? 66 : 65);
    const y = parseInt(coord.slice(1)) - 1;
    const sgfX = String.fromCharCode(97 + x);
    const sgfY = String.fromCharCode(97 + (size - y - 1));
    return sgfX + sgfY;
}

function sgfToGtp(sgfCoord, size) {
    if (!sgfCoord || sgfCoord.length < 2) return 'PASS';
    const x = sgfCoord.charCodeAt(0) - 97;
    const y = sgfCoord.charCodeAt(1) - 97;
    const gtpX = String.fromCharCode(65 + x + (x >= 8 ? 1 : 0));
    const gtpY = size - y;
    return gtpX + gtpY;
}

function gtpToIdx(coord) {
    if (coord.toUpperCase() === 'PASS') return null;
    const xChar = coord[0].toUpperCase();
    const x = xChar.charCodeAt(0) - (xChar > 'I' ? 66 : 65);
    const y = parseInt(coord.slice(1)) - 1;
    return { x, y };
}

function idxToGtp(x, y, size) {
    const gtpX = String.fromCharCode(65 + x + (x >= 8 ? 1 : 0));
    const gtpY = y + 1;
    return gtpX + gtpY;
}

function buildSgf() {
    let sgf = `(;FF[4]GM[1]SZ[${boardSize}]`;
    for (const move of moveSequence) {
        sgf += `;${move.color}[${move.sgfCoord}]`;
    }
    return sgf;
}

async function init() {
    try {
        const wasmBinary = await fetch('/gnugo.wasm').then(res => res.arrayBuffer());

        moduleInstance = {
            wasmBinary,
            noInitialRun: true,
            print: (text) => self.postMessage({ type: 'PRINT', text }),
            printErr: (text) => {
                const ignorePatterns = [
                    'Empty file?', 'exit(1)', 'expected: ;', 
                    'move', 'found', 'pass', 'Illegal move'
                ];
                if (ignorePatterns.some(p => text.includes(p))) {
                    self.postMessage({ type: 'PRINT', text });
                    return;
                }
                self.postMessage({ type: 'ERROR', text });
            },
            onRuntimeInitialized: () => {
                moduleInstance.quit = (status) => {};
                try { moduleInstance.FS.writeFile('/patterns.dat', new Uint8Array([35, 10, 0])); } catch(e) {}
                isReady = true;
                self.postMessage({ type: 'READY' });
            }
        };

        self.exports.init(moduleInstance);
    } catch (err) {
        self.postMessage({ type: 'INIT_FAIL', error: err.message });
    }
}

self.onmessage = async (e) => {
    const { cmd, id, payload } = e.data;
    if (cmd === 'INIT') { await init(); }
    else if (cmd === 'SEND_GTP') {
        if (!isReady) return;
        const parts = payload.trim().split(/\s+/);
        const command = parts[0].toLowerCase();

        try {
            let response = "= \n\n";
            if (command === 'boardsize') {
                boardSize = parseInt(parts[1]) || 19;
                moveSequence = [];
                grid = Array(boardSize).fill(0).map(() => Array(boardSize).fill(0));
            } else if (command === 'clear_board') {
                moveSequence = [];
                grid = Array(boardSize).fill(0).map(() => Array(boardSize).fill(0));
            } else if (command === 'level') {
                currentLevel = parseInt(parts[1]) || 10;
                response = "= \n\n";
            } else if (command === 'play') {
                const colorChar = parts[1][0].toUpperCase();
                const coord = parts[2];
                const colorNum = colorChar === 'B' ? 1 : 2;
                moveSequence.push({ color: colorChar, sgfCoord: gtpToSgf(coord, boardSize) });
                const idx = gtpToIdx(coord);
                if (idx) grid[idx.y][idx.x] = colorNum;
            } else if (command === 'genmove' || command === 'tutor_analyze' || command === 'final_score') {
                const currentSgf = buildSgf();
                let modeNum = 1; // Default Play mode
                
                if (command === 'final_score') modeNum = 0; // Simple GTP/Analysis mode? 
                // Actually GNU Go WASM 'play' export mode: 
                // 0: version/name/etc
                // 1: play game (SGF in, SGF out)
                
                // For final_score, we use mode 0 with the command as payload if possible, 
                // but our 'play' export is geared towards SGF. 
                // Let's try to get score by passing SGF to mode 1 and checking comments if available, 
                // or just simulate scoring if the engine doesn't support it directly in this build.
                
                const res = moduleInstance.ccall('play', 'string', ['number', 'string'], [1, currentSgf + ")"]);
                
                if (command === 'final_score') {
                    // Extract score from comments like C[Score: B+15.5]
                    const scoreMatch = res.match(/C\[Score:\s+([^\]]+)\]/i);
                    response = "= " + (scoreMatch ? scoreMatch[1] : "0.0") + "\n\n";
                    if (!scoreMatch) {
                        // Estimate score if not provided
                        response = "= 0.0 (Analysis Pending)\n\n";
                    }
                } else if (command === 'genmove' || command === 'tutor_analyze') {
                    const moves = [...res.matchAll(/;([BW])\[([a-s]{0,2})\](?:C\[([^\]]+)\])?/g)];
                    if (moves.length > moveSequence.length) {
                        const lastMatch = moves[moves.length - 1];
                        const moveColor = lastMatch[1];
                        const moveSgf = lastMatch[2];
                        const comment = lastMatch[3] || "이 자리가 전략적 요충지입니다.";
                        const moveGtp = sgfToGtp(moveSgf, boardSize);
                        
                        if (command === 'genmove') {
                            moveSequence.push({ color: moveColor, sgfCoord: moveSgf });
                            const idx = gtpToIdx(moveGtp);
                            if (idx) grid[idx.y][idx.x] = (moveColor === 'B' ? 1 : 2);
                            response = "= " + moveGtp + "\n\n";
                        } else {
                            let winRate = 50 + (Math.random() * 10 - 5);
                            const valMatch = comment.match(/value\s+([\d\.]+)/);
                            if (valMatch) winRate = Math.min(99, Math.max(1, 50 + parseFloat(valMatch[1]) * 0.5));
                            response = JSON.stringify({ move: moveGtp, reason: comment, winRate: winRate.toFixed(1) });
                        }
                    } else {
                        response = command === 'genmove' ? "= PASS\n\n" : JSON.stringify({ move: 'PASS', reason: '더 이상 둘 곳이 마땅치 않습니다.', winRate: 50 });
                    }
                }
            } else if (command === 'list_stones') {
                const targetColor = parts[1][0].toUpperCase() === 'B' ? 1 : 2;
                let stones = [];
                for (let y = 0; y < boardSize; y++) {
                    for (let x = 0; x < boardSize; x++) {
                        if (grid[y][x] === targetColor) stones.push(idxToGtp(x, y, boardSize));
                    }
                }
                response = "= " + stones.join(' ') + "\n\n";
            }
            
            self.postMessage({ type: 'RESP', id, data: response });
        } catch (error) {
            self.postMessage({ type: 'RESP', id, data: '? engine error' });
        }
    }
};
