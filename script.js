// --- STATE MANAGEMENT ---
const state = {
    questions: [],
    activeQuestions: [],
    currentQIndex: 0,
    userAnswers: [],
    discursiveCorrections: {},
    settings: {
        immediateFeedback: false,
        shuffleOptions: true,
        allowBack: true,
        mode: "single"
    }
};

const OPTION_KEYS = ["A", "B", "C", "D"];
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "google/gemma-4-31B-it:fastest";
const HF_TOKEN = "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";
const QUESTION_TYPE_MAP = {
    objetivas: "objetiva",
    objetiva: "objetiva",
    discursivas: "discursiva",
    discursiva: "discursiva",
    mistas: "mista",
    mista: "mista",
    verdadeiro_falso: "vf",
    "verdadeiro ou falso": "vf",
    vf: "vf",
    v_f: "vf"
};

// --- DOM ELEMENTS ---
const screens = document.querySelectorAll(".screen");

const promptTheme = document.getElementById("prompt-theme");
const promptCsvAmount = document.getElementById("prompt-csv-amount");
const promptQType = document.getElementById("prompt-q-type");
const promptContent = document.getElementById("prompt-content");
const btnGeneratePrompt = document.getElementById("btn-generate-prompt");
const promptResultContainer = document.getElementById("prompt-result-container");
const promptResult = document.getElementById("prompt-result");
const btnCopyPrompt = document.getElementById("btn-copy-prompt");
const btnGoCsvImport = document.getElementById("btn-go-csv-import");
const csvInput = document.getElementById("csv-input");
const btnUploadCsv = document.getElementById("btn-upload-csv");
const btnShowPasteCsv = document.getElementById("btn-show-paste-csv");
const pasteCsvBox = document.getElementById("paste-csv-box");
const csvTextInput = document.getElementById("csv-text-input");
const btnImportCsvText = document.getElementById("btn-import-csv-text");

const aiTheme = document.getElementById("ai-theme");
const aiContext = document.getElementById("ai-context");
const aiQAmount = document.getElementById("ai-q-amount");
const aiQType = document.getElementById("ai-q-type");
const btnGotoAi = document.getElementById("btn-goto-ai");
const btnGenerateAi = document.getElementById("btn-generate-ai");

const btnStartQuiz = document.getElementById("btn-start-quiz");
const btnPrevQ = document.getElementById("btn-prev-q");
const btnNextQ = document.getElementById("btn-next-q");
const btnFinishQ = document.getElementById("btn-finish-q");
const btnSubmitAll = document.getElementById("btn-submit-all");
const btnRedoQuiz = document.getElementById("btn-redo-quiz");
const btnNewQuiz = document.getElementById("btn-new-quiz");
const btnEvalDiscursive = document.getElementById("btn-eval-discursive");
const btnCorrectDiscursiveAi = document.getElementById("btn-correct-discursive-ai");
const btnQuitQuiz = document.getElementById("btn-quit-quiz");
const correctionStatus = document.getElementById("discursive-correction-status");
const backBtns = document.querySelectorAll(".btn-back");

const qCurrentEl = document.getElementById("q-current");
const qTotalEl = document.getElementById("q-total");
const progressFill = document.getElementById("progress-fill");
const questionTextEl = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const explanationContainer = document.getElementById("explanation-container");
const explanationText = document.getElementById("explanation-text");
const quizSingleContainer = document.getElementById("quiz-single-container");
const quizAllContainer = document.getElementById("quiz-all-container");
const allQuestionsList = document.getElementById("all-questions-list");

const cfgImmediate = document.getElementById("cfg-immediate");
const cfgShuffle = document.getElementById("cfg-shuffle-options");
const cfgAllowBack = document.getElementById("cfg-allow-back");
const cfgMode = document.getElementById("cfg-mode");

// --- INIT & UTILS ---
function init() {
    loadSettings();
    attachListeners();
}

function showScreen(screenId) {
    screens.forEach((screen) => {
        screen.classList.add("hidden");
        screen.classList.remove("active");
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.classList.remove("hidden");
        targetScreen.classList.add("active");
    }
}

function attachListeners() {
    backBtns.forEach((btn) => {
        btn.addEventListener("click", (event) => {
            if (event.currentTarget.id === "btn-quit-quiz") {
                const confirmed = window.confirm("Tem certeza? Seu progresso atual será perdido.");
                if (!confirmed) {
                    return;
                }
            }

            showScreen(event.currentTarget.dataset.target);
        });
    });

    btnGotoAi.addEventListener("click", () => showScreen("ai"));
    document.getElementById("btn-start-csv").addEventListener("click", () => showScreen("csv-prompt"));
    document.getElementById("btn-skip-to-import").addEventListener("click", () => showScreen("csv-import"));

    btnGeneratePrompt.addEventListener("click", generateCSVPrompt);
    promptQType.addEventListener("change", () => {
        if (!promptResultContainer.classList.contains("hidden")) {
            generateCSVPrompt();
        }
    });

    btnCopyPrompt.addEventListener("click", copyCSVPrompt);
    btnGoCsvImport.addEventListener("click", () => showScreen("csv-import"));
    btnUploadCsv.addEventListener("click", () => csvInput.click());
    btnShowPasteCsv.addEventListener("click", togglePasteCSVBox);
    csvInput.addEventListener("change", handleCSVUpload);
    btnImportCsvText.addEventListener("click", handleCSVTextImport);
    btnGenerateAi.addEventListener("click", handleAIGeneration);
    btnStartQuiz.addEventListener("click", startQuiz);

    btnPrevQ.addEventListener("click", () => changeQuestion(-1));
    btnNextQ.addEventListener("click", () => changeQuestion(1));
    btnFinishQ.addEventListener("click", finishQuiz);
    btnSubmitAll.addEventListener("click", finishQuiz);

    btnRedoQuiz.addEventListener("click", redoQuiz);
    btnNewQuiz.addEventListener("click", () => {
        resetLoadedQuiz([]);
        showScreen("home");
    });

    btnEvalDiscursive.addEventListener("click", generateEvaluationPrompt);
    btnCorrectDiscursiveAi.addEventListener("click", correctDiscursiveAnswersWithAI);

    [cfgImmediate, cfgShuffle, cfgAllowBack, cfgMode].forEach((element) => {
        element.addEventListener("change", saveSettings);
    });
}

function shuffleArray(array) {
    let currentIndex = array.length;

    while (currentIndex !== 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        const temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function hasAnswer(answer) {
    if (typeof answer === "string") {
        return answer.trim() !== "";
    }

    return answer !== null && answer !== undefined;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function resetLoadedQuiz(questions) {
    state.questions = questions;
    state.activeQuestions = [];
    state.currentQIndex = 0;
    state.userAnswers = [];
    state.discursiveCorrections = {};
    setCorrectionStatus("");
    btnCorrectDiscursiveAi.disabled = false;
    btnCorrectDiscursiveAi.textContent = "Corrigir com a Study Buddy AI";
}

function setCorrectionStatus(message, tone = "neutral") {
    correctionStatus.classList.remove("hidden", "status-loading", "status-success", "status-error");

    if (!message) {
        correctionStatus.textContent = "";
        correctionStatus.classList.add("hidden");
        return;
    }

    correctionStatus.textContent = message;
    if (tone === "loading") {
        correctionStatus.classList.add("status-loading");
    } else if (tone === "success") {
        correctionStatus.classList.add("status-success");
    } else if (tone === "error") {
        correctionStatus.classList.add("status-error");
    }
}

function loadQuestionsIntoState(questions) {
    resetLoadedQuiz(questions);
    showScreen("config");
}

function normalizeQuestionTypeValue(rawType) {
    const normalized = String(rawType || "").trim().toLowerCase();
    return QUESTION_TYPE_MAP[normalized] || "";
}

function normalizeLevelValue(rawLevel) {
    const normalized = String(rawLevel || "").trim().toLowerCase();
    if (["facil", "fácil"].includes(normalized)) {
        return "facil";
    }
    if (["medio", "médio"].includes(normalized)) {
        return "medio";
    }
    if (["dificil", "difícil"].includes(normalized)) {
        return "dificil";
    }
    return normalized || "medio";
}

function normalizeLetterAnswer(rawAnswer) {
    const normalized = String(rawAnswer || "").trim().toUpperCase();
    return OPTION_KEYS.includes(normalized) ? normalized : "";
}

function normalizeTrueFalseAnswer(rawAnswer) {
    const normalized = String(rawAnswer || "").trim().toLowerCase();

    if (["a", "v", "verdadeiro", "true"].includes(normalized)) {
        return "A";
    }
    if (["b", "f", "falso", "false"].includes(normalized)) {
        return "B";
    }

    return "";
}

function getOptionKeysForQuestion(question) {
    return OPTION_KEYS.filter((key) => {
        const value = question[`opcao_${key.toLowerCase()}`];
        return typeof value === "string" && value.trim() !== "";
    });
}

function inferQuestionTypeFromData(rawQuestion, fallbackType = "") {
    const explicitType = normalizeQuestionTypeValue(rawQuestion.tipo || fallbackType);
    if (explicitType && explicitType !== "mista") {
        return explicitType;
    }

    const optionKeys = getOptionKeysForQuestion(rawQuestion);
    if (optionKeys.length === 0) {
        return "discursiva";
    }
    if (optionKeys.length === 2) {
        return "vf";
    }

    return "objetiva";
}

function normalizeQuestionRecord(rawQuestion, fallbackType = "") {
    const question = {
        pergunta: String(rawQuestion.pergunta || "").trim(),
        explicacao: String(rawQuestion.explicacao || "").trim(),
        tema: String(rawQuestion.tema || "").trim(),
        nivel: normalizeLevelValue(rawQuestion.nivel),
        tipo: "",
        opcao_a: String(rawQuestion.opcao_a || "").trim(),
        opcao_b: String(rawQuestion.opcao_b || "").trim(),
        opcao_c: String(rawQuestion.opcao_c || "").trim(),
        opcao_d: String(rawQuestion.opcao_d || "").trim(),
        resposta_correta: ""
    };

    if (!question.pergunta) {
        return null;
    }

    question.tipo = inferQuestionTypeFromData(question, fallbackType);

    if (question.tipo === "discursiva") {
        question.opcao_a = "";
        question.opcao_b = "";
        question.opcao_c = "";
        question.opcao_d = "";
        question.resposta_correta = "";
        return question;
    }

    if (question.tipo === "vf") {
        question.opcao_a = question.opcao_a || "Verdadeiro";
        question.opcao_b = question.opcao_b || "Falso";
        question.opcao_c = "";
        question.opcao_d = "";
        question.resposta_correta = normalizeTrueFalseAnswer(rawQuestion.resposta_correta);
        return question.resposta_correta ? question : null;
    }

    question.resposta_correta = normalizeLetterAnswer(rawQuestion.resposta_correta);
    const optionKeys = getOptionKeysForQuestion(question);

    if (optionKeys.length === 4 && optionKeys.includes(question.resposta_correta)) {
        return question;
    }

    return null;
}

function normalizeQuestionsPayload(rawQuestions, fallbackType = "") {
    if (!Array.isArray(rawQuestions)) {
        throw new Error("A IA não retornou uma lista válida de perguntas.");
    }

    const normalizedQuestions = rawQuestions
        .map((question) => normalizeQuestionRecord(question, fallbackType))
        .filter(Boolean);

    if (!normalizedQuestions.length) {
        throw new Error("A IA retornou perguntas, mas nenhuma estava em um formato utilizável.");
    }

    return normalizedQuestions;
}

// --- LOCAL STORAGE ---
function loadSettings() {
    const saved = localStorage.getItem("quizSettings");

    if (!saved) {
        return;
    }

    try {
        state.settings = JSON.parse(saved);
        cfgImmediate.checked = state.settings.immediateFeedback;
        cfgShuffle.checked = state.settings.shuffleOptions;
        cfgAllowBack.checked = state.settings.allowBack;
        cfgMode.value = state.settings.mode;
    } catch (error) {
        console.error("Erro ao carregar configurações.", error);
    }
}

function saveSettings() {
    state.settings = {
        immediateFeedback: cfgImmediate.checked,
        shuffleOptions: cfgShuffle.checked,
        allowBack: cfgAllowBack.checked,
        mode: cfgMode.value
    };

    localStorage.setItem("quizSettings", JSON.stringify(state.settings));
}

// --- QUESTION GENERATION RULES ---
function getProhibitedLanguageList() {
    return [
        "apenas",
        "somente",
        "só",
        "unicamente",
        "exclusivamente",
        "exceto",
        "a única",
        "sempre",
        "nunca",
        "jamais",
        "obrigatoriamente",
        "necessariamente",
        "proibido",
        "vedado",
        "correta",
        "incorreta",
        "errada",
        "todas",
        "nenhuma"
    ];
}

function getRulesByQuestionType(questionType) {
    const prohibitedLanguage = getProhibitedLanguageList();

    const objectiveRules = {
        tipo_obrigatorio: "objetiva",
        proibido_gerar: "questoes discursivas e verdadeiro_falso",
        regras_estruturais: [
            "Cada questão deve ter exatamente 4 opções (A, B, C, D) com uma única resposta correta.",
            "Proibido usar: 'Todas as anteriores', 'Nenhuma das anteriores', 'A e B estão corretas' ou variações.",
            "A coluna 'resposta_correta' deve conter apenas a letra maiúscula: A, B, C ou D.",
            "Distribuir a posição da resposta correta de forma equilibrada entre A, B, C e D."
        ],
        paralelismo_e_equilibrio: [
            "Todas as 4 opções devem ter comprimento textual similar (±20% de caracteres).",
            "Todas as 4 opções devem ter a mesma estrutura gramatical, formato e tom.",
            "Todas as 4 opções devem ter nível semelhante de detalhamento técnico.",
            "Proibido que a alternativa correta seja sistematicamente mais longa ou melhor escrita que as demais."
        ],
        consistencia_de_dominio: [
            "As 4 alternativas devem pertencer ao mesmo contexto conceitual e ao mesmo nível de abstração.",
            "Não misturar temas fora do tópico principal nas alternativas."
        ],
        anti_pistas: [
            "Se uma alternativa contiver um termo técnico ausente nas outras, reescrever as demais para incluir termos do mesmo domínio.",
            "Proibido que a correta seja a única com palavra técnica-chave, sigla, valor numérico, símbolo, fórmula ou exemplo.",
            "Proibido que uma alternativa seja obviamente absurda ou desconexa."
        ],
        proibicoes_linguagem: {
            palavras_proibidas_nas_alternativas_e_explicacao: prohibitedLanguage,
            proibido_negacao_forte_como_pista_principal: true,
            preferir_formulacoes_afirmativas_e_plausiveis: true
        },
        distratores: {
            descricao: "Os distratores devem representar erros conceituais reais que um aluno cometeria.",
            regras_para_as_3_incorretas: [
                "Mencionar termos técnicos do mesmo tópico.",
                "Descrever uma regra real ou próxima, mas aplicada ao caso errado.",
                "Errar por um detalhe sutil de condição, causa, efeito ou consequência."
            ],
            quase_correta: "Em cada questão, 1 alternativa errada deve ser quase correta, mas com um detalhe sutil inconsistente."
        },
        explicacao: {
            estilo: "neutra e conceitual",
            regras: [
                "Descrever o raciocínio e o critério que torna a resposta correta.",
                "Não citar letras (A, B, C, D).",
                "Não dizer 'a correta é...' nem fazer eliminação das outras.",
                "Manter curta e técnica (2-5 linhas), focada no conceito."
            ]
        }
    };

    const discursiveRules = {
        tipo_obrigatorio: "discursiva",
        proibido_gerar: "questoes de multipla escolha e verdadeiro_falso",
        regras_estruturais: [
            "As colunas opcao_a, opcao_b, opcao_c, opcao_d e resposta_correta devem ficar vazias.",
            "Formular perguntas que exijam argumentação, análise crítica, síntese ou aplicação contextualizada.",
            "Usar verbos de comando precisos: 'Analise...', 'Compare e contraste...', 'Argumente...', 'Elabore...', 'Avalie criticamente...'."
        ],
        variedade_obrigatoria_de_formatos: [
            "Definição sem pista.",
            "Identificação ou nomeação.",
            "Listagem com explicação.",
            "Aplicação em cenário real."
        ],
        anti_dica: [
            "Se a pergunta é 'O que é X?', não descrever X no enunciado.",
            "Evitar frases do tipo 'X é quando...' no próprio enunciado.",
            "Evitar entregar palavras-chave que denunciem o termo pedido."
        ],
        explicacao: {
            estilo: "checklist de correção",
            deve_conter: ["definição", "1 exemplo", "1 limitação ou contraexemplo quando aplicável", "precisão de termos"],
            proibido: "Fornecer a resposta completa pronta."
        }
    };

    const vfRules = {
        tipo_obrigatorio: "vf",
        proibido_gerar: "questoes discursivas e alternativas A-D completas",
        regras_estruturais: [
            "Cada questão deve ser classificada como verdadeiro ou falso com apenas 2 opções.",
            "Use obrigatoriamente opcao_a='Verdadeiro' e opcao_b='Falso'.",
            "As colunas opcao_c e opcao_d devem ficar vazias.",
            "A coluna resposta_correta deve conter apenas A ou B."
        ],
        qualidade_da_afirmacao: [
            "A afirmação da pergunta deve ser plausível e tecnicamente precisa para gerar dúvida real.",
            "Evitar afirmações óbvias ou absurdas.",
            "Os erros das afirmações falsas devem ser sutis, conceituais e pedagogicamente úteis."
        ],
        explicacao: {
            estilo: "curta e técnica",
            regras: [
                "Explicar o detalhe que torna a afirmação verdadeira ou falsa.",
                "Não usar linguagem vaga.",
                "Focar no conceito decisivo."
            ]
        }
    };

    if (questionType === "objetivas") {
        return objectiveRules;
    }

    if (questionType === "discursivas") {
        return discursiveRules;
    }

    if (questionType === "verdadeiro_falso") {
        return vfRules;
    }

    return {
        tipo_obrigatorio: "mix equilibrado entre objetiva, discursiva e vf",
        instrucao: "Distribuir as questões de forma equilibrada entre os três formatos, preservando o contexto do material-base.",
        para_objetivas: objectiveRules,
        para_discursivas: discursiveRules,
        para_vf: vfRules
    };
}

function getOutputFormatConfig(outputFormat, questionCount) {
    if (outputFormat === "csv") {
        return {
            tipo_saida: "csv",
            instrucao: "Retornar exclusivamente um bloco CSV puro, sem crases, sem markdown, sem saudações e sem texto antes ou depois.",
            separador: ",",
            campos_com_virgula_ou_quebra_de_linha: "envolver em aspas duplas",
            cabecalho_obrigatorio: "pergunta,opcao_a,opcao_b,opcao_c,opcao_d,resposta_correta,explicacao,tema,nivel,tipo",
            quantidade_linhas_de_dados: questionCount,
            valores_validos_coluna_tipo: ["objetiva", "discursiva", "vf"]
        };
    }

    return {
        tipo_saida: "json",
        instrucao: "Retornar exclusivamente um JSON válido, sem markdown, sem comentários e sem texto antes ou depois.",
        esquema: {
            questions: [
                {
                    pergunta: "string",
                    opcao_a: "string",
                    opcao_b: "string",
                    opcao_c: "string",
                    opcao_d: "string",
                    resposta_correta: "A|B|C|D|''",
                    explicacao: "string",
                    tema: "string",
                    nivel: "facil|medio|dificil",
                    tipo: "objetiva|discursiva|vf"
                }
            ]
        },
        regras_extras: [
            "Para tipo='discursiva', deixar opcao_a até opcao_d e resposta_correta vazios.",
            "Para tipo='vf', usar exatamente opcao_a='Verdadeiro' e opcao_b='Falso'; opcao_c e opcao_d vazios; resposta_correta=A ou B.",
            `Gerar exatamente ${questionCount} questões no array questions.`
        ]
    };
}

function buildQuestionGenerationPayload({ theme, content, questionCount, questionType, outputFormat, sourceMode }) {
    return {
        persona: "elaborador sênior de avaliações acadêmicas com expertise em design instrucional e psicometria",
        aviso_sistema: "O output será processado por um parser automatizado. Qualquer desvio de formato causa erro no sistema.",
        tarefa: "gerar_quiz_estruturado",
        origem_da_geracao: sourceMode,
        contexto: {
            tema_central: theme || "Conhecimentos Gerais",
            conteudo_especifico: content || "Abordagem ampla do tema",
            quantidade_questoes: questionCount,
            tipo_questoes: questionType
        },
        regras_por_tipo: getRulesByQuestionType(questionType),
        qualidade_pedagogica: {
            taxonomia_bloom_revisada: {
                lembrar_compreender: "~20% — definições e conceitos-base",
                aplicar_analisar: "~40% — resolução de problemas, estudos de caso e cenários práticos",
                avaliar_criar: "~40% — julgamento crítico, proposição de soluções, comparação entre abordagens"
            },
            diretrizes_de_formulacao: [
                "Preferir enunciados contextualizados com cenários, situações-problema ou estudos de caso breves.",
                "O enunciado deve ser autossuficiente.",
                "Usar linguagem formal, clara e sem ambiguidades. Evitar duplas negativas.",
                "Distribuir a coluna nivel de forma balanceada entre facil, medio e dificil."
            ]
        },
        antipadroes_proibidos: [
            "Perguntas genéricas tipo 'Qual a importância de X?' sem contexto aplicado.",
            "Alternativas que se eliminam por lógica.",
            "Enunciados com pistas gramaticais que denunciam a resposta.",
            "Repetição de palavras do enunciado apenas na alternativa correta.",
            "Questões com pegadinhas baseadas em detalhes irrelevantes."
        ],
        formato_saida: getOutputFormatConfig(outputFormat, questionCount)
    };
}

// --- CSV HANDLING ---
function togglePasteCSVBox() {
    pasteCsvBox.classList.toggle("hidden");
    btnShowPasteCsv.textContent = pasteCsvBox.classList.contains("hidden")
        ? "📋 Colar CSV"
        : "Ocultar Área de Colagem";
}

function generateCSVPrompt() {
    const theme = promptTheme.value.trim();
    const content = promptContent.value.trim();
    const questionType = promptQType.value;
    const questionCount = parseInt(promptCsvAmount.value, 10) || 10;

    if (!theme && !content) {
        alert("Preencha o tema ou o conteúdo desejado.");
        return;
    }

    const promptPayload = buildQuestionGenerationPayload({
        theme,
        content,
        questionCount,
        questionType,
        outputFormat: "csv",
        sourceMode: "ia_externa"
    });

    promptResult.value = JSON.stringify(promptPayload, null, 2);
    promptResultContainer.classList.remove("hidden");
    btnGoCsvImport.classList.remove("hidden");
    pasteCsvBox.classList.add("hidden");
    btnShowPasteCsv.textContent = "📋 Colar CSV";
}

function copyCSVPrompt() {
    const textToCopy = promptResult.value;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(showCopiedText);
        return;
    }

    promptResult.select();
    document.execCommand("copy");
    showCopiedText();
}

function showCopiedText() {
    const originalText = btnCopyPrompt.innerHTML;
    btnCopyPrompt.innerHTML = "✅ Copiado!";

    setTimeout(() => {
        btnCopyPrompt.innerHTML = originalText;
    }, 2000);
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const errorEl = document.getElementById("csv-error");
    errorEl.classList.add("hidden");

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        const text = loadEvent.target.result;

        try {
            const parsed = parseCSV(text);
            if (parsed.length === 0) {
                throw new Error("O CSV não contém perguntas válidas.");
            }

            loadQuestionsIntoState(parsed);
        } catch (error) {
            errorEl.textContent = `Erro ao ler CSV: ${error.message}`;
            errorEl.classList.remove("hidden");
        }
    };

    reader.onerror = () => {
        errorEl.textContent = "Erro ao carregar o arquivo.";
        errorEl.classList.remove("hidden");
    };

    reader.readAsText(file);
    event.target.value = null;
}

function handleCSVTextImport() {
    const errorEl = document.getElementById("csv-error");
    const csvText = csvTextInput.value.trim();

    errorEl.classList.add("hidden");

    try {
        const parsed = parseCSV(csvText);
        if (parsed.length === 0) {
            throw new Error("O CSV não contém perguntas válidas.");
        }

        loadQuestionsIntoState(parsed);
    } catch (error) {
        errorEl.textContent = `Erro ao processar o CSV colado: ${error.message}`;
        errorEl.classList.remove("hidden");
    }
}

function sanitizeCSVText(text) {
    if (!text || typeof text !== "string") {
        return "";
    }

    let normalized = text.trim().replace(/^\uFEFF/, "");
    const fencedMatch = normalized.match(/^```(?:csv)?\s*([\s\S]*?)\s*```$/i);

    if (fencedMatch) {
        normalized = fencedMatch[1].trim();
    }

    normalized = normalized
        .replace(/[\u201C\u201D]/g, "\"")
        .replace(/[\u2018\u2019]/g, "'");

    normalized = normalized.replace(/[}\]]+\s*$/, "").trim();

    return normalized;
}

function normalizeCSVHeader(header) {
    const normalized = String(header || "").trim().toLowerCase();
    const headerMap = {
        alternativa_a: "opcao_a",
        alternativa_b: "opcao_b",
        alternativa_c: "opcao_c",
        alternativa_d: "opcao_d",
        resposta: "resposta_correta",
        justificativa: "explicacao"
    };

    return headerMap[normalized] || normalized;
}

function parseCSV(text) {
    const sanitized = sanitizeCSVText(text);
    if (!sanitized) {
        return [];
    }

    const pattern = new RegExp(
        "(\\,|\\r?\\n|\\r|^)(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^\"\\,\\r\\n]*))",
        "gi"
    );

    const data = [[]];
    let matches = null;

    while ((matches = pattern.exec(sanitized)) !== null) {
        const matchedDelimiter = matches[1];
        if (matchedDelimiter.length && matchedDelimiter !== ",") {
            data.push([]);
        }

        const matchedValue = matches[2]
            ? matches[2].replace(/""/g, "\"")
            : matches[3];

        data[data.length - 1].push(matchedValue);
    }

    if (data.length < 2) {
        return [];
    }

    const headers = data[0].map((header) => normalizeCSVHeader(header));
    if (!headers.includes("pergunta")) {
        throw new Error("A coluna 'pergunta' é obrigatória no CSV.");
    }

    const questions = [];

    for (let index = 1; index < data.length; index += 1) {
        const row = data[index];
        if (!row.length) {
            continue;
        }

        const rawQuestion = {};
        headers.forEach((header, headerIndex) => {
            if (header) {
                rawQuestion[header] = row[headerIndex] ? row[headerIndex].trim() : "";
            }
        });

        const normalizedQuestion = normalizeQuestionRecord(rawQuestion);
        if (normalizedQuestion) {
            questions.push(normalizedQuestion);
        }
    }

    return questions;
}

// --- AI HELPERS ---
function getHuggingFaceToken() {
    const token = window.HF_TOKEN || localStorage.getItem("hf_token") || HF_TOKEN || "";

    if (!token || token === "YOUR_HUGGINGFACE_TOKEN_HERE") {
        throw new Error("Defina seu token do Hugging Face no frontend.");
    }

    return token;
}

function extractAIMessageContent(data) {
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === "string") {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                }

                if (item?.type === "text") {
                    return item.text || "";
                }

                return "";
            })
            .join("\n")
            .trim();
    }

    throw new Error("A resposta da IA veio sem conteúdo legível.");
}

function extractJsonBlock(rawContent) {
    const content = String(rawContent || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("A IA não retornou um JSON utilizável.");
    }

    return jsonMatch[0];
}

async function requestStudyBuddyAI({ systemPrompt, userPayload, temperature = 0.35 }) {
    const token = getHuggingFaceToken();

    const response = await fetch(HF_ROUTER_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: HF_MODEL,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload, null, 2)
                }
            ],
            temperature
        })
    });

    if (!response.ok) {
        let errorMessage = "Falha na comunicação com a Study Buddy AI.";

        try {
            const errorBody = await response.json();
            if (errorBody.error) {
                errorMessage = typeof errorBody.error === "string"
                    ? errorBody.error
                    : JSON.stringify(errorBody.error);
            }
        } catch (error) {
            console.error("Erro ao ler payload de erro da API.", error);
        }

        throw new Error(`Erro ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return extractAIMessageContent(data);
}

function parseAIQuestionsResponse(rawContent, requestedType) {
    const parsed = JSON.parse(extractJsonBlock(rawContent));
    return normalizeQuestionsPayload(parsed.questions, requestedType);
}

function parseDiscursiveCorrectionsResponse(rawContent) {
    const parsed = JSON.parse(extractJsonBlock(rawContent));
    const evaluations = Array.isArray(parsed.avaliacoes) ? parsed.avaliacoes : [];

    if (!evaluations.length) {
        throw new Error("A IA não retornou avaliações discursivas válidas.");
    }

    const corrections = {};
    evaluations.forEach((evaluation) => {
        const index = Number(evaluation.indice);
        if (Number.isNaN(index)) {
            return;
        }

        corrections[index] = {
            nota: Number(evaluation.nota),
            avaliacao: String(evaluation.avaliacao || "").trim(),
            pontos_fortes: Array.isArray(evaluation.pontos_fortes) ? evaluation.pontos_fortes.map(String) : [],
            lacunas: Array.isArray(evaluation.lacunas) ? evaluation.lacunas.map(String) : [],
            sugestao_melhoria: String(evaluation.sugestao_melhoria || "").trim(),
            resposta_esperada_resumida: String(evaluation.resposta_esperada_resumida || "").trim()
        };
    });

    if (!Object.keys(corrections).length) {
        throw new Error("A IA respondeu, mas sem correções discursivas utilizáveis.");
    }

    return corrections;
}

// --- AI GENERATION ---
async function handleAIGeneration() {
    const text = aiContext.value.trim();
    const theme = aiTheme.value.trim();
    const requestedType = aiQType.value;
    const questionCount = parseInt(aiQAmount.value, 10) || 5;
    const errorEl = document.getElementById("ai-error");
    const loadingEl = document.getElementById("ai-loading");

    if (!text) {
        errorEl.textContent = "Por favor, insira um texto base.";
        errorEl.classList.remove("hidden");
        return;
    }

    errorEl.classList.add("hidden");
    loadingEl.classList.remove("hidden");

    try {
        const payload = buildQuestionGenerationPayload({
            theme: theme || "Conteúdo do material colado",
            content: text,
            questionCount,
            questionType: requestedType,
            outputFormat: "json",
            sourceMode: "ia_nativa_do_site"
        });

        const rawContent = await requestStudyBuddyAI({
            systemPrompt: "Você é a Study Buddy AI. Gere quizzes em JSON válido, sem markdown e sem texto extra.",
            userPayload: payload,
            temperature: 0.35
        });

        const questions = parseAIQuestionsResponse(rawContent, requestedType);
        loadQuestionsIntoState(questions);
    } catch (error) {
        errorEl.textContent = `Erro na IA: ${error.message}`;
        errorEl.classList.remove("hidden");
    } finally {
        loadingEl.classList.add("hidden");
    }
}

// --- QUIZ LOGIC ---
function startQuiz() {
    if (state.questions.length === 0) {
        return;
    }

    state.activeQuestions = JSON.parse(JSON.stringify(state.questions));
    state.activeQuestions = shuffleArray(state.activeQuestions);
    state.discursiveCorrections = {};
    setCorrectionStatus("");

    if (state.settings.shuffleOptions) {
        state.activeQuestions.forEach((question) => {
            if (question.tipo === "discursiva" || question.tipo === "vf") {
                return;
            }

            let options = getOptionsForQuestion(question);
            if (options.length < 2) {
                return;
            }

            options = shuffleArray(options);
            const correctOption = options.find((option) => option.key === question.resposta_correta);

            OPTION_KEYS.forEach((key, index) => {
                question[`opcao_${key.toLowerCase()}`] = options[index] ? options[index].text : "";
            });

            if (correctOption) {
                question.resposta_correta = OPTION_KEYS[options.indexOf(correctOption)];
            }
        });
    }

    state.currentQIndex = 0;
    state.userAnswers = new Array(state.activeQuestions.length).fill(null);

    if (state.settings.mode === "single") {
        quizSingleContainer.classList.remove("hidden");
        quizAllContainer.classList.add("hidden");
        document.querySelector(".quiz-header").classList.remove("hidden");
        qTotalEl.textContent = state.activeQuestions.length;
        renderSingleQuestion(0);
    } else {
        quizSingleContainer.classList.add("hidden");
        quizAllContainer.classList.remove("hidden");
        document.querySelector(".quiz-header").classList.add("hidden");
        renderAllQuestions();
    }

    showScreen("quiz");
}

function getOptionsForQuestion(question) {
    return getOptionKeysForQuestion(question).map((key) => ({
        key,
        text: question[`opcao_${key.toLowerCase()}`]
    }));
}

function getQuestionTypeBadge(questionType) {
    if (questionType === "discursiva") {
        return '<span class="badge-tipo badge-discursiva">Discursiva</span>';
    }
    if (questionType === "vf") {
        return '<span class="badge-tipo badge-vf">V/F</span>';
    }
    return '<span class="badge-tipo badge-objetiva">Objetiva</span>';
}

function createBadgeHTML(levelText) {
    if (!levelText) {
        return "";
    }

    const level = levelText.trim();
    const lowerLevel = level.toLowerCase();
    let badgeClass = "badge-nivel ";

    if (lowerLevel.includes("fácil") || lowerLevel.includes("facil")) {
        badgeClass += "badge-facil";
    } else if (lowerLevel.includes("difícil") || lowerLevel.includes("dificil")) {
        badgeClass += "badge-dificil";
    } else {
        badgeClass += "badge-medio";
    }

    return `<span class="${badgeClass}">${escapeHtml(level)}</span>`;
}

function renderSingleQuestion(index) {
    const question = state.activeQuestions[index];
    qCurrentEl.textContent = index + 1;
    progressFill.style.width = `${((index + 1) / state.activeQuestions.length) * 100}%`;

    const badgeContainer = document.getElementById("single-badge-container");
    if (badgeContainer) {
        badgeContainer.innerHTML = `${createBadgeHTML(question.nivel)}${getQuestionTypeBadge(question.tipo)}`;
    }

    questionTextEl.textContent = question.pergunta;
    optionsContainer.innerHTML = "";
    explanationContainer.classList.add("hidden");

    if (question.tipo === "discursiva") {
        const textarea = document.createElement("textarea");
        textarea.className = "discursive-answer full-width";
        textarea.placeholder = "Digite sua resposta detalhada aqui...";
        textarea.rows = 5;

        if (typeof state.userAnswers[index] === "string") {
            textarea.value = state.userAnswers[index];
        }

        textarea.addEventListener("input", (event) => {
            state.userAnswers[index] = event.target.value;
        });

        optionsContainer.appendChild(textarea);
    } else {
        const options = getOptionsForQuestion(question);

        options.forEach((option) => {
            const button = document.createElement("button");
            button.className = "option-btn";
            button.innerHTML = `<span class="option-key">${option.key}.</span> ${escapeHtml(option.text)}`;

            const hasAnsweredQuestion = hasAnswer(state.userAnswers[index]);

            if (hasAnsweredQuestion) {
                if (state.settings.immediateFeedback) {
                    button.disabled = true;
                }

                if (option.key === state.userAnswers[index]) {
                    button.classList.add("selected");
                    if (state.settings.immediateFeedback) {
                        button.classList.add(option.key === question.resposta_correta ? "correct" : "incorrect");
                    }
                }

                if (state.settings.immediateFeedback && option.key === question.resposta_correta) {
                    button.classList.add("correct");
                }
            }

            if (!hasAnsweredQuestion || !state.settings.immediateFeedback) {
                button.addEventListener("click", function () {
                    handleOptionSelect(index, option.key, this);
                });
            }

            optionsContainer.appendChild(button);
        });

        if (state.settings.immediateFeedback && hasAnswer(state.userAnswers[index]) && question.explicacao) {
            explanationText.textContent = question.explicacao;
            explanationContainer.classList.remove("hidden");
        }
    }

    btnPrevQ.className = `btn btn-outline ${(!state.settings.allowBack || index === 0) ? "hidden" : ""}`;

    if (index === state.activeQuestions.length - 1) {
        btnNextQ.classList.add("hidden");
        btnFinishQ.classList.remove("hidden");
    } else {
        btnNextQ.classList.remove("hidden");
        btnFinishQ.classList.add("hidden");
    }
}

function handleOptionSelect(questionIndex, selectedKey, buttonElement) {
    if (state.settings.immediateFeedback && hasAnswer(state.userAnswers[questionIndex])) {
        return;
    }

    state.userAnswers[questionIndex] = selectedKey;

    if (!state.settings.immediateFeedback) {
        Array.from(optionsContainer.children).forEach((button) => button.classList.remove("selected"));
        buttonElement.classList.add("selected", "clicked-pulse");

        setTimeout(() => {
            if (state.currentQIndex === questionIndex && state.currentQIndex < state.activeQuestions.length - 1) {
                changeQuestion(1);
            } else {
                renderSingleQuestion(questionIndex);
            }
        }, 400);

        return;
    }

    renderSingleQuestion(questionIndex);
}

function changeQuestion(direction) {
    const newIndex = state.currentQIndex + direction;
    if (newIndex >= 0 && newIndex < state.activeQuestions.length) {
        state.currentQIndex = newIndex;
        renderSingleQuestion(state.currentQIndex);
    }
}

function renderAllQuestions() {
    allQuestionsList.innerHTML = "";

    state.activeQuestions.forEach((question, index) => {
        const questionBlock = document.createElement("div");
        questionBlock.className = "question-container question-block";

        const title = document.createElement("h3");
        title.innerHTML = `${createBadgeHTML(question.nivel)}${getQuestionTypeBadge(question.tipo)}<br>${index + 1}. ${escapeHtml(question.pergunta)}`;
        questionBlock.appendChild(title);

        const optionsBlock = document.createElement("div");
        optionsBlock.className = "options-container";

        if (question.tipo === "discursiva") {
            const textarea = document.createElement("textarea");
            textarea.className = "discursive-answer full-width";
            textarea.placeholder = "Digite sua resposta detalhada aqui...";
            textarea.rows = 4;

            if (typeof state.userAnswers[index] === "string") {
                textarea.value = state.userAnswers[index];
            }

            textarea.addEventListener("input", (event) => {
                state.userAnswers[index] = event.target.value;
            });

            optionsBlock.appendChild(textarea);
        } else {
            const options = getOptionsForQuestion(question);

            options.forEach((option) => {
                const button = document.createElement("button");
                button.className = "option-btn";
                button.innerHTML = `<span class="option-key">${option.key}.</span> ${escapeHtml(option.text)}`;

                const selectedAnswer = state.userAnswers[index];
                const hasAnsweredQuestion = hasAnswer(selectedAnswer);

                if (hasAnsweredQuestion && option.key === selectedAnswer) {
                    button.classList.add("selected");
                }

                if (state.settings.immediateFeedback && hasAnsweredQuestion) {
                    button.disabled = true;

                    if (option.key === question.resposta_correta) {
                        button.classList.add("correct");
                    } else if (option.key === selectedAnswer) {
                        button.classList.add("incorrect");
                    }
                }

                if (!state.settings.immediateFeedback || !hasAnsweredQuestion) {
                    button.addEventListener("click", () => {
                        state.userAnswers[index] = option.key;

                        if (state.settings.immediateFeedback) {
                            renderAllQuestions();
                        } else {
                            Array.from(optionsBlock.children).forEach((child) => child.classList.remove("selected"));
                            button.classList.add("selected");
                        }
                    });
                }

                optionsBlock.appendChild(button);
            });
        }

        questionBlock.appendChild(optionsBlock);

        if (question.tipo !== "discursiva" && state.settings.immediateFeedback && hasAnswer(state.userAnswers[index]) && question.explicacao) {
            const explanation = document.createElement("div");
            explanation.className = "explanation-box";
            explanation.innerHTML = `<h4>Explicação:</h4><p>${escapeHtml(question.explicacao)}</p>`;
            questionBlock.appendChild(explanation);
        }

        allQuestionsList.appendChild(questionBlock);
    });
}

// --- RESULTS ---
function finishQuiz() {
    const answeredCount = state.userAnswers.filter((answer) => hasAnswer(answer)).length;

    if (answeredCount < state.activeQuestions.length) {
        const confirmed = window.confirm("Você não respondeu todas as perguntas. Deseja finalizar assim mesmo?");
        if (!confirmed) {
            return;
        }
    }

    calculateResults();
    showScreen("result");
}

function createCorrectionElement(correction) {
    const correctionBox = document.createElement("div");
    correctionBox.className = "ai-correction-box";

    const title = document.createElement("h5");
    title.textContent = `Correção da Study Buddy AI — Nota ${Number.isFinite(correction.nota) ? correction.nota.toFixed(1) : "-"} / 10`;
    correctionBox.appendChild(title);

    if (correction.avaliacao) {
        const summary = document.createElement("p");
        summary.className = "ai-correction-summary";
        summary.textContent = correction.avaliacao;
        correctionBox.appendChild(summary);
    }

    if (correction.pontos_fortes.length) {
        const strengthsTitle = document.createElement("p");
        strengthsTitle.className = "ai-correction-label";
        strengthsTitle.textContent = "Pontos fortes:";
        correctionBox.appendChild(strengthsTitle);

        const strengthsList = document.createElement("ul");
        strengthsList.className = "ai-correction-list";
        correction.pontos_fortes.forEach((item) => {
            const listItem = document.createElement("li");
            listItem.textContent = item;
            strengthsList.appendChild(listItem);
        });
        correctionBox.appendChild(strengthsList);
    }

    if (correction.lacunas.length) {
        const gapsTitle = document.createElement("p");
        gapsTitle.className = "ai-correction-label";
        gapsTitle.textContent = "Lacunas:";
        correctionBox.appendChild(gapsTitle);

        const gapsList = document.createElement("ul");
        gapsList.className = "ai-correction-list";
        correction.lacunas.forEach((item) => {
            const listItem = document.createElement("li");
            listItem.textContent = item;
            gapsList.appendChild(listItem);
        });
        correctionBox.appendChild(gapsList);
    }

    if (correction.sugestao_melhoria) {
        const improvement = document.createElement("p");
        improvement.className = "ai-correction-tip";
        improvement.textContent = `Como melhorar: ${correction.sugestao_melhoria}`;
        correctionBox.appendChild(improvement);
    }

    if (correction.resposta_esperada_resumida) {
        const expected = document.createElement("p");
        expected.className = "ai-correction-expected";
        expected.textContent = `Resposta esperada em alto nível: ${correction.resposta_esperada_resumida}`;
        correctionBox.appendChild(expected);
    }

    return correctionBox;
}

function calculateResults() {
    let correct = 0;
    let totalObjectives = 0;
    let hasDiscursive = false;

    const reviewList = document.getElementById("review-list");
    const scoreSummary = document.querySelector(".score-summary");
    reviewList.innerHTML = "";

    state.activeQuestions.forEach((question, index) => {
        const userAnswer = state.userAnswers[index];
        const item = document.createElement("div");
        item.className = "review-item";

        const title = document.createElement("h4");
        title.textContent = `${index + 1}. ${question.pergunta}`;
        item.appendChild(title);

        const typeTag = document.createElement("div");
        typeTag.className = "review-meta";
        typeTag.innerHTML = `${createBadgeHTML(question.nivel)}${getQuestionTypeBadge(question.tipo)}`;
        item.appendChild(typeTag);

        if (question.tipo === "discursiva") {
            hasDiscursive = true;

            const answerLabel = document.createElement("p");
            answerLabel.textContent = "Sua resposta:";
            item.appendChild(answerLabel);

            const answerBox = document.createElement("div");
            answerBox.className = "discursive-review";
            answerBox.textContent = hasAnswer(userAnswer) ? userAnswer : "Não respondeu";
            item.appendChild(answerBox);

            if (state.discursiveCorrections[index]) {
                item.appendChild(createCorrectionElement(state.discursiveCorrections[index]));
            } else {
                const statusLine = document.createElement("p");
                statusLine.innerHTML = '<span class="status pendent">Aguardando avaliação</span>';
                item.appendChild(statusLine);
            }
        } else {
            totalObjectives += 1;
            const isCorrect = userAnswer === question.resposta_correta;
            if (isCorrect) {
                correct += 1;
            }

            const answerText = document.createElement("p");
            const answerStatus = document.createElement("span");
            answerStatus.className = `status ${isCorrect ? "acertou" : "errou"}`;

            if (hasAnswer(userAnswer)) {
                const answerContent = question[`opcao_${String(userAnswer).toLowerCase()}`];
                answerStatus.textContent = `Opção ${userAnswer} - ${answerContent}`;
            } else {
                answerStatus.textContent = "Não respondeu";
            }

            answerText.textContent = "Sua resposta: ";
            answerText.appendChild(answerStatus);
            item.appendChild(answerText);

            if (!isCorrect) {
                const correctText = document.createElement("p");
                const correctStatus = document.createElement("span");
                correctStatus.className = "status acertou";
                correctStatus.textContent = `Opção ${question.resposta_correta} - ${question[`opcao_${question.resposta_correta.toLowerCase()}`]}`;
                correctText.textContent = "Resposta correta: ";
                correctText.appendChild(correctStatus);
                item.appendChild(correctText);
            }
        }

        if (question.explicacao) {
            const explanation = document.createElement("p");
            explanation.className = "exp";
            explanation.textContent = `Explicação: ${question.explicacao}`;
            item.appendChild(explanation);
        }

        reviewList.appendChild(item);
    });

    if (totalObjectives === 0) {
        scoreSummary.classList.add("hidden");
    } else {
        scoreSummary.classList.remove("hidden");

        const incorrect = totalObjectives - correct;
        const percent = Math.round((correct / totalObjectives) * 100);

        document.getElementById("res-total").textContent = totalObjectives;
        document.getElementById("res-correct").textContent = correct;
        document.getElementById("res-incorrect").textContent = incorrect;
        document.getElementById("res-percent").textContent = `${percent}%`;
    }

    if (hasDiscursive) {
        btnEvalDiscursive.classList.remove("hidden");
        btnCorrectDiscursiveAi.classList.remove("hidden");
    } else {
        btnEvalDiscursive.classList.add("hidden");
        btnCorrectDiscursiveAi.classList.add("hidden");
        setCorrectionStatus("");
    }
}

function generateEvaluationPrompt() {
    const questions = [];

    state.activeQuestions.forEach((question, index) => {
        if (question.tipo === "discursiva") {
            questions.push({
                numero: index + 1,
                pergunta: question.pergunta,
                criterios_de_correcao: question.explicacao || null,
                resposta_do_aluno: hasAnswer(state.userAnswers[index]) ? state.userAnswers[index] : "Não respondeu"
            });
        }
    });

    if (questions.length === 0) {
        return;
    }

    const promptObject = {
        persona: "professor rigoroso e avaliador pedagógico especialista na disciplina",
        tarefa: "avaliar_respostas_discursivas",
        instrucoes: [
            "Para cada questão, avaliar a resposta do aluno com base nos critérios de correção fornecidos.",
            "Atribuir uma nota de 0 a 10 com justificativa detalhada.",
            "Apontar os pontos fortes, as lacunas conceituais e sugerir como melhorar a resposta.",
            "Usar linguagem direta, construtiva e pedagogicamente fundamentada."
        ],
        formato_de_saida: "Para cada questão: número, nota (0-10), avaliação detalhada e sugestão de melhoria.",
        questoes: questions
    };

    const promptString = JSON.stringify(promptObject, null, 2);

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(promptString).then(() => {
            const original = btnEvalDiscursive.innerHTML;
            btnEvalDiscursive.innerHTML = "✅ Copiado!";

            setTimeout(() => {
                btnEvalDiscursive.innerHTML = original;
            }, 2000);
        });

        return;
    }

    alert("Não foi possível copiar. Seu navegador não suporta clipboard automático sem contexto seguro.");
}

async function correctDiscursiveAnswersWithAI() {
    const discursiveQuestions = [];

    state.activeQuestions.forEach((question, index) => {
        if (question.tipo === "discursiva") {
            discursiveQuestions.push({
                indice: index,
                numero: index + 1,
                pergunta: question.pergunta,
                criterios_de_correcao: question.explicacao || "",
                resposta_do_aluno: hasAnswer(state.userAnswers[index]) ? state.userAnswers[index] : "Não respondeu"
            });
        }
    });

    if (!discursiveQuestions.length) {
        return;
    }

    btnCorrectDiscursiveAi.disabled = true;
    btnCorrectDiscursiveAi.textContent = "Corrigindo...";
    setCorrectionStatus("A Study Buddy AI está corrigindo as respostas discursivas...", "loading");

    try {
        const rawContent = await requestStudyBuddyAI({
            systemPrompt: "Você é a Study Buddy AI. Avalie respostas discursivas com rigor pedagógico e retorne apenas JSON válido.",
            userPayload: {
                tarefa: "corrigir_respostas_discursivas",
                persona: "avaliador rigoroso, justo e pedagógico",
                instrucoes: [
                    "Avaliar cada resposta com base apenas na pergunta, nos critérios de correção e na resposta do aluno.",
                    "Atribuir nota de 0 a 10.",
                    "Identificar pontos fortes, lacunas e sugerir uma melhoria objetiva.",
                    "Retornar exclusivamente JSON no formato solicitado."
                ],
                formato_saida: {
                    avaliacoes: [
                        {
                            indice: "number",
                            nota: "number",
                            avaliacao: "string",
                            pontos_fortes: ["string"],
                            lacunas: ["string"],
                            sugestao_melhoria: "string",
                            resposta_esperada_resumida: "string"
                        }
                    ]
                },
                questoes: discursiveQuestions
            },
            temperature: 0.2
        });

        state.discursiveCorrections = parseDiscursiveCorrectionsResponse(rawContent);
        calculateResults();
        setCorrectionStatus("Correção concluída pela Study Buddy AI.", "success");
        btnCorrectDiscursiveAi.textContent = "Reavaliar com a Study Buddy AI";
    } catch (error) {
        setCorrectionStatus(`Erro na correção: ${error.message}`, "error");
        btnCorrectDiscursiveAi.textContent = "Corrigir com a Study Buddy AI";
    } finally {
        btnCorrectDiscursiveAi.disabled = false;
    }
}

function redoQuiz() {
    state.userAnswers = [];
    state.currentQIndex = 0;
    state.discursiveCorrections = {};
    setCorrectionStatus("");
    btnCorrectDiscursiveAi.textContent = "Corrigir com a Study Buddy AI";
    showScreen("config");
}

document.addEventListener("DOMContentLoaded", init);
