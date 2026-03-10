import './style.css'

class GoGame {
  constructor(canvasId, size = 19) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = size;
    this.board = Array(size).fill(null).map(() => Array(size).fill(0)); // 0: empty, 1: black, 2: white
    this.turn = 1; // 1: black, 2: white
    this.padding = 30;
    this.cellSize = (this.canvas.width - this.padding * 2) / (size - 1);

    this.init();
  }

  init() {
    this.render();
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasClick(e));
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
  }

  render() {
    this.drawBoard();
    this.drawStones();
  }

  drawBoard() {
    const ctx = this.ctx;
    const padding = this.padding;
    const cellSize = this.cellSize;
    const size = this.size;

    // Background
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < size; i++) {
      // Horizontal lines
      ctx.moveTo(padding, padding + i * cellSize);
      ctx.lineTo(this.canvas.width - padding, padding + i * cellSize);
      // Vertical lines
      ctx.moveTo(padding + i * cellSize, padding);
      ctx.lineTo(padding + i * cellSize, this.canvas.height - padding);
    }
    ctx.stroke();

    // Star points (Hoshi)
    if (size === 19) {
      const hoshiPoints = [3, 9, 15];
      ctx.fillStyle = '#333';
      for (let x of hoshiPoints) {
        for (let y of hoshiPoints) {
          ctx.beginPath();
          ctx.arc(padding + x * cellSize, padding + y * cellSize, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawStones() {
    const ctx = this.ctx;
    const padding = this.padding;
    const cellSize = this.cellSize;

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.board[y][x] !== 0) {
          const color = this.board[y][x] === 1 ? '#000' : '#fff';
          const gradient = ctx.createRadialGradient(
            padding + x * cellSize - 4,
            padding + y * cellSize - 4,
            cellSize * 0.1,
            padding + x * cellSize,
            padding + y * cellSize,
            cellSize * 0.45
          );

          if (this.board[y][x] === 1) {
            gradient.addColorStop(0, '#555');
            gradient.addColorStop(1, '#000');
          } else {
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(1, '#ccc');
          }

          ctx.beginPath();
          ctx.arc(padding + x * cellSize, padding + y * cellSize, cellSize * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const xCoord = e.clientX - rect.left;
    const yCoord = e.clientY - rect.top;

    // Find nearest intersection
    const x = Math.round((xCoord - this.padding) / this.cellSize);
    const y = Math.round((yCoord - this.padding) / this.cellSize);

    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.placeStone(x, y);
    }
  }

  placeStone(x, y) {
    if (this.board[y][x] !== 0) return;

    this.board[y][x] = this.turn;
    this.updateTutorMessage(x, y);
    this.turn = this.turn === 1 ? 2 : 1;
    this.updateUI();
    this.render();
  }

  updateTutorMessage(x, y) {
    const tutorMsg = document.getElementById('tutor-message');
    const coords = `${String.fromCharCode(65 + (x > 7 ? x + 1 : x))}${this.size - y}`;
    const messages = [
      `멋진 수네요! ${coords} 자리는 아주 영리한 선택입니다.`,
      `${coords}에 두셨군요. 상대방의 응수가 궁금해지는데요?`,
      `오, ${coords}? 그 자리는 집을 넓히기에 아주 적절한 타이밍입니다.`,
      `초보자답지 않은 날카로운 수네요! ${coords}는 급소입니다.`
    ];
    tutorMsg.innerText = messages[Math.floor(Math.random() * messages.length)];
  }

  updateUI() {
    const turnEl = document.getElementById('current-turn');
    if (this.turn === 1) {
      turnEl.innerHTML = '<span class="w-3 h-3 rounded-full bg-white border border-gray-400"></span> 흑번 (나)';
    } else {
      turnEl.innerHTML = '<span class="w-3 h-3 rounded-full bg-black border border-gray-800 shadow-[0_0_5px_rgba(255,255,255,0.2)]"></span> 백번 (상대)';
    }
  }

  reset() {
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.turn = 1;
    document.getElementById('tutor-message').innerText = '"깔끔하게 다시 시작해볼까? 준비되면 착수해줘!"';
    this.updateUI();
    this.render();
  }
}

// Start game
new GoGame('go-board');
