/**
 * AiEngine.js - Max parsing version
 */
class AiEngine {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this._initPromise = null;
        this._pendingCommands = new Map();
        this._lastStdout = [];
        this._lastStderr = [];
        this._nextId = 1;
    }

    async init() {
        if (this._initPromise) return this._initPromise;
        this._initPromise = new Promise((resolve, reject) => {
            this.worker = new Worker('/ai-worker.js');
            this.worker.onmessage = (e) => {
                const { type, text, error, id, data } = e.data;
                if (type === 'READY') { this.isReady = true; resolve(); }
                else if (type === 'PRINT') { this._lastStdout.push(text); console.log('[GNU Go]', text); }
                else if (type === 'ERROR') { this._lastStderr.push(text); console.warn('[GNU Go Err]', text); }
                else if (type === 'RESP') {
                    const cb = this._pendingCommands.get(id);
                    if (cb) { this._pendingCommands.delete(id); cb.resolve(data || ''); }
                }
                else if (type === 'INIT_FAIL') { reject(new Error(error)); }
            };
            this.worker.postMessage({ cmd: 'INIT' });
        });
        return this._initPromise;
    }

    async sendCommand(command) {
        if (!this.isReady) await this.init();
        const id = this._nextId++;
        this._lastStdout = [];
        this._lastStderr = [];
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this._pendingCommands.has(id)) {
                    this._pendingCommands.delete(id);
                    resolve('');
                }
            }, 5000);

            this._pendingCommands.set(id, { resolve: (res) => {
                clearTimeout(timeout);
                resolve(res);
            }});
            this.worker.postMessage({ cmd: 'SEND_GTP', id, payload: command });
        });
    }

    async getMove(color = 'white') {
        const res = await this.sendCommand(`genmove ${color}`);
        
        // 1. Try to parse standard GTP
        if (res && res.includes('=')) {
            const parts = res.split('=');
            const move = parts[parts.length - 1].trim();
            if (move && move.toLowerCase() !== 'ok') return move.toUpperCase();
        }
        
        // 2. Try to parse from stdout/stderr (e.g. "white (O) move Q16")
        const allText = [...this._lastStdout, ...this._lastStderr].join(' ');
        const moveMatch = allText.match(/(?:move\s+)([A-T][0-9]{1,2})/i);
        if (moveMatch) {
            console.log('[AiEngine] Extracted move from logs:', moveMatch[1]);
            return moveMatch[1].toUpperCase();
        }

        if (res && res.includes('?')) {
            console.error('[AiEngine] Engine error:', res);
            return 'ERROR';
        }

        console.warn('[AiEngine] AI failed to produce a move, using PASS');
        return 'PASS';
    }

    async playMove(color, coord) {
        return await this.sendCommand(`play ${color} ${coord}`);
    }

    async setBoardSize(size) {
        return await this.sendCommand(`boardsize ${size}`);
    }

    async listStones(color) {
        const res = await this.sendCommand(`list_stones ${color}`);
        if (res && res.includes('=')) {
            const list = res.split('=')[1].trim();
            return list ? list.split(/\s+/) : [];
        }
        return null;
    }

    async getTutorHint(color = 'black') {
        const res = await this.sendCommand(`tutor_analyze ${color}`);
        try {
            return JSON.parse(res);
        } catch (e) {
            return null;
        }
    }

    async clearBoard() {
        return await this.sendCommand('clear_board');
    }
}

export const aiEngine = new AiEngine();
