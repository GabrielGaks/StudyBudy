// --- STATE MANAGEMENT ---
const state = {
    questions: [],
    currentQIndex: 0,
    userAnswers: [], // stores selected option key ('A', 'B', 'C', 'D') for each question
    settings: {
        immediateFeedback: false,
        shuffleOptions: true,
        allowBack: true,
        mode: 'single' // 'single' or 'all'
    }
};

// --- DOM ELEMENTS ---
const screens = document.querySelectorAll('.screen');

// Buttons / Interactions
const btnTogglePrompt = document.getElementById('btn-toggle-prompt');
const promptContainer = document.getElementById('prompt-generator-container');
const promptTheme = document.getElementById('prompt-theme');
const promptCsvAmount = document.getElementById('prompt-csv-amount');
const promptQType = document.getElementById('prompt-q-type');
const promptContent = document.getElementById('prompt-content');
const btnGeneratePrompt = document.getElementById('btn-generate-prompt');
const promptResultContainer = document.getElementById('prompt-result-container');
const promptResult = document.getElementById('prompt-result');
const btnCopyPrompt = document.getElementById('btn-copy-prompt');
const csvInput = document.getElementById('csv-input');
const csvTextInput = document.getElementById('csv-text-input');
const btnImportCsvText = document.getElementById('btn-import-csv-text');
const btnGotoAi = document.getElementById('btn-goto-ai');
const btnGenerateAi = document.getElementById('btn-generate-ai');
const btnStartQuiz = document.getElementById('btn-start-quiz');
const btnPrevQ = document.getElementById('btn-prev-q');
const btnNextQ = document.getElementById('btn-next-q');
const btnFinishQ = document.getElementById('btn-finish-q');
const btnSubmitAll = document.getElementById('btn-submit-all');
const btnRedoQuiz = document.getElementById('btn-redo-quiz');
const btnNewQuiz = document.getElementById('btn-new-quiz');
const btnEvalDiscursive = document.getElementById('btn-eval-discursive');
const backBtns = document.querySelectorAll('.btn-back');

// Quiz Elements (Single)
const qCurrentEl = document.getElementById('q-current');
const qTotalEl = document.getElementById('q-total');
const progressFill = document.getElementById('progress-fill');
const questionTextEl = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const explanationContainer = document.getElementById('explanation-container');
const explanationText = document.getElementById('explanation-text');
const quizSingleContainer = document.getElementById('quiz-single-container');
const quizAllContainer = document.getElementById('quiz-all-container');
const allQuestionsList = document.getElementById('all-questions-list');

// Configuration Elements
const cfgImmediate = document.getElementById('cfg-immediate');
const cfgShuffle = document.getElementById('cfg-shuffle-options');
const cfgAllowBack = document.getElementById('cfg-allow-back');
const cfgMode = document.getElementById('cfg-mode');

// --- INIT & UTILS ---
function init() {
    loadSettings();
    attachListeners();
}

function showScreen(screenId) {
    screens.forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${screenId}`).classList.remove('hidden');
}

function attachListeners() {
    backBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            showScreen(e.target.dataset.target);
        });
    });

    btnGotoAi.addEventListener('click', () => showScreen('ai'));
    btnTogglePrompt.addEventListener('click', () => {
        promptContainer.classList.toggle('hidden');
    });
    btnGeneratePrompt.addEventListener('click', generateCSVPrompt);
    promptQType.addEventListener('change', () => {
        if (!promptResultContainer.classList.contains('hidden')) {
            generateCSVPrompt();
        }
    });

    btnCopyPrompt.addEventListener('click', copyCSVPrompt);
    csvInput.addEventListener('change', handleCSVUpload);
    btnImportCsvText.addEventListener('click', handleCSVTextImport);
    btnGenerateAi.addEventListener('click', handleAIGeneration);
    btnStartQuiz.addEventListener('click', startQuiz);

    // Quiz navigation
    btnPrevQ.addEventListener('click', () => changeQuestion(-1));
    btnNextQ.addEventListener('click', () => changeQuestion(1));
    btnFinishQ.addEventListener('click', finishQuiz);
    btnSubmitAll.addEventListener('click', finishQuiz);

    // End/Restart
    btnRedoQuiz.addEventListener('click', redoQuiz);
    btnNewQuiz.addEventListener('click', () => {
        state.questions = [];
        showScreen('home');
    });
    
    btnEvalDiscursive.addEventListener('click', generateEvaluationPrompt);

    // Save settings on change
    [cfgImmediate, cfgShuffle, cfgAllowBack, cfgMode].forEach(el => {
        el.addEventListener('change', saveSettings);
    });
}

function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

// --- LOCAL STORAGE ---
function loadSettings() {
    const saved = localStorage.getItem('quizSettings');
    if (saved) {
        try {
            state.settings = JSON.parse(saved);
            cfgImmediate.checked = state.settings.immediateFeedback;
            cfgShuffle.checked = state.settings.shuffleOptions;
            cfgAllowBack.checked = state.settings.allowBack;
            cfgMode.value = state.settings.mode;
        } catch (e) {
            console.error("Error loading settings");
        }
    }
}

function saveSettings() {
    state.settings = {
        immediateFeedback: cfgImmediate.checked,
        shuffleOptions: cfgShuffle.checked,
        allowBack: cfgAllowBack.checked,
        mode: cfgMode.value
    };
    localStorage.setItem('quizSettings', JSON.stringify(state.settings));
}

// --- CSV HANDLING ---
function generateCSVPrompt() {
  const theme = promptTheme.value.trim();
  const content = promptContent.value.trim();
  const qType = promptQType ? promptQType.value : "objetivas";
  const amountText = promptCsvAmount
    ? parseInt(promptCsvAmount.value) || 10
    : 10;
 
  if (!theme && !content) {
    alert("Preencha o tema ou o conteúdo desejado.");
    return;
  }
 
  // ── Bloco de instruções por tipo ──────────────────────────────────
  let typeInstructions = "";
 
  if (qType === "objetivas") {
    typeInstructions = `
## TIPO OBRIGATÓRIO: 100% MÚLTIPLA ESCOLHA (tipo = "objetiva")
É PROIBIDO gerar questões discursivas.
 
### Regras para alternativas (distratores):
- Cada questão DEVE ter exatamente 4 opções (A, B, C, D) com UMA ÚNICA correta.
- Os distratores (alternativas erradas) devem representar ERROS CONCEITUAIS REAIS que um aluno cometeria — não invente opções absurdas ou desconexas.
- Todas as 4 opções devem ter comprimento textual similar (±20% de caracteres).
- PROIBIDO usar: "Todas as anteriores", "Nenhuma das anteriores", "A e B estão corretas", ou qualquer variação combinatória.
- PROIBIDO que a alternativa correta seja sistematicamente mais longa ou mais detalhada que as demais.
- Distribua a posição da resposta correta de forma EQUILIBRADA entre A, B, C e D ao longo do CSV (não concentre em uma única letra).
- A coluna 'resposta_correta' deve conter APENAS a letra maiúscula: A, B, C ou D.`;
  } else if (qType === "discursivas") {
    typeInstructions = `
## TIPO OBRIGATÓRIO: 100% DISCURSIVAS (tipo = "discursiva")
É PROIBIDO gerar questões de múltipla escolha.
 
### Regras para discursivas:
- As colunas opcao_a, opcao_b, opcao_c, opcao_d e resposta_correta DEVEM FICAR VAZIAS (sem nenhum caractere).
- Formule perguntas que exijam ARGUMENTAÇÃO, ANÁLISE CRÍTICA ou SÍNTESE — não perguntas que se respondem com uma única frase.
- Use verbos de comando precisos: "Analise...", "Compare e contraste...", "Argumente a favor ou contra...", "Elabore uma proposta para...", "Avalie criticamente...".
- A coluna 'explicacao' deve conter os CRITÉRIOS DE CORREÇÃO esperados (tópicos-chave que a resposta precisa abordar), não uma resposta pronta.`;
  } else {
    typeInstructions = `
## TIPO OBRIGATÓRIO: MIX BALANCEADO (~50% objetivas, ~50% discursivas)
Alterne entre os dois tipos ao longo do CSV.
 
### Para objetivas (tipo = "objetiva"):
- 4 opções plausíveis com distratores baseados em erros conceituais reais.
- Todas as opções com comprimento similar. Distribua a resposta correta entre A-D.
- PROIBIDO: "Todas/Nenhuma das anteriores" ou combinações.
- 'resposta_correta' = apenas a letra (A, B, C ou D).
 
### Para discursivas (tipo = "discursiva"):
- Colunas opcao_a até resposta_correta DEVEM FICAR VAZIAS.
- Use verbos de comando de alta complexidade (analise, compare, argumente, avalie).
- 'explicacao' = critérios de correção, não resposta completa.`;
  }
 
  // ── Prompt principal ─────────────────────────────────────────────
  const promptStr = `Você é um elaborador sênior de avaliações acadêmicas com expertise em design instrucional e psicometria. Seu output será processado por um parser CSV automatizado — qualquer desvio de formato causa erro no sistema.
 
## CONTEXTO DA AVALIAÇÃO
- **Tema central:** ${theme || "Conhecimentos Gerais"}
- **Conteúdo específico:** ${content || "Abordagem ampla do tema"}
- **Quantidade exata:** ${amountText} questões
 
${typeInstructions}
 
## QUALIDADE PEDAGÓGICA (CRÍTICO)
Aplique a Taxonomia de Bloom revisada para distribuir as questões entre TODOS estes níveis cognitivos:
- ~20% LEMBRAR/COMPREENDER (definições, conceitos-base)
- ~40% APLICAR/ANALISAR (resolução de problemas, estudo de caso, cenários práticos)
- ~40% AVALIAR/CRIAR (julgamento crítico, proposição de soluções, comparação entre abordagens)
 
### Diretrizes de formulação:
1. PREFIRA enunciados contextualizados com cenários, situações-problema ou estudos de caso breves em vez de perguntas diretas tipo "O que é X?".
2. O enunciado deve ser AUTOSSUFICIENTE — o aluno não deve precisar de material externo para responder.
3. Use linguagem formal, clara e sem ambiguidades. Evite duplas negativas.
4. A coluna 'explicacao' deve justificar POR QUE a resposta correta está certa E por que cada distrator está errado (para objetivas), ou listar os critérios de correção (para discursivas).
5. A coluna 'nivel' deve conter exatamente um destes valores em minúsculas: "facil", "medio" ou "dificil". Distribua de forma balanceada.
 
## ANTIPADRÕES PROIBIDOS
- Perguntas genéricas tipo "Qual a importância de X?" sem contexto aplicado.
- Alternativas que se eliminam por lógica (ex: duas opções mutuamente exclusivas que cobrem todos os casos).
- Enunciados com pistas gramaticais que denunciam a resposta (concordância de gênero/número).
- Repetição de palavras do enunciado apenas na alternativa correta.
- Questões com pegadinhas baseadas em detalhes irrelevantes.
 
## FORMATO DE SAÍDA
Retorne EXCLUSIVAMENTE um bloco CSV puro (sem crases, sem markdown, sem saudações, sem texto antes ou depois). Use vírgula (,) como separador. Se algum campo contiver vírgula ou quebra de linha, envolva-o em aspas duplas (").
 
Linha de cabeçalho OBRIGATÓRIA (copie exatamente):
pergunta,opcao_a,opcao_b,opcao_c,opcao_d,resposta_correta,explicacao,tema,nivel,tipo
 
Gere exatamente ${amountText} linhas de dados após o cabeçalho. Coluna 'tipo' = "objetiva" ou "discursiva" (minúsculas).`;
 
  promptResult.value = promptStr;
  promptResultContainer.classList.remove("hidden");
}


function copyCSVPrompt() {
    const textToCopy = promptResult.value;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(showCopiedText);
    } else {
        promptResult.select();
        document.execCommand('copy');
        showCopiedText();
    }
}

function showCopiedText() {
    const originalText = btnCopyPrompt.innerHTML;
    btnCopyPrompt.innerHTML = "✅ Copiado!";
    setTimeout(() => { btnCopyPrompt.innerHTML = originalText; }, 2000);
}

function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const errorEl = document.getElementById('csv-error');
    errorEl.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = function (evt) {
        const text = evt.target.result;
        try {
            const parsed = parseCSV(text);
            if (parsed.length === 0) throw new Error("O CSV não contém perguntas válidas.");
            state.questions = parsed;
            showScreen('config');
        } catch (err) {
            errorEl.textContent = "Erro ao ler CSV: " + err.message;
            errorEl.classList.remove('hidden');
        }
    };
    reader.onerror = function () {
        errorEl.textContent = "Erro ao carregar o arquivo.";
        errorEl.classList.remove('hidden');
    };
    reader.readAsText(file);
    e.target.value = null; // reset
}

function handleCSVTextImport() {
    const errorEl = document.getElementById('csv-error');
    const csvText = csvTextInput.value.trim();

    errorEl.classList.add('hidden');

    try {
        const parsed = parseCSV(csvText);
        if (parsed.length === 0) throw new Error("O CSV nÃ£o contÃ©m perguntas vÃ¡lidas.");
        state.questions = parsed;
        showScreen('config');
    } catch (err) {
        errorEl.textContent = "Erro ao processar o CSV colado: " + err.message;
        errorEl.classList.remove('hidden');
    }
}

function sanitizeCSVText(text) {
    if (!text || typeof text !== 'string') return '';

    let normalized = text.trim().replace(/^\uFEFF/, '');
    const fencedMatch = normalized.match(/^```(?:csv)?\s*([\s\S]*?)\s*```$/i);

    if (fencedMatch) {
        normalized = fencedMatch[1].trim();
    }

    return normalized;
}

function parseCSV(text) {
    text = sanitizeCSVText(text);
    if (!text) return [];

    // Regex for parsing CSV correctly ignoring internal commas in quotes
    const pattern = new RegExp(
        (
            "(\\,|\\r?\\n|\\r|^)" + // Delimiters
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" + // Quoted fields
            "([^\"\\,\\r\\n]*))" // Standard fields
        ), "gi"
    );

    let data = [[]];
    let matches = null;
    while (matches = pattern.exec(text)) {
        let matchedDelimiter = matches[1];
        if (matchedDelimiter.length && matchedDelimiter !== ",") {
            data.push([]);
        }
        let matchedValue;
        if (matches[2]) {
            matchedValue = matches[2].replace(new RegExp("\"\"", "g"), "\"");
        } else {
            matchedValue = matches[3];
        }
        data[data.length - 1].push(matchedValue);
    }

    if (data.length < 2) return [];

    const headers = data[0].map(h => h ? h.trim().toLowerCase() : '');
    if (!headers.includes('pergunta')) {
        throw new Error("A coluna 'pergunta' é obrigatória no CSV.");
    }

    const questions = [];
    for (let i = 1; i < data.length; i++) {
        let row = data[i];
        if (row.length < 1) continue;

        let q = {};
        headers.forEach((h, idx) => {
            if (h) q[h] = row[idx] ? row[idx].trim() : '';
        });

        if (!q.pergunta) continue;

        const tipo = (q.tipo || 'objetiva').toLowerCase().trim();
        q.tipo = tipo;

        if (tipo === 'discursiva') {
            questions.push(q);
        } else {
            // Objective logic default
            const hasOptions = q.opcao_a && q.opcao_b && q.opcao_c && q.opcao_d;
            if (hasOptions && q.resposta_correta && ['A', 'B', 'C', 'D'].includes(q.resposta_correta.toUpperCase())) {
                q.resposta_correta = q.resposta_correta.toUpperCase();
                questions.push(q);
            }
        }
    }
    return questions;
}

// --- AI GENERATION ---
async function handleAIGeneration() {
    const text = document.getElementById('ai-context').value.trim();
    const amount = document.getElementById('ai-q-amount').value;
    const errorEl = document.getElementById('ai-error');

    if (!text) {
        errorEl.textContent = "Por favor, insira um texto base.";
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    document.getElementById('ai-loading').classList.remove('hidden');

    try {
        const aiData = await callHuggingFaceAPI(text, amount);
        state.questions = aiData.questions;
        document.getElementById('ai-loading').classList.add('hidden');
        showScreen('config');
    } catch (e) {
        document.getElementById('ai-loading').classList.add('hidden');
        errorEl.textContent = "Erro na IA: " + e.message;
        errorEl.classList.remove('hidden');
    }
}

async function callHuggingFaceAPI(text, amount) {
    // Insira seu Token (Access Token) do Hugging Face. (Geralmente começa com hf_)
    const HF_TOKEN = "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";

    // Modelo roteado solicitado pelo usuário
    const MODEL = "google/gemma-4-31B-it:fastest";

    const prompt = `Gere exatamente ${amount} perguntas de múltipla escolha EM PORTUGUÊS (PT-BR), baseadas rigorosamente neste texto:
"${text}"

REGRAS DE DIFICULDADE (MUITO IMPORTANTE):
1. As opções alternativas de resposta devem ser conceitualmente muito parecidas e plausíveis, para gerar alto nível de dúvida.
2. As opções A, B, C e D devem ter comprimentos visuais idênticos ou muito parecidos. A alternativa correta NÃO DEVE ser a opção de texto mais longo, nem a mais bem explicativa. Camufle-a deixado-a com tamanho padrão/normal.

Você DEVE retornar APENAS UM JSON VÁLIDO e NADA MAIS. Não inclua \`\`\`json ou marcações markdown, retorne a string bruta do JSON.
Use este esquema exato:
{
  "questions": [
    {
      "pergunta": "...",
      "opcao_a": "...",
      "opcao_b": "...",
      "opcao_c": "...",
      "opcao_d": "...",
      "resposta_correta": "A",
      "explicacao": "...",
      "nivel": "Fácil, Médio ou Difícil",
      "tipo": "objetiva"
    }
  ]
}
A "resposta_correta" deve ser estritamente uma única letra maiúscula: "A", "B", "C" ou "D". A marcação de 'tipo' deve ser exata 'objetiva'.`;

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: "user", content: prompt }
            ]
        })
    });

    if (!response.ok) {
        let errMsg = "Falha na comunicação com a API HuggingFace Router";
        try {
            const errBody = await response.json();
            if (errBody.error) errMsg = errBody.error;
        } catch (e) { }

        throw new Error(`Erro ${response.status}: ${errMsg}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Clean potential markdown blocks
    content = content.replace(/```json/gi, '').replace(/```/gi, '').trim();

    return JSON.parse(content);
}


// --- QUIZ LOGIC ---
function startQuiz() {
    if (state.questions.length === 0) return;

    // Clone questions so we don't mess up the original CSV order if user restarts
    state.activeQuestions = JSON.parse(JSON.stringify(state.questions));

    // Always shuffle questions globally
    state.activeQuestions = shuffleArray(state.activeQuestions);

    // If options shuffle is enabled, we shuffle the choices inside the state directly and update the correct answer reference
    if (state.settings.shuffleOptions) {
        state.activeQuestions.forEach(q => {
            let opts = [
                { key: 'A', text: q.opcao_a },
                { key: 'B', text: q.opcao_b },
                { key: 'C', text: q.opcao_c },
                { key: 'D', text: q.opcao_d }
            ];
            
            opts = shuffleArray(opts);
            const correctOpt = opts.find(o => o.key === q.resposta_correta);
            
            q.opcao_a = opts[0].text;
            q.opcao_b = opts[1].text;
            q.opcao_c = opts[2].text;
            q.opcao_d = opts[3].text;
            
            if (opts[0] === correctOpt) q.resposta_correta = 'A';
            else if (opts[1] === correctOpt) q.resposta_correta = 'B';
            else if (opts[2] === correctOpt) q.resposta_correta = 'C';
            else if (opts[3] === correctOpt) q.resposta_correta = 'D';
        });
    }

    // Reset state
    state.currentQIndex = 0;
    state.userAnswers = new Array(state.activeQuestions.length).fill(null);

    // Setup UI Based on Mode
    if (state.settings.mode === 'single') {
        quizSingleContainer.classList.remove('hidden');
        quizAllContainer.classList.add('hidden');
        document.querySelector('.quiz-header').classList.remove('hidden');
        qTotalEl.textContent = state.activeQuestions.length;
        renderSingleQuestion(0);
    } else {
        quizSingleContainer.classList.add('hidden');
        quizAllContainer.classList.remove('hidden');
        document.querySelector('.quiz-header').classList.add('hidden');
        renderAllQuestions();
    }

    showScreen('quiz');
}

function getOptionsForQuestion(qInfo) {
    return [
        { key: 'A', text: qInfo.opcao_a },
        { key: 'B', text: qInfo.opcao_b },
        { key: 'C', text: qInfo.opcao_c },
        { key: 'D', text: qInfo.opcao_d }
    ];
}

// Badge Helper
function createBadgeHTML(nivelStr) {
    if (!nivelStr) return '';
    const nivel = nivelStr.trim();
    const lower = nivel.toLowerCase();
    let badgeClass = 'badge-nivel ';
    if (lower.includes('fácil') || lower.includes('facil')) badgeClass += 'badge-facil';
    else if (lower.includes('difícil') || lower.includes('dificil')) badgeClass += 'badge-dificil';
    else badgeClass += 'badge-medio';
    return `<span class="${badgeClass}">${nivel}</span>`;
}

// SINGLGE MODE
function renderSingleQuestion(index) {
    const qInfo = state.activeQuestions[index];
    qCurrentEl.textContent = index + 1;
    progressFill.style.width = `${((index + 1) / state.activeQuestions.length) * 100}%`;

    const badgeContainer = document.getElementById('single-badge-container');
    if (badgeContainer) {
        badgeContainer.innerHTML = createBadgeHTML(qInfo.nivel);
    }

    questionTextEl.textContent = qInfo.pergunta;
    optionsContainer.innerHTML = '';
    explanationContainer.classList.add('hidden');

    if (qInfo.tipo === 'discursiva') {
        const textarea = document.createElement('textarea');
        textarea.className = 'discursive-answer full-width';
        textarea.placeholder = "Digite sua resposta detalhada aqui...";
        textarea.rows = 5;
        if (state.userAnswers[index] !== null) {
            textarea.value = state.userAnswers[index];
        }
        
        textarea.addEventListener('input', (e) => {
            state.userAnswers[index] = e.target.value;
        });

        optionsContainer.appendChild(textarea);
    } else {
        const opts = getOptionsForQuestion(qInfo);

        opts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span style="font-weight:bold; margin-right:8px;">${opt.key}.</span> ${opt.text}`;

            const hasAnswered = state.userAnswers[index] !== null;

            // Re-apply states if previously answered
            if (hasAnswered) {
                if (state.settings.immediateFeedback) {
                    btn.disabled = true;
                }
                if (opt.key === state.userAnswers[index]) {
                    btn.classList.add('selected');
                    if (state.settings.immediateFeedback) {
                        btn.classList.add(opt.key === qInfo.resposta_correta ? 'correct' : 'incorrect');
                    }
                }
                if (state.settings.immediateFeedback && opt.key === qInfo.resposta_correta) {
                    btn.classList.add('correct');
                }
            }

            // Se ainda não respondeu OU se não for feedback imediato (pode editar)
            if (!hasAnswered || !state.settings.immediateFeedback) {
                btn.addEventListener('click', function () { handleOptionSelect(index, opt.key, this); });
            }

            optionsContainer.appendChild(btn);
        });

        if (state.settings.immediateFeedback && state.userAnswers[index] !== null && qInfo.explicacao) {
            explanationText.textContent = qInfo.explicacao;
            explanationContainer.classList.remove('hidden');
        }
    }

    // Buttons logic
    btnPrevQ.className = `btn btn-outline ${(!state.settings.allowBack || index === 0) ? 'hidden' : ''}`;

    if (index === state.activeQuestions.length - 1) {
        btnNextQ.classList.add('hidden');
        btnFinishQ.classList.remove('hidden');
    } else {
        btnNextQ.classList.remove('hidden');
        btnFinishQ.classList.add('hidden');
    }
}

function handleOptionSelect(qIndex, selectedKey, btnElement) {
    if (state.settings.immediateFeedback && state.userAnswers[qIndex] !== null) return; // Prevent multi-click in immediate
    state.userAnswers[qIndex] = selectedKey;

    if (!state.settings.immediateFeedback) {
        // Visually update current view before re-rendering
        Array.from(optionsContainer.children).forEach(b => b.classList.remove('selected'));
        btnElement.classList.add('selected', 'clicked-pulse');

        // Auto-advance after animation if not the last question
        setTimeout(() => {
            if (state.currentQIndex === qIndex && state.currentQIndex < state.activeQuestions.length - 1) {
                changeQuestion(1);
            } else {
                renderSingleQuestion(qIndex);
            }
        }, 400);
    } else {
        renderSingleQuestion(qIndex); // Re-render to show states instantly (immediate mode)
    }
}

function changeQuestion(dir) {
    let newIndex = state.currentQIndex + dir;
    if (newIndex >= 0 && newIndex < state.activeQuestions.length) {
        state.currentQIndex = newIndex;
        renderSingleQuestion(state.currentQIndex);
    }
}

// ALL MODE
function renderAllQuestions() {
    allQuestionsList.innerHTML = '';
    state.activeQuestions.forEach((qInfo, index) => {
        const qBlock = document.createElement('div');
        qBlock.className = 'question-container';
        qBlock.style.borderBottom = '1px solid #eee';
        qBlock.style.paddingBottom = '20px';

        const title = document.createElement('h3');
        title.innerHTML = `${createBadgeHTML(qInfo.nivel)}<br>${index + 1}. ${qInfo.pergunta}`;
        qBlock.appendChild(title);

        const optsContainer = document.createElement('div');
        optsContainer.className = 'options-container';

        if (qInfo.tipo === 'discursiva') {
            const textarea = document.createElement('textarea');
            textarea.className = 'discursive-answer full-width';
            textarea.placeholder = "Digite sua resposta detalhada aqui...";
            textarea.rows = 4;
            if (state.userAnswers[index] !== null) {
                textarea.value = state.userAnswers[index];
            }
            
            textarea.addEventListener('input', (e) => {
                state.userAnswers[index] = e.target.value;
            });
            
            optsContainer.appendChild(textarea);
        } else {
            const opts = getOptionsForQuestion(qInfo);

            opts.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerHTML = `<span style="font-weight:bold; margin-right:8px;">${opt.key}.</span> ${opt.text}`;

                btn.addEventListener('click', () => {
                    state.userAnswers[index] = opt.key;
                    // visually mark Selection
                    Array.from(optsContainer.children).forEach(c => c.classList.remove('selected'));
                    btn.classList.add('selected');

                    if (state.settings.immediateFeedback) {
                        Array.from(optsContainer.children).forEach(c => c.disabled = true);
                        if (opt.key === qInfo.resposta_correta) btn.classList.add('correct');
                        else btn.classList.add('incorrect');

                        // highlight correct anyway
                        const correctBtnIndex = opts.findIndex(o => o.key === qInfo.resposta_correta);
                        if (correctBtnIndex !== -1) optsContainer.children[correctBtnIndex].classList.add('correct');

                        if (qInfo.explicacao) {
                            const exp = document.createElement('div');
                            exp.className = 'explanation-box';
                            exp.innerHTML = `<h4>Explicação:</h4><p>${qInfo.explicacao}</p>`;
                            qBlock.appendChild(exp);
                        }
                    }
                });
                optsContainer.appendChild(btn);
            });
        }

        qBlock.appendChild(optsContainer);
        allQuestionsList.appendChild(qBlock);
    });
}


// --- RESULTS ---
function finishQuiz() {
    // Check if user answered everything (optional warning, but we allow submission)
    const answeredCount = state.userAnswers.filter(a => a !== null).length;
    if (answeredCount < state.activeQuestions.length) {
        if (!confirm('Você não respondeu todas as perguntas. Deseja finalizar assim mesmo?')) return;
    }

    calculateResults();
    showScreen('result');
}

function calculateResults() {
    let correct = 0;
    let totalObjectives = 0;
    let hasDiscursive = false;

    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = '';

    state.activeQuestions.forEach((q, i) => {
        const uAns = state.userAnswers[i];
        
        // Review Card
        const item = document.createElement('div');
        item.className = 'review-item';
        
        let customBlock = "";

        if (q.tipo === 'discursiva') {
            hasDiscursive = true;
            const userText = uAns ? uAns : "<i>Não respondeu</i>";
            customBlock = `
                <p>Sua resposta: <div class="discursive-review">${userText}</div></p>
                <p><span class="status pendent">Aguardando Avaliação</span></p>
            `;
        } else {
            totalObjectives++;
            const isCorrect = uAns === q.resposta_correta;
            if (isCorrect) correct++;

            let ansText = "Não respondeu";
            let ansClass = "errou";
            if (uAns) {
                const answerContent = q['opcao_' + uAns.toLowerCase()];
                ansText = `Opção ${uAns} - ${answerContent}`;
                ansClass = isCorrect ? "acertou" : "errou";
            }

            const correctContent = q['opcao_' + q.resposta_correta.toLowerCase()];

            customBlock = `
                <p>Sua resposta: <span class="status ${ansClass}">${ansText}</span></p>
                ${!isCorrect ? `<p>Resposta correta: <span class="status acertou">Opção ${q.resposta_correta} - ${correctContent}</span></p>` : ''}
            `;
        }

        item.innerHTML = `
            <h4>${i + 1}. ${q.pergunta}</h4>
            ${customBlock}
            ${q.explicacao ? `<p class="exp">Explicação: ${q.explicacao}</p>` : ''}
        `;
        reviewList.appendChild(item);
    });

    const isOnlyDiscursive = totalObjectives === 0;

    if (isOnlyDiscursive) {
        document.querySelector('.score-summary').classList.add('hidden');
    } else {
        document.querySelector('.score-summary').classList.remove('hidden');
        const incorrect = totalObjectives - correct;
        const percent = Math.round((correct / totalObjectives) * 100);

        document.getElementById('res-total').textContent = totalObjectives;
        document.getElementById('res-correct').textContent = correct;
        document.getElementById('res-incorrect').textContent = incorrect;
        document.getElementById('res-percent').textContent = `${percent}%`;
    }

    if (hasDiscursive) {
        btnEvalDiscursive.classList.remove('hidden');
    } else {
        btnEvalDiscursive.classList.add('hidden');
    }
}

function generateEvaluationPrompt() {
    let promptBase = "Aja como um professor rigoroso. Avalie as seguintes respostas discursivas do aluno e atribua uma nota/crítica detalhada para cada uma:\\n\\n";
    state.activeQuestions.forEach((q, i) => {
        if (q.tipo === 'discursiva') {
            const uAns = state.userAnswers[i] || "Não respondeu";
            promptBase += `PERGUNTA ${i+1}: ${q.pergunta}\\nRESPOSTA DO ALUNO: ${uAns}\\n\\n---\\n\\n`;
        }
    });

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(promptBase).then(() => {
            const origin = btnEvalDiscursive.innerHTML;
            btnEvalDiscursive.innerHTML = "✅ Copiado!";
            setTimeout(() => { btnEvalDiscursive.innerHTML = origin; }, 2000);
        });
    } else {
        alert("Não foi possível copiar. Seu navegador não suporta clipboard automático sem contexto seguro.");
    }
}

function redoQuiz() {
    // Limpa respostas e volta pro config
    state.userAnswers = [];
    showScreen('config');
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
