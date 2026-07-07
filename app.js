'use strict';
/* =============================================================
   Multiplicação — treino do algoritmo (1.º ciclo)
   - Escolha de nível pelo professor (máx. do multiplicando +
     multiplicar por unidades ou dezenas)
   - Quadradinho do transporte SEMPRE presente e verificado
   - Muito feedback: cores, mensagens, dicas, passo-a-passo,
     pontos / sequência / medalhas, teclado no ecrã
   ============================================================= */

/* ---------- Atalhos ---------- */
const $ = (s, r = document) => r.querySelector(s);
const digits = (n) => String(n).split('').map(Number);          // "347" -> [3,4,7]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ---------- Estado ---------- */
// multiplierDigits: 1 = multiplicar por unidades | 2 = por dezenas
// tabuadaMax: maior tabuada que o aluno já sabe (2 a 9)
const DEFAULTS = { multiplierDigits: 1, tabuadaMax: 5, sound: true };
let settings = loadSettings();
let stats = loadStats();                 // { points, streak, stars }
let model = null;                        // conta atual (ver buildModel)
let checkables = [];                     // [{el, expected, kind}]
let stepOrder = [];                      // [{el, caption}] na ordem de resolução
let currentInput = null;                 // quadradinho com foco
let attempts = 0;                        // tentativas na conta atual
let solved = false;                      // conta atual já resolvida?
let stepTimer = null;                    // temporizador do passo-a-passo

/* =============================================================
   1) PERSISTÊNCIA
   ============================================================= */
function loadSettings() {
  let s = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('mult-settings'));
    if (saved && typeof saved === 'object') s = { ...DEFAULTS, ...saved };
  } catch (_) {}
  s.multiplierDigits = s.multiplierDigits === 2 ? 2 : 1;
  s.tabuadaMax = clamp(parseInt(s.tabuadaMax, 10) || DEFAULTS.tabuadaMax, 2, 9);
  s.sound = s.sound !== false;
  return s;
}
function saveSettings() { localStorage.setItem('mult-settings', JSON.stringify(settings)); }

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('mult-stats'));
    if (s && typeof s === 'object') return { points: 0, streak: 0, stars: 0, ...s };
  } catch (_) {}
  return { points: 0, streak: 0, stars: 0 };
}
function saveStats() { localStorage.setItem('mult-stats', JSON.stringify(stats)); }

/* =============================================================
   2) MATEMÁTICA — multiplicar por UM algarismo, passo a passo
   Devolve, por posição (0 = unidades, a contar da direita):
     dg  = algarismo do multiplicando
     ci  = transporte que ENTRA (vem da posição anterior)
     pd  = algarismo que se escreve
     co  = transporte que SAI
   ============================================================= */
function multiplyBySingle(aDigitsMSB, m) {
  const La = aDigitsMSB.length;
  const dg = [], ci = [], pd = [], co = [];
  let carry = 0;
  for (let p = 0; p < La; p++) {
    dg[p] = aDigitsMSB[La - 1 - p];
    ci[p] = carry;
    const v = dg[p] * m + carry;
    pd[p] = v % 10;
    carry = Math.floor(v / 10);
    co[p] = carry;
  }
  const leading = carry;                          // sobra final -> algarismo à esquerda
  const posDigits = pd.slice();
  if (leading > 0) posDigits.push(leading);
  const productDigits = posDigits.slice().reverse();   // MSB primeiro
  return { La, dg, ci, pd, co, leading, productDigits, value: aDigitsMSB.reduce((a, d) => a * 10 + d, 0) * m };
}

/* Conta quantos transportes (não nulos) existem numa multiplicação/soma */
function countCarries(nums) { return nums.filter((c) => c > 0).length; }

/* =============================================================
   3) GERAÇÃO DA CONTA
   ============================================================= */
function pickNumbers() {
  const N = clamp(settings.tabuadaMax, 2, 9);   // maior tabuada conhecida
  const twoDigit = settings.multiplierDigits === 2;
  let best = null;
  // Tenta obter uma conta com pelo menos um transporte (mais rica p/ treinar)
  for (let tryN = 0; tryN < 40; tryN++) {
    const a = randInt(10, 99);                  // número de cima: 2 algarismos
    let b;
    if (twoDigit) {
      // multiplicar por dezenas: algarismos do multiplicador dentro das tabuadas conhecidas
      const t = randInt(1, N);                  // dezena (1..N)
      const u = randInt(2, N);                  // unidade (2..N)
      b = t * 10 + u;
    } else {
      b = randInt(2, N);                        // multiplicar por unidade (×2..×N)
    }
    const carries = totalCarriesOf(a, b, twoDigit);
    if (carries > 0) return { a, b };
    if (!best) best = { a, b };
  }
  return best;
}

/* Nº total de transportes que a conta terá (para escolher contas ricas) */
function totalCarriesOf(a, b, twoDigit) {
  const aD = digits(a);
  if (!twoDigit) {
    const M = multiplyBySingle(aD, b);
    return countCarries(M.co.slice(0, M.La - 1));   // transportes internos
  }
  const u = b % 10, t = Math.floor(b / 10);
  const P1 = multiplyBySingle(aD, u);
  const P2 = multiplyBySingle(aD, t);
  let c = countCarries(P1.co.slice(0, P1.La - 1)) + countCarries(P2.co.slice(0, P2.La - 1));
  // transportes da soma
  const W = digits(a * b).length;
  let carry = 0;
  for (let p = 0; p < W; p++) {
    const da = Math.floor((a * u) / 10 ** p) % 10;
    const db = Math.floor((a * t * 10) / 10 ** p) % 10;
    const s = da + db + carry;
    carry = Math.floor(s / 10);
    if (p < W - 1 && carry > 0) c++;
  }
  return c;
}

/* =============================================================
   4) CONSTRUÇÃO DO MODELO VISUAL (linhas + células + passos)
   Cada célula: { col, kind, value?, expected?, display? }
   kind: 'given' | 'input' | 'carry' | 'symbol' | 'zero'
   ============================================================= */
function buildModel(a, b) {
  const aD = digits(a);
  const La = aD.length;
  const twoDigit = settings.multiplierDigits === 2;
  const rows = [];        // { kind:'cells'|'rule', carry?:bool, cells:[] }
  const steps = [];       // ordem de resolução (para dica / passo-a-passo)

  const idCounter = { n: 0 };
  const newId = () => 'c' + (idCounter.n++);

  if (!twoDigit) {
    /* ---------- Multiplicador de 1 algarismo ---------- */
    const M = multiplyBySingle(aD, b);
    // largura da grelha (garante espaço para o sinal × à esquerda)
    const W = Math.max(M.productDigits.length, String(b).length + 1, 2);

    // transporte (por cima do multiplicando)
    const carryRow = { kind: 'cells', carry: true, cells: [] };
    for (let p = 1; p <= La - 1; p++) {
      carryRow.cells.push(carryCell(W - 1 - p, M.ci[p], newId()));
    }
    rows.push(carryRow);

    // multiplicando
    rows.push(numberRowGiven(aD, W, 0));

    // multiplicador (× b)
    rows.push(multiplierRow(digits(b), W));

    rows.push({ kind: 'rule' });

    // resultado (quadradinhos de resposta)
    const resRow = { kind: 'cells', cells: [] };
    const resCells = placeInputs(M.productDigits, W, 0, newId);
    resRow.cells = resCells;
    rows.push(resRow);

    // passos: unidades -> transporte -> dezenas -> ...
    buildStepsSingle(steps, M, resCells, carryRow.cells, W, b);

    return finalize({ rows, steps, a, b, W, result: a * b, twoDigit });
  }

  /* ---------- Multiplicador de 2 algarismos ---------- */
  const u = b % 10, t = Math.floor(b / 10);
  const P1 = multiplyBySingle(aD, u);
  const P2 = multiplyBySingle(aD, t);
  const result = a * b;
  // largura da grelha (garante espaço para o sinal × à esquerda)
  const W = Math.max(digits(result).length, String(b).length + 1, 2);

  // transporte da 1.ª parcela (× unidades) — por cima do multiplicando
  const cA = { kind: 'cells', carry: true, cells: [] };
  for (let p = 1; p <= La - 1; p++) cA.cells.push(carryCell(W - 1 - p, P1.ci[p], newId()));
  rows.push(cA);

  rows.push(numberRowGiven(aD, W, 0));          // multiplicando
  rows.push(multiplierRow(digits(b), W));       // × b
  rows.push({ kind: 'rule' });

  // 1.ª parcela (a × unidades)
  const p1Row = { kind: 'cells', cells: [] };
  const p1Cells = placeInputs(P1.productDigits, W, 0, newId);
  p1Row.cells = p1Cells;
  rows.push(p1Row);

  // transporte da 2.ª parcela (× dezenas) — alinhado com a 2.ª parcela (deslocada 1)
  const cB = { kind: 'cells', carry: true, cells: [] };
  for (let p = 1; p <= La - 1; p++) cB.cells.push(carryCell(W - 1 - p - 1, P2.ci[p], newId()));
  rows.push(cB);

  // 2.ª parcela (a × dezenas), deslocada 1 casa; 0 fixo nas unidades
  const p2Row = { kind: 'cells', cells: [] };
  const p2Cells = placeInputs(P2.productDigits, W, 1, newId);
  p2Row.cells = p2Cells;
  p2Row.cells.push({ col: W - 1, kind: 'zero', display: '0' });
  rows.push(p2Row);

  rows.push({ kind: 'rule' });

  // transporte da soma
  const sum = computeSum(a * u, a * t * 10, W);
  const cS = { kind: 'cells', carry: true, cells: [] };
  for (let p = 1; p <= W - 1; p++) cS.cells.push(carryCell(W - 1 - p, sum.ci[p], newId()));
  rows.push(cS);

  // resultado final
  const resRow = { kind: 'cells', cells: [] };
  const resCells = placeInputs(digits(result), W, 0, newId);
  resRow.cells = resCells;
  rows.push(resRow);

  buildStepsDouble(steps, { P1, P2, sum, u, t, W, La },
    p1Cells, cA.cells, p2Cells, cB.cells, resCells, cS.cells);

  return finalize({ rows, steps, a, b, W, result, twoDigit });
}

/* soma coluna a coluna (para transporte da soma) */
function computeSum(A, B, W) {
  const pd = [], ci = [], co = [];
  let carry = 0;
  for (let p = 0; p < W; p++) {
    ci[p] = carry;
    const da = Math.floor(A / 10 ** p) % 10;
    const db = Math.floor(B / 10 ** p) % 10;
    const s = da + db + carry;
    pd[p] = s % 10;
    carry = Math.floor(s / 10);
    co[p] = carry;
  }
  return { pd, ci, co, A, B };
}

/* ---- construtores de células ---- */
function carryCell(col, expected, id) {
  return { col, kind: 'carry', expected, id };
}
function numberRowGiven(dMSB, W, shift) {
  const cells = [];
  const len = dMSB.length;
  for (let k = 0; k < len; k++) {
    const pos = len - 1 - k;
    cells.push({ col: W - 1 - pos - shift, kind: 'given', display: dMSB[k] });
  }
  return { kind: 'cells', cells };
}
function multiplierRow(bMSB, W) {
  const cells = [];
  const len = bMSB.length;
  for (let k = 0; k < len; k++) {
    const pos = len - 1 - k;
    cells.push({ col: W - 1 - pos, kind: 'given', display: bMSB[k] });
  }
  cells.push({ col: W - len - 1, kind: 'symbol', display: '×' });
  return { kind: 'cells', cells };
}
function placeInputs(dMSB, W, shift, newId) {
  const cells = [];
  const len = dMSB.length;
  for (let k = 0; k < len; k++) {
    const pos = len - 1 - k;
    cells.push({ col: W - 1 - pos - shift, kind: 'input', expected: dMSB[k], id: newId() });
  }
  return cells;
}

/* ---- passos (ordem de resolução) ---- */
function buildStepsSingle(steps, M, resCells, carryCells, W, b) {
  const carryByCol = indexBy(carryCells);
  const resByCol = indexBy(resCells);
  for (let pos = 0; pos < W; pos++) {
    const col = W - 1 - pos;
    const cell = resByCol[col];
    if (cell) {
      steps.push({ id: cell.id, caption: captionMul(b, M, pos) });
    }
    const cCell = carryByCol[W - 1 - (pos + 1)];
    if (cCell && pos + 1 <= M.La - 1) {
      steps.push({ id: cCell.id, caption: captionCarry(M.co[pos]) });
    }
  }
}
function buildStepsDouble(steps, D, p1Cells, cA, p2Cells, cB, resCells, cS) {
  const { P1, P2, sum, u, t, W, La } = D;
  // 1.ª parcela
  steps.push({ caption: `Primeiro multiplico por ${u} (as unidades).` });
  addMulSteps(steps, P1, p1Cells, cA, W, u, 0);
  // 2.ª parcela
  steps.push({ caption: `Agora multiplico por ${t} (as dezenas). Ponho um 0 nas unidades e continuo.` });
  addMulSteps(steps, P2, p2Cells, cB, W, t, 1);
  // soma
  steps.push({ caption: `Por fim, somo as duas parcelas.` });
  const resByCol = indexBy(resCells);
  const csByCol = indexBy(cS);
  for (let pos = 0; pos < W; pos++) {
    const col = W - 1 - pos;
    const cell = resByCol[col];
    if (cell) steps.push({ id: cell.id, caption: captionSum(sum, pos) });
    const cCell = csByCol[W - 1 - (pos + 1)];
    if (cCell && pos + 1 <= W - 1) steps.push({ id: cCell.id, caption: captionCarry(sum.co[pos]) });
  }
}
function addMulSteps(steps, M, resCells, carryCells, W, m, shift) {
  const resByCol = indexBy(resCells);
  const carryByCol = indexBy(carryCells);
  const len = M.productDigits.length;
  for (let pos = 0; pos < len; pos++) {
    const col = W - 1 - pos - shift;
    const cell = resByCol[col];
    if (cell) steps.push({ id: cell.id, caption: captionMul(m, M, pos) });
    const cCell = carryByCol[W - 1 - (pos + 1) - shift];
    if (cCell && pos + 1 <= M.La - 1) steps.push({ id: cCell.id, caption: captionCarry(M.co[pos]) });
  }
}

function indexBy(cells) {
  const m = {};
  cells.forEach((c) => { if (c.id) m[c.col] = c; });
  return m;
}

/* ---- legendas amigáveis ---- */
function captionMul(m, M, pos) {
  if (pos <= M.La - 1) {
    const dg = M.dg[pos], ci = M.ci[pos], pd = M.pd[pos], co = M.co[pos];
    const soma = ci ? ` + ${ci}` : '';
    const total = dg * m + ci;
    let s = `${m} × ${dg}${soma} = ${total}. Escrevo o ${pd}`;
    s += co ? ` e transporto o ${co}. 🟨` : '.';
    return s;
  }
  return `Sobra o transporte ${M.leading}. Escrevo o ${M.leading}.`;
}
function captionSum(sum, pos) {
  const da = Math.floor(sum.A / 10 ** pos) % 10;
  const db = Math.floor(sum.B / 10 ** pos) % 10;
  const ci = sum.ci[pos];
  const soma = ci ? ` + ${ci}` : '';
  const total = da + db + ci;
  let s = `${da} + ${db}${soma} = ${total}. Escrevo o ${sum.pd[pos]}`;
  s += sum.co[pos] ? ` e transporto o ${sum.co[pos]}. 🟨` : '.';
  return s;
}
function captionCarry(v) {
  return v > 0 ? `Escrevo o transporte ${v} no quadradinho amarelo. 🟨` : `Não há transporte, deixo o quadradinho vazio.`;
}

function finalize(m) {
  return m;
}

/* =============================================================
   5) RENDERIZAÇÃO
   ============================================================= */
function render() {
  const board = $('#board');
  board.innerHTML = '';
  board.style.setProperty('--cols', model.W);
  checkables = [];
  const idToEl = {};

  for (const row of model.rows) {
    if (row.kind === 'rule') {
      const wrap = document.createElement('div');
      wrap.className = 'grid-row';
      wrap.style.gridColumn = `1 / -1`;
      const line = document.createElement('div');
      line.className = 'rule';
      line.style.width = `calc(var(--cell) * ${model.W} + var(--gap) * ${model.W - 1})`;
      wrap.appendChild(line);
      board.appendChild(wrap);
      continue;
    }

    const rowEl = document.createElement('div');
    rowEl.className = 'grid-row' + (row.carry ? ' carry' : '');

    // preencher todas as colunas (vazias mantêm alinhamento)
    const byCol = {};
    row.cells.forEach((c) => (byCol[c.col] = c));

    for (let col = 0; col < model.W; col++) {
      const c = byCol[col];
      const el = renderCell(c);
      if (c && c.id) { idToEl[c.id] = el.querySelector('input'); }
      rowEl.appendChild(el);
    }
    board.appendChild(rowEl);
  }

  // ligar ids -> elementos nos passos e nas células verificáveis
  stepOrder = model.steps.map((s) => ({ el: s.id ? idToEl[s.id] : null, caption: s.caption }));
  collectCheckables(idToEl);

  // foco no primeiro quadradinho de resposta
  focusFirst();
}

function renderCell(c) {
  if (!c) {
    const d = document.createElement('div');
    d.className = 'cell empty';
    return d;
  }
  if (c.kind === 'given' || c.kind === 'symbol' || c.kind === 'zero') {
    const d = document.createElement('div');
    d.className = 'cell ' + c.kind;
    d.textContent = c.display;
    return d;
  }
  // carry ou input de resposta -> célula com <input> lá dentro
  const isCarry = c.kind === 'carry';
  const wrapper = document.createElement('div');
  wrapper.className = isCarry ? 'cell carry-cell' : 'cell';
  const inp = document.createElement('input');
  inp.className = isCarry ? 'carry-input' : 'digit-input';
  inp.inputMode = 'numeric';
  inp.maxLength = 1;
  inp.dataset.kind = isCarry ? 'carry' : 'input';
  inp.dataset.expected = c.expected;
  wireInput(inp);
  wrapper.appendChild(inp);
  return wrapper;
}

function collectCheckables(idToEl) {
  checkables = [];
  document.querySelectorAll('#board input').forEach((el) => {
    checkables.push({ el, expected: parseInt(el.dataset.expected, 10), kind: el.dataset.kind });
  });
}

/* =============================================================
   6) INTERAÇÃO COM OS QUADRADINHOS
   ============================================================= */
function wireInput(inp) {
  inp.addEventListener('focus', () => { currentInput = inp; });
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/[^0-9]/g, '').slice(-1);
    inp.classList.remove('ok', 'bad', 'hintme');
    if (inp.value) advance(inp);
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !inp.value) { e.preventDefault(); retreat(inp); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // deixa o comportamento natural
    }
  });
}

function orderedInputs() {
  return stepOrder.filter((s) => s.el).map((s) => s.el);
}
function advance(inp) {
  const list = orderedInputs();
  const i = list.indexOf(inp);
  if (i >= 0 && i < list.length - 1) list[i + 1].focus();
}
function retreat(inp) {
  const list = orderedInputs();
  const i = list.indexOf(inp);
  if (i > 0) { list[i - 1].focus(); list[i - 1].select(); }
}
function focusFirst() {
  const list = orderedInputs();
  if (list.length) { list[0].focus(); }
}

/* teclado no ecrã */
function pressKey(key) {
  if (key === 'next') {
    const list = orderedInputs();
    const i = currentInput ? list.indexOf(currentInput) : -1;
    (list[(i + 1) % list.length] || list[0])?.focus();
    return;
  }
  if (!currentInput) { focusFirst(); }
  if (!currentInput) return;
  if (key === 'back') {
    if (currentInput.value) { currentInput.value = ''; currentInput.classList.remove('ok', 'bad'); }
    else retreat(currentInput);
    return;
  }
  currentInput.value = key;
  currentInput.classList.remove('ok', 'bad', 'hintme');
  advance(currentInput);
}

/* =============================================================
   7) VERIFICAÇÃO + FEEDBACK
   ============================================================= */
function check() {
  if (solved) return;
  stopSteps();
  attempts++;

  let resWrong = 0, resEmpty = 0, resTotal = 0;
  let carryWrong = 0, carryTotal = 0;

  for (const c of checkables) {
    const raw = c.el.value.trim();
    c.el.classList.remove('ok', 'bad', 'hintme');
    if (c.kind === 'carry') {
      carryTotal++;
      const got = raw === '' ? 0 : parseInt(raw, 10);
      if (got === c.expected) { if (raw !== '' || c.expected > 0) c.el.classList.add('ok'); }
      else { c.el.classList.add('bad'); carryWrong++; }
    } else {
      resTotal++;
      if (raw === '') { resEmpty++; c.el.classList.add('bad'); }
      else if (parseInt(raw, 10) === c.expected) c.el.classList.add('ok');
      else { c.el.classList.add('bad'); resWrong++; }
    }
  }

  // Faltam quadradinhos por preencher
  if (resEmpty > 0 && resWrong === 0) {
    setFeedback('almost', '✏️', 'Ainda faltam quadradinhos! Preenche todos e depois verifica. 😊');
    return;
  }

  // Resultado certo
  if (resWrong === 0 && resEmpty === 0) {
    if (carryWrong === 0) {
      win(true);   // resultado + transportes perfeitos
    } else {
      win(false);  // resultado certo, transporte a melhorar
    }
    return;
  }

  // Resultado ainda com erros
  stats.streak = 0; updateStats();
  const msgs = [
    'Quase! Olha para os quadradinhos a vermelho e tenta de novo. 💪',
    'Não faz mal, os erros ajudam a aprender! Corrige os vermelhos. 🌱',
    'Estás quase lá! Verifica os quadradinhos a vermelho. 🔎',
  ];
  setFeedback('oops', '🤔', msgs[randInt(0, msgs.length - 1)]);
  playBuzz();

  if (attempts >= 2) {
    setTimeout(() => setFeedback('oops', '👣',
      'Queres ajuda? Carrega em «Passo a passo» para veres como se faz.'), 1600);
  }
}

function win(perfect) {
  solved = true;
  disableInputs();
  const gained = 10 + (perfect && attempts === 1 ? 5 : 0);
  stats.points += gained;
  stats.streak += 1;
  if (perfect) stats.stars += 1;
  updateStats();
  playFanfare();
  confetti();

  if (perfect) {
    const msgs = [
      `Boa! Resultado e transportes perfeitos! +${gained} pontos 🎉`,
      `Excelente! Acertaste tudo, até o transporte! +${gained} pontos 🌟`,
      `Fantástico! 🟨 Transporte impecável! +${gained} pontos 🏅`,
    ];
    setFeedback('good', '🎉', msgs[randInt(0, msgs.length - 1)]);
  } else {
    setFeedback('almost', '👍',
      `Resultado certo! +${gained} pontos. Vê só os quadradinhos amarelos do transporte para ficar perfeito. 🟨`);
  }
  // realça o botão de nova conta
  const nb = $('#btnNew');
  nb.classList.add('pulse-cta');
  setTimeout(() => nb.focus(), 400);
}

function setFeedback(type, emoji, text) {
  const fb = $('#feedback');
  fb.className = 'feedback ' + type;
  $('#fbEmoji').textContent = emoji;
  $('#fbText').innerHTML = text;
}

function disableInputs(v = true) {
  document.querySelectorAll('#board input').forEach((el) => (el.disabled = v));
}

/* =============================================================
   8) DICA + PASSO A PASSO
   ============================================================= */
function hint() {
  if (solved) return;
  stopSteps();
  // primeiro quadradinho vazio (ou errado) na ordem de resolução
  const target = stepOrder.find((s) => {
    if (!s.el) return false;
    const v = s.el.value.trim();
    return v === '' || s.el.classList.contains('bad');
  });
  document.querySelectorAll('.hintme').forEach((e) => e.classList.remove('hintme'));
  if (!target) {
    setFeedback('good', '😄', 'Já preencheste tudo! Carrega em «Verificar». ✅');
    return;
  }
  target.el.classList.add('hintme');
  target.el.focus();
  showCaption('💡 ' + target.caption);
}

function stepByStep() {
  if (solved) return;
  stopSteps();
  disableInputs();
  let i = 0;
  const run = () => {
    if (i >= stepOrder.length) {
      showCaption('✨ Conta terminada! Vê como ficou.');
      stepTimer = setTimeout(() => { hideCaption(); }, 2600);
      return;
    }
    const s = stepOrder[i++];
    showCaption('👣 ' + s.caption);
    if (s.el) {
      const exp = s.el.dataset.expected;
      s.el.value = exp;
      s.el.classList.remove('bad');
      s.el.classList.add('ok');
    }
    stepTimer = setTimeout(run, s.el ? 1700 : 2200);
  };
  setFeedback('almost', '👀', 'Vê com atenção, passo a passo…');
  run();
}

function stopSteps() {
  if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
}
function showCaption(text) {
  const el = $('#stepCaption');
  el.hidden = false;
  el.textContent = text;
}
function hideCaption() { $('#stepCaption').hidden = true; }

/* =============================================================
   9) SOM (Web Audio, sem ficheiros)
   ============================================================= */
let audioCtx = null;
function ctx() {
  if (!settings.sound) return null;
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; } }
  return audioCtx;
}
function tone(freq, start, dur, type = 'sine', vol = 0.15) {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}
function playBuzz() { tone(180, 0, 0.18, 'sawtooth', 0.12); }
function playFanfare() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.16));
}

/* =============================================================
   10) CONFETTI
   ============================================================= */
function confetti() {
  const party = $('#party');
  const emojis = ['🎉', '⭐', '🎊', '🟨', '🥳', '✨', '🏅', '💜'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = emojis[randInt(0, emojis.length - 1)];
    s.style.left = randInt(0, 100) + 'vw';
    s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    s.style.animationDelay = (Math.random() * 0.4) + 's';
    party.appendChild(s);
    setTimeout(() => s.remove(), 3200);
  }
}

/* =============================================================
   11) ESTATÍSTICAS + NÍVEL
   ============================================================= */
function updateStats() {
  $('#statPoints').textContent = stats.points;
  $('#statStreak').textContent = stats.streak;
  $('#statStars').textContent = stats.stars;
  saveStats();
}
function levelNoteText() {
  const N = settings.tabuadaMax;
  const tipo = settings.multiplierDigits === 2 ? 'dezena' : 'unidade';
  return `Nível: 2 algarismos × ${tipo} (tabuadas até ×${N})`;
}
function updateLevelNote() { $('#levelNote').textContent = levelNoteText(); }

/* =============================================================
   12) NOVA CONTA
   ============================================================= */
function newProblem() {
  stopSteps();
  hideCaption();
  solved = false;
  attempts = 0;
  const { a, b } = pickNumbers();
  model = buildModel(a, b);
  render();
  disableInputs(false);
  $('#btnNew').classList.remove('pulse-cta');
  setFeedback('', '👋', 'Preenche os quadradinhos e depois carrega em <b>Verificar</b>.');
  updateLevelNote();
}

/* =============================================================
   13) DEFINIÇÕES (integradas na janela)
   ============================================================= */
function syncSettingsUI() {
  document.querySelectorAll('#multiplierChips .chip').forEach((c) =>
    c.classList.toggle('active', +c.dataset.mult === settings.multiplierDigits));
  document.querySelectorAll('#maxChips .chip').forEach((c) =>
    c.classList.toggle('active', +c.dataset.max === settings.tabuadaMax));
  updateLevelNote();
}
function toggleSettings() {
  const body = $('#settingsBody');
  const btn = $('#btnToggleSettings');
  const collapsed = body.classList.toggle('collapsed');
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.textContent = collapsed ? 'mostrar ▼' : 'esconder ▲';
}
// Aplica uma definição escolhida e começa logo uma conta nova nesse nível
function applySetting() {
  saveSettings();
  syncSettingsUI();
  newProblem();
}

/* =============================================================
   14) LIGAÇÕES / EVENTOS
   ============================================================= */
function bind() {
  $('#btnCheck').addEventListener('click', check);
  $('#btnHint').addEventListener('click', hint);
  $('#btnSteps').addEventListener('click', stepByStep);
  $('#btnNew').addEventListener('click', newProblem);

  $('#btnToggleSettings').addEventListener('click', toggleSettings);

  $('#btnSound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    $('#btnSound').textContent = settings.sound ? '🔊' : '🔇';
    saveSettings();
    if (settings.sound) tone(660, 0, 0.15, 'triangle', 0.15);
  });

  // Escolher uma definição aplica logo o nível (nova conta)
  document.querySelectorAll('#multiplierChips .chip').forEach((c) =>
    c.addEventListener('click', () => { settings.multiplierDigits = +c.dataset.mult; applySetting(); }));
  document.querySelectorAll('#maxChips .chip').forEach((c) =>
    c.addEventListener('click', () => { settings.tabuadaMax = +c.dataset.max; applySetting(); }));

  // teclado no ecrã
  document.querySelectorAll('#keypad .key').forEach((k) =>
    k.addEventListener('click', () => pressKey(k.dataset.key)));

  // teclado físico global (para números mesmo sem foco num quadradinho)
  document.addEventListener('keydown', (e) => {
    if (/^[0-9]$/.test(e.key) && document.activeElement?.tagName !== 'INPUT') {
      pressKey(e.key);
    }
  });
}

/* =============================================================
   15) ARRANQUE
   ============================================================= */
function init() {
  bind();
  $('#btnSound').textContent = settings.sound ? '🔊' : '🔇';
  updateStats();
  syncSettingsUI();
  newProblem();
}
document.addEventListener('DOMContentLoaded', init);
