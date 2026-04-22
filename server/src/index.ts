import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";
import {
  isDbConfigured,
  joinRoom as dbJoinRoom,
  touchRoom as dbTouchRoom,
  wipeRoom as dbWipeRoom,
  listNotes as dbListNotes,
  insertNote as dbInsertNote,
  recordPoints as dbRecordPoints,
  recordGame as dbRecordGame,
  listGameRecords as dbListGameRecords,
  logRewardEvent as dbLogRewardEvent,
  updatePeerLocation as dbUpdatePeerLocation,
  listPeerLocations as dbListPeerLocations,
  haversineMeters,
  pointsBalances,
} from "./db";
// ===== INPUT SANITIZATION & SECURITY =====
function sanitizeString(input: string, maxLength = 256): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"']/g, (char) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", 
      "\"": "&quot;", "'": "&#x27;"
    }[char] || char))
    .trim().slice(0, maxLength);
}

function sanitizeRoomCode(code: string): string {
  if (!code || typeof code !== "string") return "";
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function sanitizeDisplayName(name: string): string {
  const sanitized = sanitizeString(name, 32);
  return sanitized || "Anonymous";
}


const USE_DB = isDbConfigured();

// Types kept in sync with client/src/lib/types.ts
type Peer = { clientId: string; name: string };

type Note = {
  id: string;
  roomCode: string;
  authorClientId: string;
  authorName: string;
  text: string;
  color: string;
  createdAt: number;
};

// Game state types. Kept in sync with client/src/lib/types.ts.

type TicTacToeSide = "X" | "O";
type TicTacToeState = {
  gameId: "tic-tac-toe";
  board: (TicTacToeSide | null)[];
  players: {
    X: { clientId: string; name: string };
    O: { clientId: string; name: string };
  };
  nextPlayer: TicTacToeSide;
  winner: TicTacToeSide | "draw" | null;
  startedAt: number;
};

type ConnectFourSide = "red" | "yellow";
type ConnectFourState = {
  gameId: "connect-four";
  board: (ConnectFourSide | null)[];
  players: {
    red: { clientId: string; name: string };
    yellow: { clientId: string; name: string };
  };
  nextPlayer: ConnectFourSide;
  winner: ConnectFourSide | "draw" | null;
  winningLine: number[] | null;
  startedAt: number;
};

type HangmanState = {
  gameId: "hangman";
  word: string;
  guessedLetters: string[];
  wrongCount: number;
  maxWrong: number;
  nextPlayerIdx: number;
  players: { clientId: string; name: string }[];
  winner: "win" | "lose" | null;
  startedAt: number;
};

// --- Battleship (Neon Fleet) ---
// Internal state keeps both fleets; per-player views redact the opponent.

type BattleshipShipData = {
  name: string;
  len: number;
  x: number;
  y: number;
  vertical: boolean;
  hits: number;
  hitPositions: { x: number; y: number }[];
};

type BattleshipShot = {
  x: number;
  y: number;
  hit: boolean;
  sunkShipName: string | null;
};

type BattleshipPlayerSlot = {
  clientId: string;
  name: string;
  ships: BattleshipShipData[];
  ready: boolean;
};

type BattleshipInternal = {
  gameId: "battleship";
  phase: "placement" | "battle" | "done";
  players: [BattleshipPlayerSlot, BattleshipPlayerSlot];
  /** shotHistory[i] = shots fired BY player i AT player (1-i) */
  shotHistory: [BattleshipShot[], BattleshipShot[]];
  turnIdx: 0 | 1;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// --- Drawing Game ---

type DrawingStroke = {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  timestamp: number;
};

type DrawingData = {
  strokes: DrawingStroke[];
  canvasDataUrl?: string;
};

type DrawingJudge = "fido" | "reginald" | "veloura";

type JudgeScore = {
  judge: DrawingJudge;
  score: number;
  comment: string;
  revealed: boolean;
};

type DrawingGameState = {
  gameId: "drawing";
  phase: "drawing" | "reveal" | "judging" | "complete";
  prompt: string;
  timeLimit: number;
  timeRemaining: number;
  players: {
    [clientId: string]: {
      name: string;
      drawing: DrawingData;
      readyForReveal: boolean;
    };
  };
  judgeScores: JudgeScore[];
  currentJudgeIdx: number;
  startedAt: number;
};

// --- Prompt game (Truth or Dare / Spicy Zone shared engine) ---

type PromptType = "truth" | "dare";

type PromptGameState = {
  gameId: "truth-or-dare" | "spicy-zone";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  turnIdx: 0 | 1;
  currentPrompt: { type: PromptType; text: string } | null;
  roundsCompleted: number;
  totalRounds: number;
  winner: "win" | null;
  startedAt: number;
};

// All prompts designed to work REMOTELY — partners on phones possibly
// far apart. No "rub their foot" or "let them pick your outfit"
// prompts. Everything here works through the app + phone + camera.

const TOD_TRUTHS: string[] = [
  "What's the most embarrassing song on your playlist right now?",
  "What's one thing you've never told me but want to?",
  "What's your most irrational fear?",
  "What's a lie you've told me, even small, that you feel weird about?",
  "What day of your life would you re-live if you could?",
  "What's your guilty pleasure TV show?",
  "What's something you did as a teenager you'd be horrified to admit now?",
  "Who was your very first crush and what were they like?",
  "What's the most childish thing you still do?",
  "What would you do with a day of being invisible?",
  "What's one habit of mine that secretly drives you crazy?",
  "When was the last time you cried and why?",
  "What's the worst gift you've ever received?",
  "What belief did you used to hold that you've changed your mind about?",
  "If you had to pick one superpower, what and why?",
  "What's a toxic trait of yours you're actually working on?",
  "What's the pettiest thing you've ever done in an argument with me?",
  "What celebrity crush are you too embarrassed to admit?",
  "What's the last thing you googled that you'd never say out loud?",
  "What was the most awkward moment of our first date / first time meeting?",
  "What's the dumbest thing you've ever spent money on?",
  "What's a compliment you secretly hate receiving?",
  "If you had 24 hours with no consequences, what would you actually do?",
  "What's my most attractive non-physical trait — be specific?",
  "What's one thing you wish you'd done by now?",
  "What's your pettiest hill you will die on?",
  "What's one thing you've exaggerated on a resume or in a story?",
  "What's the meanest thing you've ever said to someone and regretted?",
  "What's your weirdest recurring dream?",
  "What's the moment you first realized you had feelings for me?",
];

const TOD_DARES: string[] = [
  "Send me a selfie with the goofiest face you can make — right now.",
  "Record a 10-second voice message of your best impression of me.",
  "Text me three things you love about me in a row, no breaks.",
  "Send me a picture of the weirdest thing within arm's reach.",
  "Send me a voice message singing the chorus of the last song you listened to.",
  "Send a 5-second video of your best dance move.",
  "Write me a haiku about us in 60 seconds and send it.",
  "Text me the last 3 emojis you used — don't edit the list.",
  "Send me a screenshot of your phone's home screen right now.",
  "Record a voice note whispering something you've never said out loud to me.",
  "Send a selfie with your hair as chaotic as you can get it in 30 seconds.",
  "Send a picture of the first thing you see when you look up.",
  "Send a voice message of you laughing for 10 seconds straight.",
  "Text me a compliment about me using only movie-trailer voice words (DRAMATIC LIKE THIS).",
  "Send a selfie making your most convincing fake-cry face.",
  "Type a 3-word love note and send it.",
  "Send me a picture of something in your space that reminds you of me.",
  "Talk only in questions in your next 3 texts to me.",
  "Record a voice note describing my laugh in detail.",
  "Send a selfie with your most pouty 'I miss you' face.",
  "Do your best animal impression in a 5-second video and I have to guess.",
  "Send a voice note of a whispered secret only I'd care about.",
  "Text me the first thing that comes to mind when I say your favorite color.",
  "Send a picture pretending to be doing something dramatic — you pick.",
  "Send me your most flattering selfie right this second, no retakes.",
  "Record a 10-second freestyle rap about our relationship.",
  "Pick something in reach and use it as a microphone — send a video of you singing to me.",
  "Send me a photo of the last thing you ate.",
  "Voice note me reading the last text you sent me but in a sexy news-anchor voice.",
  "Send me a selfie and caption it as if it's the movie poster for our life.",
];

const SPICY_TRUTHS: string[] = [
  "What part of your partner do you find most attractive?",
  "What's a compliment you wish your partner gave you more?",
  "What's the most romantic thing you've ever done for someone?",
  "What's one thing that always puts you in the mood?",
  "What's your love language — and when did you last feel it from your partner?",
  "What's a small thing your partner does that melts you?",
  "What was the moment you first realized you were into them?",
  "What's your idea of the perfect slow morning together?",
  "What's a fantasy you've never told anyone?",
  "What's the most spontaneous thing you'd want to do with your partner?",
  "What song makes you think of them?",
  "Where would you want to be kissed right now?",
  "What's your partner's best kiss style?",
  "What's the last text you read from them that gave you butterflies?",
  "What's something romantic you've been wanting to ask for?",
  "What's the sexiest thing that isn't physical?",
  "When did you last feel truly wanted?",
  "What outfit of theirs do you love the most?",
  "What part of your relationship feels the most alive right now?",
  "What's a memory with them you replay often?",
  "What's one thing you'd change about a date night this week?",
  "What's your partner's secret superpower in the relationship?",
  "What's a turn-on that surprises you?",
  "When did you first feel like 'yeah, this is my person'?",
  "What's a compliment you've been holding back?",
];

const SPICY_DARES: string[] = [
  "Give your partner a slow 30-second hug, no talking.",
  "Whisper one thing you love about them into their ear.",
  "Kiss your partner somewhere that's not their mouth.",
  "Tell your partner the exact moment you fell for them.",
  "Hold eye contact for 60 seconds without saying anything.",
  "Massage your partner's shoulders for 60 seconds.",
  "Slow-dance to one full song — no phones.",
  "Write a 3-word love note and hand it to them.",
  "Give your partner a compliment about a body part they're shy about.",
  "Cuddle for a full 2 minutes with no distractions.",
  "Send your partner one genuinely romantic text, right now.",
  "Run your fingers through their hair for 30 seconds.",
  "Kiss them the way you'd kiss them on a first date.",
  "Hold their hand and tell them three things you're grateful for.",
  "Read your partner's favorite poem or lyric out loud to them.",
  "Pick one of your partner's features and describe it like a poet.",
  "Give them your most honest 'what I wish we did more of' answer.",
  "Share one fantasy date idea — big or small.",
  "Light a candle (or turn the lights low) and sit quietly together for a minute.",
  "Tell them the first thing you ever noticed about them physically.",
  "Describe their laugh to them.",
  "Give them one minute of undivided attention with no screens.",
  "Rest your head on their chest for 30 seconds and just listen.",
  "Ask 'what's one thing you want more of from me?' and actually listen.",
  "Kiss their hand like it's the first time.",
];

function pickPrompt(
  gameId: "truth-or-dare" | "spicy-zone",
  type: PromptType,
): string {
  const bank =
    gameId === "truth-or-dare"
      ? type === "truth"
        ? TOD_TRUTHS
        : TOD_DARES
      : type === "truth"
        ? SPICY_TRUTHS
        : SPICY_DARES;
  return bank[Math.floor(Math.random() * bank.length)];
}

// --- Loving Quest (cooperative sequence) ---

type LovingQuestState = {
  gameId: "loving-quest";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  prompts: string[];
  currentIdx: number;
  doneFlags: [boolean, boolean];
  winner: "done" | null;
  startedAt: number;
};

const LOVING_QUEST_BANK: string[] = [
  "Tell each other one thing you love about the other, out loud, right now.",
  "Hold hands and take three slow breaths together.",
  "Share one favorite memory of you two together.",
  "Look each other in the eye for 30 seconds. No phones, no words.",
  "Name one thing you're looking forward to doing together next.",
  "Give each other one real, long hug — at least 20 seconds.",
  "Say 'thank you for…' and finish it out loud.",
  "Each pick one song that reminds you of the other. Play a bit of both.",
  "Trade one small secret you've never told each other.",
  "Make each other laugh — worst joke wins.",
  "Describe the other person's smile in one sentence.",
  "Share one thing you've been meaning to tell the other.",
  "Each say one goal you want to work on this month, together or alone.",
  "Kiss gently — just one — and keep going.",
  "Agree on one thing you'll do together this weekend, big or small.",
];

function pickLovingQuestPrompts(n: number): string[] {
  const shuffled = [...LOVING_QUEST_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// --- Word Chain ---

type WordChainEntry = {
  word: string;
  playerIdx: 0 | 1;
};

type WordChainState = {
  gameId: "word-chain";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  turnIdx: 0 | 1;
  nextLetter: string;
  history: WordChainEntry[];
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

function randomStartLetter(): string {
  // Pick from common-starting letters — avoid X, Q, Z, Y which are brutal
  // to start chains with.
  const letters = "ABCDEFGHIJKLMNOPRSTUVW";
  return letters[Math.floor(Math.random() * letters.length)];
}

// --- Trivia (competitive multiple choice race) ---

type TriviaQuestion = {
  id: string;
  text: string;
  choices: string[];
  correctIdx: number;
  category?: string;
};

type TriviaState = {
  gameId: "trivia";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  questions: TriviaQuestion[];
  currentIdx: number;
  lockedOut: [boolean, boolean];
  scores: [number, number];
  winner: "win" | "draw" | null;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
};

// 200 trivia questions across 14 categories so 10-question sessions
// feel fresh for many games in a row. Rotation factor: 20 unique
// 10-question sets before any question is even eligible to repeat.
const TRIVIA_BANK: TriviaQuestion[] = [
  // --- Science (35) ---
  { id: "tv-001", text: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Saturn"], correctIdx: 1, category: "Science" },
  { id: "tv-002", text: "What element has the chemical symbol 'Au'?", choices: ["Silver", "Gold", "Aluminum", "Argon"], correctIdx: 1, category: "Science" },
  { id: "tv-003", text: "What's the hardest natural substance?", choices: ["Quartz", "Diamond", "Steel", "Titanium"], correctIdx: 1, category: "Science" },
  { id: "tv-004", text: "Which planet has the most moons?", choices: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctIdx: 1, category: "Science" },
  { id: "tv-005", text: "Which blood type is the universal donor?", choices: ["A+", "O-", "B+", "AB+"], correctIdx: 1, category: "Science" },
  { id: "tv-006", text: "How many hearts does an octopus have?", choices: ["1", "2", "3", "4"], correctIdx: 2, category: "Science" },
  { id: "tv-007", text: "What's the rarest blood type?", choices: ["O-", "AB-", "B+", "A-"], correctIdx: 1, category: "Science" },
  { id: "tv-008", text: "How many bones are in the adult human body?", choices: ["198", "206", "212", "220"], correctIdx: 1, category: "Science" },
  { id: "tv-009", text: "What's the chemical symbol for water?", choices: ["Wo", "H2O", "HO2", "H3O"], correctIdx: 1, category: "Science" },
  { id: "tv-010", text: "What's the freezing point of water in Celsius?", choices: ["-10", "0", "10", "32"], correctIdx: 1, category: "Science" },
  { id: "tv-011", text: "Which gas do plants absorb from the atmosphere?", choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correctIdx: 2, category: "Science" },
  { id: "tv-012", text: "What's the speed of light in a vacuum (approx)?", choices: ["3×10^5 km/s", "3×10^8 m/s", "3×10^6 km/h", "3×10^4 km/s"], correctIdx: 1, category: "Science" },
  { id: "tv-013", text: "What's the largest organ in the human body?", choices: ["Liver", "Brain", "Skin", "Lungs"], correctIdx: 2, category: "Science" },
  { id: "tv-014", text: "Which planet is closest to the sun?", choices: ["Venus", "Mars", "Earth", "Mercury"], correctIdx: 3, category: "Science" },
  { id: "tv-015", text: "How many chambers does the human heart have?", choices: ["2", "3", "4", "5"], correctIdx: 2, category: "Science" },
  { id: "tv-016", text: "What's the smallest unit of matter?", choices: ["Molecule", "Atom", "Electron", "Quark"], correctIdx: 3, category: "Science" },
  { id: "tv-017", text: "What's the pH of pure water?", choices: ["5", "7", "9", "14"], correctIdx: 1, category: "Science" },
  { id: "tv-018", text: "Which vitamin does your body make from sunlight?", choices: ["A", "C", "D", "K"], correctIdx: 2, category: "Science" },
  { id: "tv-019", text: "Which planet has a giant hexagonal storm at its north pole?", choices: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctIdx: 1, category: "Science" },
  { id: "tv-020", text: "What gas makes up most of Earth's atmosphere?", choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"], correctIdx: 2, category: "Science" },
  { id: "tv-021", text: "What's the nearest star to Earth (other than the Sun)?", choices: ["Sirius", "Proxima Centauri", "Alpha Centauri A", "Barnard's Star"], correctIdx: 1, category: "Science" },
  { id: "tv-022", text: "How long does light from the Sun take to reach Earth?", choices: ["~8 seconds", "~8 minutes", "~8 hours", "~8 days"], correctIdx: 1, category: "Science" },
  { id: "tv-023", text: "What's the largest type of animal cell?", choices: ["Nerve cell", "Muscle cell", "Egg cell", "Skin cell"], correctIdx: 2, category: "Science" },
  { id: "tv-024", text: "What particles are found in an atom's nucleus?", choices: ["Only protons", "Only neutrons", "Protons + neutrons", "Electrons"], correctIdx: 2, category: "Science" },
  { id: "tv-025", text: "What's the name of the galaxy Earth is in?", choices: ["Andromeda", "Triangulum", "Milky Way", "Sombrero"], correctIdx: 2, category: "Science" },
  { id: "tv-026", text: "Which scientist proposed the laws of motion?", choices: ["Einstein", "Newton", "Galileo", "Kepler"], correctIdx: 1, category: "Science" },
  { id: "tv-027", text: "Which bone is the longest in the human body?", choices: ["Spine", "Femur", "Tibia", "Humerus"], correctIdx: 1, category: "Science" },
  { id: "tv-028", text: "What's the main component of the sun?", choices: ["Liquid lava", "Molten iron", "Hot hydrogen gas", "Rock and dust"], correctIdx: 2, category: "Science" },
  { id: "tv-029", text: "What element is diamond made of?", choices: ["Silicon", "Carbon", "Quartz", "Calcium"], correctIdx: 1, category: "Science" },
  { id: "tv-030", text: "What's the study of fossils called?", choices: ["Archaeology", "Geology", "Paleontology", "Anthropology"], correctIdx: 2, category: "Science" },
  { id: "tv-031", text: "Which blood cell fights infection?", choices: ["Red", "White", "Platelet", "Plasma"], correctIdx: 1, category: "Science" },
  { id: "tv-032", text: "What's DNA short for?", choices: ["Dihydro-nucleic acid", "Deoxyribonucleic acid", "Dinucleotide amine", "Di-oxyribo amine"], correctIdx: 1, category: "Science" },
  { id: "tv-033", text: "What does the mitochondria do in a cell?", choices: ["Stores DNA", "Produces energy", "Filters waste", "Makes protein"], correctIdx: 1, category: "Science" },
  { id: "tv-034", text: "How many teeth does an adult typically have?", choices: ["28", "30", "32", "36"], correctIdx: 2, category: "Science" },
  { id: "tv-035", text: "What's the loudest animal on Earth?", choices: ["Lion", "Howler monkey", "Blue whale", "Sperm whale"], correctIdx: 3, category: "Science" },

  // --- Geography (30) ---
  { id: "tv-036", text: "What's the capital of Australia?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIdx: 2, category: "Geography" },
  { id: "tv-037", text: "What's the largest ocean on Earth?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIdx: 3, category: "Geography" },
  { id: "tv-038", text: "How many continents are there?", choices: ["5", "6", "7", "8"], correctIdx: 2, category: "Geography" },
  { id: "tv-039", text: "What's the tallest mountain in the world?", choices: ["K2", "Everest", "Kangchenjunga", "Denali"], correctIdx: 1, category: "Geography" },
  { id: "tv-040", text: "What's the currency of Japan?", choices: ["Won", "Yuan", "Yen", "Ringgit"], correctIdx: 2, category: "Geography" },
  { id: "tv-041", text: "What's the longest river in the world?", choices: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIdx: 1, category: "Geography" },
  { id: "tv-042", text: "What language has the most native speakers?", choices: ["English", "Spanish", "Mandarin", "Hindi"], correctIdx: 2, category: "Geography" },
  { id: "tv-043", text: "What's the smallest country in the world?", choices: ["Monaco", "Vatican City", "Nauru", "San Marino"], correctIdx: 1, category: "Geography" },
  { id: "tv-044", text: "Which country has the most time zones?", choices: ["USA", "Russia", "France", "China"], correctIdx: 2, category: "Geography" },
  { id: "tv-045", text: "Which desert is the largest?", choices: ["Sahara", "Gobi", "Antarctic", "Arabian"], correctIdx: 2, category: "Geography" },
  { id: "tv-046", text: "In which country is Machu Picchu?", choices: ["Mexico", "Peru", "Bolivia", "Ecuador"], correctIdx: 1, category: "Geography" },
  { id: "tv-047", text: "What's the capital of Canada?", choices: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correctIdx: 2, category: "Geography" },
  { id: "tv-048", text: "Which river runs through London?", choices: ["Seine", "Thames", "Rhine", "Danube"], correctIdx: 1, category: "Geography" },
  { id: "tv-049", text: "How many states in the USA?", choices: ["48", "49", "50", "52"], correctIdx: 2, category: "Geography" },
  { id: "tv-050", text: "What's the tallest waterfall in the world?", choices: ["Niagara", "Angel Falls", "Victoria", "Iguazu"], correctIdx: 1, category: "Geography" },
  { id: "tv-051", text: "Which country has a maple leaf on its flag?", choices: ["USA", "UK", "Canada", "Australia"], correctIdx: 2, category: "Geography" },
  { id: "tv-052", text: "What's the largest country by land area?", choices: ["Canada", "USA", "Russia", "China"], correctIdx: 2, category: "Geography" },
  { id: "tv-053", text: "What's the most populous country in the world?", choices: ["China", "India", "USA", "Indonesia"], correctIdx: 1, category: "Geography" },
  { id: "tv-054", text: "Which ocean is between Africa and Australia?", choices: ["Pacific", "Atlantic", "Indian", "Southern"], correctIdx: 2, category: "Geography" },
  { id: "tv-055", text: "What's the capital of Spain?", choices: ["Barcelona", "Madrid", "Seville", "Valencia"], correctIdx: 1, category: "Geography" },
  { id: "tv-056", text: "What's the capital of Egypt?", choices: ["Alexandria", "Cairo", "Giza", "Luxor"], correctIdx: 1, category: "Geography" },
  { id: "tv-057", text: "Which US state is the largest by area?", choices: ["Texas", "Alaska", "California", "Montana"], correctIdx: 1, category: "Geography" },
  { id: "tv-058", text: "Which European country is known for fjords?", choices: ["Germany", "Norway", "Denmark", "Iceland"], correctIdx: 1, category: "Geography" },
  { id: "tv-059", text: "What's the deepest lake in the world?", choices: ["Superior", "Tanganyika", "Baikal", "Victoria"], correctIdx: 2, category: "Geography" },
  { id: "tv-060", text: "Which country is home to the Great Barrier Reef?", choices: ["Indonesia", "Australia", "Philippines", "Fiji"], correctIdx: 1, category: "Geography" },
  { id: "tv-061", text: "What's the capital of Germany?", choices: ["Munich", "Hamburg", "Berlin", "Frankfurt"], correctIdx: 2, category: "Geography" },
  { id: "tv-062", text: "Which continent is driest on average?", choices: ["Africa", "Australia", "Antarctica", "Asia"], correctIdx: 2, category: "Geography" },
  { id: "tv-063", text: "Which country has no national capital city?", choices: ["Nauru", "Tuvalu", "Monaco", "All of those"], correctIdx: 3, category: "Geography" },
  { id: "tv-064", text: "The Panama Canal connects which two oceans?", choices: ["Pacific and Atlantic", "Atlantic and Indian", "Pacific and Indian", "Arctic and Atlantic"], correctIdx: 0, category: "Geography" },
  { id: "tv-065", text: "Which US city is nicknamed 'The Windy City'?", choices: ["Boston", "New York", "Chicago", "Seattle"], correctIdx: 2, category: "Geography" },

  // --- History (20) ---
  { id: "tv-066", text: "In what year did World War II end?", choices: ["1943", "1944", "1945", "1946"], correctIdx: 2, category: "History" },
  { id: "tv-067", text: "What year did the Berlin Wall fall?", choices: ["1987", "1988", "1989", "1990"], correctIdx: 2, category: "History" },
  { id: "tv-068", text: "Who invented the telephone?", choices: ["Edison", "Tesla", "Bell", "Marconi"], correctIdx: 2, category: "History" },
  { id: "tv-069", text: "What year did humans first land on the moon?", choices: ["1967", "1968", "1969", "1970"], correctIdx: 2, category: "History" },
  { id: "tv-070", text: "Who was the first US president?", choices: ["Jefferson", "Adams", "Washington", "Franklin"], correctIdx: 2, category: "History" },
  { id: "tv-071", text: "Which empire was led by Julius Caesar?", choices: ["Greek", "Persian", "Roman", "Egyptian"], correctIdx: 2, category: "History" },
  { id: "tv-072", text: "What ancient wonder was in Alexandria?", choices: ["Hanging Gardens", "Colossus", "Lighthouse", "Pyramid"], correctIdx: 2, category: "History" },
  { id: "tv-073", text: "In which year did the Titanic sink?", choices: ["1910", "1911", "1912", "1913"], correctIdx: 2, category: "History" },
  { id: "tv-074", text: "Who painted the Sistine Chapel ceiling?", choices: ["Raphael", "Da Vinci", "Michelangelo", "Donatello"], correctIdx: 2, category: "History" },
  { id: "tv-075", text: "Which civilization built Machu Picchu?", choices: ["Aztec", "Maya", "Inca", "Olmec"], correctIdx: 2, category: "History" },
  { id: "tv-076", text: "In what year did WWI begin?", choices: ["1912", "1914", "1916", "1918"], correctIdx: 1, category: "History" },
  { id: "tv-077", text: "Who was the first woman to win a Nobel Prize?", choices: ["Rosalind Franklin", "Marie Curie", "Ada Lovelace", "Florence Nightingale"], correctIdx: 1, category: "History" },
  { id: "tv-078", text: "What year was the Declaration of Independence signed?", choices: ["1774", "1775", "1776", "1789"], correctIdx: 2, category: "History" },
  { id: "tv-079", text: "Who was the longest-reigning British monarch?", choices: ["Victoria", "Elizabeth II", "George III", "Henry VIII"], correctIdx: 1, category: "History" },
  { id: "tv-080", text: "In what year did the USSR dissolve?", choices: ["1989", "1990", "1991", "1992"], correctIdx: 2, category: "History" },
  { id: "tv-081", text: "Who wrote the '95 Theses'?", choices: ["Calvin", "Luther", "Zwingli", "Knox"], correctIdx: 1, category: "History" },
  { id: "tv-082", text: "Which was the first country to give women the vote?", choices: ["USA", "UK", "New Zealand", "Sweden"], correctIdx: 2, category: "History" },
  { id: "tv-083", text: "Who led India's non-violent independence movement?", choices: ["Nehru", "Gandhi", "Tagore", "Bose"], correctIdx: 1, category: "History" },
  { id: "tv-084", text: "What year did the Chernobyl disaster happen?", choices: ["1984", "1985", "1986", "1987"], correctIdx: 2, category: "History" },
  { id: "tv-085", text: "Which empire was known for its Great Wall?", choices: ["Mongol", "Japanese", "Chinese", "Korean"], correctIdx: 2, category: "History" },

  // --- Literature (15) ---
  { id: "tv-086", text: "Who wrote 'Romeo and Juliet'?", choices: ["Dickens", "Shakespeare", "Chaucer", "Austen"], correctIdx: 1, category: "Literature" },
  { id: "tv-087", text: "Who wrote 'Harry Potter'?", choices: ["Tolkien", "Rowling", "Pullman", "Lewis"], correctIdx: 1, category: "Literature" },
  { id: "tv-088", text: "Who wrote '1984'?", choices: ["Huxley", "Orwell", "Bradbury", "Atwood"], correctIdx: 1, category: "Literature" },
  { id: "tv-089", text: "Who wrote 'Pride and Prejudice'?", choices: ["Brontë", "Austen", "Alcott", "Eliot"], correctIdx: 1, category: "Literature" },
  { id: "tv-090", text: "In which novel would you meet Atticus Finch?", choices: ["Gatsby", "To Kill a Mockingbird", "Catcher in the Rye", "Of Mice and Men"], correctIdx: 1, category: "Literature" },
  { id: "tv-091", text: "Who wrote 'The Great Gatsby'?", choices: ["Hemingway", "Fitzgerald", "Faulkner", "Salinger"], correctIdx: 1, category: "Literature" },
  { id: "tv-092", text: "Who wrote the 'A Song of Ice and Fire' series?", choices: ["Tolkien", "Sanderson", "Martin", "Jordan"], correctIdx: 2, category: "Literature" },
  { id: "tv-093", text: "Which Shakespeare play features the line 'To be or not to be'?", choices: ["Macbeth", "Hamlet", "Othello", "King Lear"], correctIdx: 1, category: "Literature" },
  { id: "tv-094", text: "Who wrote 'The Odyssey'?", choices: ["Virgil", "Homer", "Plato", "Ovid"], correctIdx: 1, category: "Literature" },
  { id: "tv-095", text: "Which Dickens novel features Ebenezer Scrooge?", choices: ["Oliver Twist", "A Christmas Carol", "Great Expectations", "Hard Times"], correctIdx: 1, category: "Literature" },
  { id: "tv-096", text: "Who wrote 'Moby-Dick'?", choices: ["Thoreau", "Melville", "Hawthorne", "Poe"], correctIdx: 1, category: "Literature" },
  { id: "tv-097", text: "In 'The Hobbit', what is Bilbo's family name?", choices: ["Took", "Baggins", "Gamgee", "Brandybuck"], correctIdx: 1, category: "Literature" },
  { id: "tv-098", text: "Who wrote 'Frankenstein'?", choices: ["Mary Shelley", "Bram Stoker", "Jane Austen", "Emily Brontë"], correctIdx: 0, category: "Literature" },
  { id: "tv-099", text: "What's the name of the hobbit who destroys the One Ring?", choices: ["Bilbo", "Sam", "Frodo", "Merry"], correctIdx: 2, category: "Literature" },
  { id: "tv-100", text: "Who wrote 'The Adventures of Huckleberry Finn'?", choices: ["Dickens", "Twain", "London", "Steinbeck"], correctIdx: 1, category: "Literature" },

  // --- Art (10) ---
  { id: "tv-101", text: "Who painted the Mona Lisa?", choices: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], correctIdx: 1, category: "Art" },
  { id: "tv-102", text: "Who painted 'Starry Night'?", choices: ["Monet", "Van Gogh", "Picasso", "Dalí"], correctIdx: 1, category: "Art" },
  { id: "tv-103", text: "Who cut off his own ear?", choices: ["Van Gogh", "Picasso", "Dalí", "Rembrandt"], correctIdx: 0, category: "Art" },
  { id: "tv-104", text: "Which movement is Picasso associated with?", choices: ["Surrealism", "Cubism", "Impressionism", "Baroque"], correctIdx: 1, category: "Art" },
  { id: "tv-105", text: "Who painted 'The Persistence of Memory' (melting clocks)?", choices: ["Picasso", "Miró", "Dalí", "Chagall"], correctIdx: 2, category: "Art" },
  { id: "tv-106", text: "Which color is made by mixing red and blue?", choices: ["Orange", "Green", "Purple", "Pink"], correctIdx: 2, category: "Art" },
  { id: "tv-107", text: "Where is the Louvre?", choices: ["London", "Rome", "Paris", "Madrid"], correctIdx: 2, category: "Art" },
  { id: "tv-108", text: "What art movement came right after Impressionism?", choices: ["Romanticism", "Post-Impressionism", "Realism", "Renaissance"], correctIdx: 1, category: "Art" },
  { id: "tv-109", text: "Who painted 'The Scream'?", choices: ["Munch", "Kahlo", "Klee", "Ernst"], correctIdx: 0, category: "Art" },
  { id: "tv-110", text: "Banksy is known for what type of art?", choices: ["Oil painting", "Street / stencil", "Sculpture", "Digital"], correctIdx: 1, category: "Art" },

  // --- Movies & TV (20) ---
  { id: "tv-111", text: "Who directed 'Jurassic Park'?", choices: ["George Lucas", "James Cameron", "Steven Spielberg", "Ridley Scott"], correctIdx: 2, category: "Movies" },
  { id: "tv-112", text: "Which movie won Best Picture in 2020?", choices: ["1917", "Parasite", "Joker", "Ford v Ferrari"], correctIdx: 1, category: "Movies" },
  { id: "tv-113", text: "Which actor played Iron Man?", choices: ["Chris Evans", "Robert Downey Jr.", "Mark Ruffalo", "Chris Hemsworth"], correctIdx: 1, category: "Movies" },
  { id: "tv-114", text: "Who directed 'Pulp Fiction'?", choices: ["Scorsese", "Coppola", "Tarantino", "Nolan"], correctIdx: 2, category: "Movies" },
  { id: "tv-115", text: "What's the name of the kingdom in 'Frozen'?", choices: ["Arendelle", "Agrabah", "Corona", "Atlantica"], correctIdx: 0, category: "Movies" },
  { id: "tv-116", text: "Who directed 'Inception'?", choices: ["Nolan", "Fincher", "Villeneuve", "Anderson"], correctIdx: 0, category: "Movies" },
  { id: "tv-117", text: "What's the highest-grossing Avatar-franchise film?", choices: ["Avatar", "Avatar: The Way of Water", "Avatar 3", "Avatar 2D re-release"], correctIdx: 0, category: "Movies" },
  { id: "tv-118", text: "In 'The Matrix', what color pill represents reality?", choices: ["Red", "Blue", "Green", "White"], correctIdx: 0, category: "Movies" },
  { id: "tv-119", text: "Which show features the Iron Throne?", choices: ["Vikings", "Game of Thrones", "The Witcher", "House of the Dragon"], correctIdx: 1, category: "Movies" },
  { id: "tv-120", text: "Who voices Woody in Toy Story?", choices: ["Tim Allen", "Tom Hanks", "Billy Crystal", "John Goodman"], correctIdx: 1, category: "Movies" },
  { id: "tv-121", text: "What's the name of the coffee shop in Friends?", choices: ["Central Perk", "The Grind", "Perk & Cup", "Java Joe's"], correctIdx: 0, category: "Movies" },
  { id: "tv-122", text: "Which movie features Forrest Gump?", choices: ["Cast Away", "Forrest Gump", "The Green Mile", "Philadelphia"], correctIdx: 1, category: "Movies" },
  { id: "tv-123", text: "Who directed 'Titanic' and the Avatar series?", choices: ["Nolan", "Cameron", "Scott", "Spielberg"], correctIdx: 1, category: "Movies" },
  { id: "tv-124", text: "What is Dumbledore's first name?", choices: ["Elias", "Albus", "Aberforth", "Cornelius"], correctIdx: 1, category: "Movies" },
  { id: "tv-125", text: "In 'Stranger Things', what alternate dimension is featured?", choices: ["The Void", "The Upside Down", "The Other Side", "The Rift"], correctIdx: 1, category: "Movies" },
  { id: "tv-126", text: "Which superhero is from Krypton?", choices: ["Batman", "Superman", "Aquaman", "Flash"], correctIdx: 1, category: "Movies" },
  { id: "tv-127", text: "Who played Jack in 'Titanic'?", choices: ["Brad Pitt", "Leonardo DiCaprio", "Matt Damon", "Ben Affleck"], correctIdx: 1, category: "Movies" },
  { id: "tv-128", text: "In 'Breaking Bad', what's Walter's alias?", choices: ["Heisenberg", "Big Bang", "Capers", "The Count"], correctIdx: 0, category: "Movies" },
  { id: "tv-129", text: "Which Disney movie features Simba?", choices: ["Lion King", "Tarzan", "Madagascar", "Jungle Book"], correctIdx: 0, category: "Movies" },
  { id: "tv-130", text: "Who directed 'The Godfather'?", choices: ["Scorsese", "Coppola", "Lucas", "Kubrick"], correctIdx: 1, category: "Movies" },

  // --- Music (15) ---
  { id: "tv-131", text: "Which instrument has 88 keys?", choices: ["Organ", "Piano", "Harpsichord", "Accordion"], correctIdx: 1, category: "Music" },
  { id: "tv-132", text: "Which band released 'Abbey Road'?", choices: ["Rolling Stones", "Beatles", "Led Zeppelin", "Pink Floyd"], correctIdx: 1, category: "Music" },
  { id: "tv-133", text: "Who sang 'Bad Guy' (2019)?", choices: ["Billie Eilish", "Ariana Grande", "Olivia Rodrigo", "Dua Lipa"], correctIdx: 0, category: "Music" },
  { id: "tv-134", text: "How many strings does a standard guitar have?", choices: ["4", "5", "6", "7"], correctIdx: 2, category: "Music" },
  { id: "tv-135", text: "Which composer wrote the 'Ode to Joy'?", choices: ["Mozart", "Beethoven", "Bach", "Schubert"], correctIdx: 1, category: "Music" },
  { id: "tv-136", text: "What's the main instrument in a jazz ensemble traditionally?", choices: ["Violin", "Saxophone", "Flute", "Piano"], correctIdx: 1, category: "Music" },
  { id: "tv-137", text: "Which boy band had 'Bye Bye Bye'?", choices: ["Backstreet Boys", "98 Degrees", "*NSYNC", "Boyz II Men"], correctIdx: 2, category: "Music" },
  { id: "tv-138", text: "Who is the 'King of Pop'?", choices: ["Elvis", "Prince", "Michael Jackson", "Bowie"], correctIdx: 2, category: "Music" },
  { id: "tv-139", text: "Which artist released 'Lemonade' (2016)?", choices: ["Rihanna", "Beyoncé", "Adele", "Alicia Keys"], correctIdx: 1, category: "Music" },
  { id: "tv-140", text: "What genre is Bob Marley known for?", choices: ["Hip-hop", "Reggae", "Blues", "Country"], correctIdx: 1, category: "Music" },
  { id: "tv-141", text: "Which of these is a string instrument?", choices: ["Trumpet", "Harmonica", "Cello", "Xylophone"], correctIdx: 2, category: "Music" },
  { id: "tv-142", text: "Who is the lead singer of Queen?", choices: ["John Deacon", "Freddie Mercury", "Brian May", "Roger Taylor"], correctIdx: 1, category: "Music" },
  { id: "tv-143", text: "Which rapper released 'The Blueprint' (2001)?", choices: ["Jay-Z", "Nas", "Eminem", "50 Cent"], correctIdx: 0, category: "Music" },
  { id: "tv-144", text: "Which instrument does Yo-Yo Ma play?", choices: ["Violin", "Cello", "Viola", "Bass"], correctIdx: 1, category: "Music" },
  { id: "tv-145", text: "'Shape of You' is by which artist?", choices: ["Justin Bieber", "Ed Sheeran", "The Weeknd", "Shawn Mendes"], correctIdx: 1, category: "Music" },

  // --- Food (10) ---
  { id: "tv-146", text: "Which country invented pizza?", choices: ["France", "Greece", "Italy", "Spain"], correctIdx: 2, category: "Food" },
  { id: "tv-147", text: "What's the main ingredient in guacamole?", choices: ["Tomato", "Avocado", "Lime", "Onion"], correctIdx: 1, category: "Food" },
  { id: "tv-148", text: "What's the world's most consumed beverage (besides water)?", choices: ["Coffee", "Tea", "Beer", "Milk"], correctIdx: 1, category: "Food" },
  { id: "tv-149", text: "Which cheese is traditionally used on pizza Margherita?", choices: ["Cheddar", "Mozzarella", "Provolone", "Feta"], correctIdx: 1, category: "Food" },
  { id: "tv-150", text: "What's the primary grain used in sushi rice?", choices: ["Basmati", "Jasmine", "Short-grain", "Long-grain"], correctIdx: 2, category: "Food" },
  { id: "tv-151", text: "What spice is the world's most expensive by weight?", choices: ["Vanilla", "Saffron", "Cardamom", "Truffle"], correctIdx: 1, category: "Food" },
  { id: "tv-152", text: "Which fruit has seeds on the outside?", choices: ["Blueberry", "Strawberry", "Grape", "Cherry"], correctIdx: 1, category: "Food" },
  { id: "tv-153", text: "What's the main ingredient in hummus?", choices: ["Chickpeas", "White beans", "Lentils", "Peas"], correctIdx: 0, category: "Food" },
  { id: "tv-154", text: "Which cuisine uses a tandoor oven?", choices: ["Thai", "Chinese", "Indian", "Japanese"], correctIdx: 2, category: "Food" },
  { id: "tv-155", text: "Which nut is used in pesto traditionally?", choices: ["Almond", "Walnut", "Pine nut", "Cashew"], correctIdx: 2, category: "Food" },

  // --- Sports (10) ---
  { id: "tv-156", text: "How many players on a soccer team on the field?", choices: ["9", "10", "11", "12"], correctIdx: 2, category: "Sports" },
  { id: "tv-157", text: "Which country hosts Wimbledon?", choices: ["USA", "France", "England", "Australia"], correctIdx: 2, category: "Sports" },
  { id: "tv-158", text: "How many rings on the Olympic flag?", choices: ["4", "5", "6", "7"], correctIdx: 1, category: "Sports" },
  { id: "tv-159", text: "In which sport do you 'love' a score of zero?", choices: ["Golf", "Tennis", "Cricket", "Baseball"], correctIdx: 1, category: "Sports" },
  { id: "tv-160", text: "How many players are on an NBA basketball team on the court per side?", choices: ["4", "5", "6", "7"], correctIdx: 1, category: "Sports" },
  { id: "tv-161", text: "Which boxer called himself 'The Greatest'?", choices: ["Tyson", "Ali", "Foreman", "Frazier"], correctIdx: 1, category: "Sports" },
  { id: "tv-162", text: "What does NFL stand for?", choices: ["National Football League", "National Fan League", "North Football League", "New Football Legacy"], correctIdx: 0, category: "Sports" },
  { id: "tv-163", text: "Which country won the most Summer Olympic medals historically?", choices: ["USSR/Russia", "USA", "China", "UK"], correctIdx: 1, category: "Sports" },
  { id: "tv-164", text: "In golf, what's one stroke under par called?", choices: ["Eagle", "Birdie", "Bogey", "Albatross"], correctIdx: 1, category: "Sports" },
  { id: "tv-165", text: "Which sport uses a 'shuttlecock'?", choices: ["Tennis", "Badminton", "Squash", "Table tennis"], correctIdx: 1, category: "Sports" },

  // --- Tech (10) ---
  { id: "tv-166", text: "What year did the first iPhone release?", choices: ["2005", "2006", "2007", "2008"], correctIdx: 2, category: "Tech" },
  { id: "tv-167", text: "What does HTML stand for?", choices: ["HyperText Markup Language", "Home Text Markup Language", "HyperTransfer Meta Language", "High Text Multiplex Language"], correctIdx: 0, category: "Tech" },
  { id: "tv-168", text: "Who co-founded Apple with Steve Jobs?", choices: ["Wozniak", "Gates", "Allen", "Cook"], correctIdx: 0, category: "Tech" },
  { id: "tv-169", text: "What does CPU stand for?", choices: ["Central Processing Unit", "Computer Processing Unit", "Core Processor Unit", "Control Processing Unit"], correctIdx: 0, category: "Tech" },
  { id: "tv-170", text: "Which company makes the Windows OS?", choices: ["Apple", "Google", "Microsoft", "IBM"], correctIdx: 2, category: "Tech" },
  { id: "tv-171", text: "What year did Facebook launch?", choices: ["2003", "2004", "2005", "2006"], correctIdx: 1, category: "Tech" },
  { id: "tv-172", text: "Who is the CEO of Tesla (as of 2024)?", choices: ["Elon Musk", "Tim Cook", "Jeff Bezos", "Sundar Pichai"], correctIdx: 0, category: "Tech" },
  { id: "tv-173", text: "What does 'URL' stand for?", choices: ["Uniform Resource Locator", "Universal Reserved Link", "Uniform Resource Link", "Universal Reference Locator"], correctIdx: 0, category: "Tech" },
  { id: "tv-174", text: "What was the first mass-produced personal computer by IBM?", choices: ["IBM PC", "Altair", "Apple I", "Commodore 64"], correctIdx: 0, category: "Tech" },
  { id: "tv-175", text: "Which language is React written in?", choices: ["Python", "Ruby", "JavaScript", "TypeScript"], correctIdx: 2, category: "Tech" },

  // --- Nature (10) ---
  { id: "tv-176", text: "What's the fastest land animal?", choices: ["Lion", "Cheetah", "Pronghorn", "Ostrich"], correctIdx: 1, category: "Nature" },
  { id: "tv-177", text: "What's the largest mammal?", choices: ["Elephant", "Blue whale", "Giraffe", "Orca"], correctIdx: 1, category: "Nature" },
  { id: "tv-178", text: "What animal is known as the 'Ship of the Desert'?", choices: ["Horse", "Camel", "Donkey", "Llama"], correctIdx: 1, category: "Nature" },
  { id: "tv-179", text: "Which bird is the largest?", choices: ["Eagle", "Ostrich", "Condor", "Albatross"], correctIdx: 1, category: "Nature" },
  { id: "tv-180", text: "How many legs does a spider have?", choices: ["6", "8", "10", "12"], correctIdx: 1, category: "Nature" },
  { id: "tv-181", text: "What's a baby kangaroo called?", choices: ["Kit", "Joey", "Cub", "Pup"], correctIdx: 1, category: "Nature" },
  { id: "tv-182", text: "Which mammal can fly?", choices: ["Flying squirrel", "Bat", "Sugar glider", "Colugo"], correctIdx: 1, category: "Nature" },
  { id: "tv-183", text: "Which tree produces acorns?", choices: ["Maple", "Oak", "Pine", "Birch"], correctIdx: 1, category: "Nature" },
  { id: "tv-184", text: "Which bird can mimic human speech?", choices: ["Sparrow", "Parrot", "Pigeon", "Finch"], correctIdx: 1, category: "Nature" },
  { id: "tv-185", text: "What color is octopus blood?", choices: ["Red", "Green", "Blue", "Clear"], correctIdx: 2, category: "Nature" },

  // --- Math / Misc (15) ---
  { id: "tv-186", text: "How many sides does a hexagon have?", choices: ["5", "6", "7", "8"], correctIdx: 1, category: "Math" },
  { id: "tv-187", text: "Which is the smallest prime number?", choices: ["0", "1", "2", "3"], correctIdx: 2, category: "Math" },
  { id: "tv-188", text: "What's the value of pi to 2 decimal places?", choices: ["3.12", "3.14", "3.16", "3.18"], correctIdx: 1, category: "Math" },
  { id: "tv-189", text: "What's 12 × 12?", choices: ["124", "144", "154", "148"], correctIdx: 1, category: "Math" },
  { id: "tv-190", text: "What's the square root of 144?", choices: ["10", "11", "12", "14"], correctIdx: 2, category: "Math" },
  { id: "tv-191", text: "How many degrees in a triangle's interior angles?", choices: ["90", "180", "270", "360"], correctIdx: 1, category: "Math" },
  { id: "tv-192", text: "Which Greek god is king of the gods?", choices: ["Poseidon", "Hades", "Apollo", "Zeus"], correctIdx: 3, category: "Mythology" },
  { id: "tv-193", text: "Which Greek god is god of the sea?", choices: ["Zeus", "Ares", "Poseidon", "Apollo"], correctIdx: 2, category: "Mythology" },
  { id: "tv-194", text: "Who is Thor's hammer named?", choices: ["Gungnir", "Stormbreaker", "Mjölnir", "Fenrir"], correctIdx: 2, category: "Mythology" },
  { id: "tv-195", text: "In Greek myth, who opened the box of evils?", choices: ["Athena", "Pandora", "Persephone", "Hera"], correctIdx: 1, category: "Mythology" },
  { id: "tv-196", text: "Which number is considered unlucky in Western culture?", choices: ["7", "11", "13", "21"], correctIdx: 2, category: "Misc" },
  { id: "tv-197", text: "What color are London taxis traditionally?", choices: ["Yellow", "Black", "Red", "Green"], correctIdx: 1, category: "Misc" },
  { id: "tv-198", text: "What color is a ripe banana's skin right before brown?", choices: ["Green", "Yellow", "Orange", "Red"], correctIdx: 1, category: "Misc" },
  { id: "tv-199", text: "In what game do you try to get a Yahtzee?", choices: ["Cards", "Dice", "Dominoes", "Board"], correctIdx: 1, category: "Misc" },
  { id: "tv-200", text: "What's the only even prime number?", choices: ["0", "2", "4", "6"], correctIdx: 1, category: "Math" },
];

function pickTriviaQuestions(n: number): TriviaQuestion[] {
  const shuffled = [...TRIVIA_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// --- Love Trivia (cooperative couples game) ---

type LoveTriviaQuestion = {
  id: string;
  text: string;
  choices: string[];
};

type LoveTriviaState = {
  gameId: "love-trivia";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  phase: "setup" | "game" | "done";
  questions: LoveTriviaQuestion[];
  setupPredictions: [(number | null)[], (number | null)[]];
  gameAnswers: [(number | null)[], (number | null)[]];
  currentIdx: number;
  scores: [number, number];
  winner: "done" | null;
  startedAt: number;
};

// 150 couples-trivia questions. Pool chosen so a 10-question session
// is rotationally unique for 15 sessions before repeats start. Each
// question has 4 choices and no "right" answer — the server only
// knows that partner-answer matching scores points.
const LOVE_TRIVIA_BANK: LoveTriviaQuestion[] = [
  {
    id: "lt-01",
    text: "The perfect date night is...",
    choices: [
      "Cozy night in with takeout",
      "Fancy dinner out",
      "Adventurous outdoor thing",
      "Concert or event",
    ],
  },
  {
    id: "lt-02",
    text: "Your partner's ideal vacation is...",
    choices: ["Tropical beach", "Mountain cabin", "Big city trip", "Road trip"],
  },
  {
    id: "lt-03",
    text: "Their go-to comfort food is...",
    choices: ["Pizza", "Pasta", "Mac & cheese", "Tacos"],
  },
  {
    id: "lt-04",
    text: "Their favorite season is...",
    choices: ["Spring", "Summer", "Fall", "Winter"],
  },
  {
    id: "lt-05",
    text: "Their love language is mostly...",
    choices: [
      "Words of affirmation",
      "Physical touch",
      "Acts of service",
      "Quality time",
    ],
  },
  {
    id: "lt-06",
    text: "On a lazy Sunday they'd rather...",
    choices: [
      "Sleep in and cuddle",
      "Brunch somewhere",
      "Long walk or hike",
      "Binge a show",
    ],
  },
  {
    id: "lt-07",
    text: "Their favorite way to relax is...",
    choices: ["Reading", "Video games", "Music", "A long bath"],
  },
  {
    id: "lt-08",
    text: "The snack they always grab is...",
    choices: ["Chips", "Chocolate", "Fruit", "Popcorn"],
  },
  {
    id: "lt-09",
    text: "Their morning starts with...",
    choices: ["Coffee", "Tea", "Water", "Nothing — just vibes"],
  },
  {
    id: "lt-10",
    text: "Their worst nightmare social event is...",
    choices: [
      "A loud club",
      "A formal work party",
      "A big family dinner",
      "A small talk networking thing",
    ],
  },
  {
    id: "lt-11",
    text: "When stressed, they mostly want...",
    choices: [
      "To be held",
      "Space to themselves",
      "To vent out loud",
      "A distraction",
    ],
  },
  {
    id: "lt-12",
    text: "Their favorite kind of movie is...",
    choices: ["Action / thriller", "Rom-com", "Horror", "Sci-fi / fantasy"],
  },
  {
    id: "lt-13",
    text: "If they could only drink one beverage forever...",
    choices: ["Coffee", "Beer", "Wine", "Diet soda"],
  },
  {
    id: "lt-14",
    text: "The chore they hate the most is...",
    choices: ["Dishes", "Laundry", "Vacuuming", "Taking out trash"],
  },
  {
    id: "lt-15",
    text: "Their dream pet would be...",
    choices: ["Dog", "Cat", "Something exotic", "No pets ever"],
  },
  {
    id: "lt-16",
    text: "The compliment they most want to hear is...",
    choices: [
      "You're so funny",
      "You're so smart",
      "You look amazing",
      "I love how kind you are",
    ],
  },
  {
    id: "lt-17",
    text: "Their guilty-pleasure song is probably...",
    choices: [
      "Early 2000s pop",
      "Throwback country",
      "A boy band classic",
      "A cheesy love ballad",
    ],
  },
  {
    id: "lt-18",
    text: "Their dream job as a kid was...",
    choices: ["Astronaut", "Artist", "Doctor / vet", "Athlete"],
  },
  {
    id: "lt-19",
    text: "At a party they'd usually be...",
    choices: [
      "Center of the conversation",
      "Quiet in a corner",
      "Helping the host",
      "Leaving early",
    ],
  },
  {
    id: "lt-20",
    text: "Their phone screen time is mostly...",
    choices: [
      "Social media",
      "Games",
      "Texting friends",
      "Work / productivity",
    ],
  },
  {
    id: "lt-21",
    text: "Their dream breakfast is...",
    choices: ["Pancakes", "Eggs and bacon", "Avocado toast", "Just coffee"],
  },
  {
    id: "lt-22",
    text: "The trait they love most in themselves is...",
    choices: ["Humor", "Loyalty", "Work ethic", "Kindness"],
  },
  {
    id: "lt-23",
    text: "Their favorite smell is...",
    choices: [
      "Fresh laundry",
      "Campfire",
      "Baked goods",
      "Ocean / salt air",
    ],
  },
  {
    id: "lt-24",
    text: "The superpower they'd pick is...",
    choices: ["Flying", "Teleporting", "Reading minds", "Time travel"],
  },
  {
    id: "lt-25",
    text: "Their ideal birthday gift is...",
    choices: [
      "Something handmade",
      "Experience / trip",
      "Tech or gadget",
      "Quiet time with you",
    ],
  },
  {
    id: "lt-26",
    text: "They're most likely to cry at...",
    choices: [
      "A sad movie",
      "Animal videos",
      "A song that hits",
      "They don't really cry",
    ],
  },
  {
    id: "lt-27",
    text: "The dance move they'd pull out is...",
    choices: ["The sprinkler", "Awkward shuffle", "Confident slow dance", "Full-body commit"],
  },
  {
    id: "lt-28",
    text: "Their ideal pace through a museum is...",
    choices: [
      "Read every plaque",
      "Skim the highlights",
      "Gift shop first",
      "Nope, not a museum person",
    ],
  },
  {
    id: "lt-29",
    text: "Their go-to way to show love is...",
    choices: [
      "Cooking something",
      "Long hugs",
      "Random sweet texts",
      "Little gifts",
    ],
  },
  {
    id: "lt-30",
    text: "The small thing that always makes their day is...",
    choices: [
      "A good coffee",
      "A song they love coming on",
      "A text from you",
      "Getting into bed early",
    ],
  },
  // --- Favorites + preferences (40) ---
  { id: "lt-31", text: "Their favorite pizza topping is...", choices: ["Pepperoni", "Mushroom", "Pineapple", "Just cheese"] },
  { id: "lt-32", text: "Their go-to ice cream flavor is...", choices: ["Vanilla", "Chocolate", "Strawberry", "Mint chip"] },
  { id: "lt-33", text: "Their favorite type of weather is...", choices: ["Sunny & warm", "Rainy & cozy", "Snowy", "Crisp & cool"] },
  { id: "lt-34", text: "Their dream house is...", choices: ["Beach house", "Mountain cabin", "Downtown loft", "Big suburban place"] },
  { id: "lt-35", text: "Their favorite kind of restaurant is...", choices: ["Italian", "Mexican", "Asian fusion", "Classic American"] },
  { id: "lt-36", text: "Their preferred way to travel is...", choices: ["Plane (fastest)", "Road trip", "Train", "Boat / cruise"] },
  { id: "lt-37", text: "Their favorite holiday is...", choices: ["Christmas", "Thanksgiving", "Fourth of July", "Halloween"] },
  { id: "lt-38", text: "Their go-to cocktail is...", choices: ["Margarita", "Old fashioned", "Mojito", "Doesn't drink"] },
  { id: "lt-39", text: "Their preferred workout is...", choices: ["Running / cardio", "Weights", "Yoga", "I don't work out"] },
  { id: "lt-40", text: "Their favorite flower is...", choices: ["Rose", "Sunflower", "Tulip", "Doesn't care"] },
  { id: "lt-41", text: "Their dream car is...", choices: ["Sporty / fast", "Luxury sedan", "Big truck / SUV", "Classic / vintage"] },
  { id: "lt-42", text: "Their favorite social-media app is...", choices: ["Instagram", "TikTok", "Twitter/X", "Facebook"] },
  { id: "lt-43", text: "Their preferred TV show genre is...", choices: ["Drama", "Comedy", "Reality", "Documentary"] },
  { id: "lt-44", text: "Their dream pet situation is...", choices: ["Dog", "Cat", "Multiple pets", "No pets"] },
  { id: "lt-45", text: "Their favorite Disney era is...", choices: ["Classic (Snow White era)", "90s renaissance", "Pixar era", "Not into Disney"] },
  { id: "lt-46", text: "Their favorite fast food is...", choices: ["Burgers", "Tacos", "Chicken", "Pizza"] },
  { id: "lt-47", text: "Their karaoke song is...", choices: ["80s rock anthem", "Classic rock ballad", "Pop banger", "They'd refuse to sing"] },
  { id: "lt-48", text: "Their favorite book genre is...", choices: ["Fiction / novels", "Self-help", "Biography / memoir", "They don't read"] },
  { id: "lt-49", text: "Their favorite season of life (age-wise)?", choices: ["Childhood", "High school", "20s", "Now"] },
  { id: "lt-50", text: "The candy they'd pick at a movie?", choices: ["Sour stuff", "Chocolate", "Gummy", "Nothing — popcorn only"] },
  { id: "lt-51", text: "Their preferred bed size is...", choices: ["Queen", "King", "Full / double", "Twin"] },
  { id: "lt-52", text: "If they could retire anywhere it's...", choices: ["Beach somewhere tropical", "Mountain town", "Europe", "Exactly where they live now"] },
  { id: "lt-53", text: "Their perfect weekend morning is...", choices: ["Sleep until noon", "Up early, full agenda", "Slow with coffee", "Workout first thing"] },
  { id: "lt-54", text: "Their preferred coffee order is...", choices: ["Black", "Latte / with milk", "Cold brew", "Doesn't drink coffee"] },
  { id: "lt-55", text: "Their dream event to attend is...", choices: ["Super Bowl", "Oscars", "Coachella", "Olympic games"] },
  { id: "lt-56", text: "Their preferred Sunday activity is...", choices: ["Church or meditation", "Brunch with people", "Lazy TV day", "Outside adventure"] },
  { id: "lt-57", text: "Their most-used emoji is probably...", choices: ["😂", "❤️", "🔥", "🙄"] },
  { id: "lt-58", text: "Their go-to snack when stressed is...", choices: ["Chocolate", "Chips", "Ice cream", "They don't stress-eat"] },
  { id: "lt-59", text: "Their most prized possession is probably...", choices: ["Phone", "A piece of jewelry", "A photo / memory item", "Their car"] },
  { id: "lt-60", text: "Their dream car interior is...", choices: ["Pristine", "Lived-in / snacks in cupholders", "Somewhere between", "Depends on the day"] },
  { id: "lt-61", text: "Their favorite pizza crust is...", choices: ["Thin", "Hand-tossed", "Deep dish", "Stuffed crust"] },
  { id: "lt-62", text: "They'd pick a view of...", choices: ["Ocean", "Mountains", "City skyline", "Forest / woods"] },
  { id: "lt-63", text: "Their preferred wake-up signal is...", choices: ["Gentle alarm", "Loud buzzer", "Sun through the window", "Internal clock only"] },
  { id: "lt-64", text: "If they had to wear one color for a year, it'd be...", choices: ["Black", "White", "Their favorite color", "Denim"] },
  { id: "lt-65", text: "Their preferred drink temperature is...", choices: ["Ice cold", "Room temp", "Hot", "Depends on the drink"] },
  { id: "lt-66", text: "If forced to karaoke: they'd sing...", choices: ["Alone with a ballad", "Group song", "Something funny", "They'd hide"] },
  { id: "lt-67", text: "Their pool-or-beach preference is...", choices: ["Pool", "Beach", "Lake", "Neither — I'm indoor"] },
  { id: "lt-68", text: "Their preferred alone-time is...", choices: ["Reading", "Gaming", "Walking outside", "Scrolling"] },
  { id: "lt-69", text: "If given a free museum visit: they'd pick...", choices: ["Art", "History", "Science", "Nope, not a museum person"] },
  { id: "lt-70", text: "They'd rather win...", choices: ["$10k cash", "A dream vacation", "Year of free food", "A new car"] },
  // --- Personality + vibes (30) ---
  { id: "lt-71", text: "They'd describe themselves as more...", choices: ["Extrovert", "Introvert", "Depends on day", "Ambivert"] },
  { id: "lt-72", text: "At a conflict they...", choices: ["Talk it out immediately", "Need space first", "Avoid if possible", "Problem-solve on paper"] },
  { id: "lt-73", text: "When making big decisions they rely on...", choices: ["Gut", "Logic / lists", "Talking to people", "Sleep on it"] },
  { id: "lt-74", text: "They're secretly competitive about...", choices: ["Games", "Work", "Being right", "Nothing really"] },
  { id: "lt-75", text: "Their worst habit is...", choices: ["Procrastinating", "Overthinking", "Being on their phone", "Saying yes too much"] },
  { id: "lt-76", text: "Their best trait is...", choices: ["Sense of humor", "Empathy", "Work ethic", "Loyalty"] },
  { id: "lt-77", text: "They handle surprises by...", choices: ["Loving them", "Hating them", "Tolerating them", "Depends on the surprise"] },
  { id: "lt-78", text: "Their relationship with deadlines is...", choices: ["Early bird", "Right on time", "Down to the wire", "Flexible with"] },
  { id: "lt-79", text: "Their go-to stress coping mechanism is...", choices: ["Exercise", "Food", "Sleep", "Call someone"] },
  { id: "lt-80", text: "When they're mad they get...", choices: ["Loud", "Quiet", "Sarcastic", "Productive (cleaning etc)"] },
  { id: "lt-81", text: "They're most confident about...", choices: ["Their looks", "Their brain", "Their people skills", "Their work"] },
  { id: "lt-82", text: "Their biggest pet peeve is...", choices: ["Being late", "Loud chewing", "Being talked over", "Messy spaces"] },
  { id: "lt-83", text: "They prefer mornings or nights?", choices: ["Morning person", "Night owl", "Midday sweet spot", "Depends on sleep"] },
  { id: "lt-84", text: "In a group photo they...", choices: ["Love being front-center", "Lurk in the back", "Flex / pose", "Avoid the photo"] },
  { id: "lt-85", text: "Their texting style is...", choices: ["Short and fast", "Paragraphs", "Voice notes", "Emojis heavy"] },
  { id: "lt-86", text: "If they won the lottery they'd first...", choices: ["Tell family", "Quit their job", "Travel immediately", "Hide it / think"] },
  { id: "lt-87", text: "Their ideal party size is...", choices: ["2-3 close friends", "10ish people", "Big crowd", "Prefers alone"] },
  { id: "lt-88", text: "They'd rather do what for fun?", choices: ["Crossword / puzzle", "Play a sport", "Watch a show", "Make something"] },
  { id: "lt-89", text: "In childhood they were the...", choices: ["Class clown", "Quiet observer", "Overachiever", "Rebel / troublemaker"] },
  { id: "lt-90", text: "Their biggest fear is...", choices: ["Heights", "Small spaces", "Public speaking", "Being alone"] },
  { id: "lt-91", text: "Under pressure they...", choices: ["Thrive", "Freeze", "Joke it off", "Delegate"] },
  { id: "lt-92", text: "When given a surprise gift they...", choices: ["Open it immediately", "Save it for later", "Guess first", "Cry a little"] },
  { id: "lt-93", text: "In a crisis they call...", choices: ["Their mom/dad", "Best friend", "You", "They handle alone"] },
  { id: "lt-94", text: "When bored they default to...", choices: ["Scrolling phone", "Eating", "Nap", "Start a project"] },
  { id: "lt-95", text: "At restaurants they order...", choices: ["Their usual always", "Something new every time", "Whatever you're getting", "Takes 20 minutes to decide"] },
  { id: "lt-96", text: "They prefer giving or receiving gifts?", choices: ["Giving", "Receiving", "Both equally", "Neither — stresses them"] },
  { id: "lt-97", text: "Their relationship with asking for help is...", choices: ["Easy", "Never ask", "Only close people", "Asks too much"] },
  { id: "lt-98", text: "In a fight with a friend they...", choices: ["Confront directly", "Quietly distance", "Wait for them to reach out", "Mediator friend"] },
  { id: "lt-99", text: "Their road-trip persona is...", choices: ["DJ", "Navigator", "Driver", "Sleeping passenger"] },
  { id: "lt-100", text: "Their dancing skill is...", choices: ["Actually good", "Confident but chaotic", "Shy at first", "Refuses to dance"] },
  // --- Us / relationship (30) ---
  { id: "lt-101", text: "Where did we first meet (or how they'd describe it)?", choices: ["Funny coincidence", "Through friends", "Online", "Work-related"] },
  { id: "lt-102", text: "Our first date vibe was...", choices: ["Magic", "Awkward but cute", "Slow burn", "Instant chemistry"] },
  { id: "lt-103", text: "They knew I was the one when...", choices: ["Right away", "Few dates in", "After a specific moment", "It was a slow realization"] },
  { id: "lt-104", text: "The first thing they noticed about me was...", choices: ["My eyes", "My smile", "My laugh", "My voice"] },
  { id: "lt-105", text: "Our love language as a couple is mostly...", choices: ["Words", "Touch", "Acts of service", "Quality time"] },
  { id: "lt-106", text: "They show affection most by...", choices: ["Saying it out loud", "Hugs & touch", "Doing things for me", "Little gifts"] },
  { id: "lt-107", text: "Our best memory together is...", choices: ["A specific trip", "An ordinary day", "A hard moment we got through", "The first kiss"] },
  { id: "lt-108", text: "They'd pick our anniversary gift category as...", choices: ["Experience", "Jewelry / personal item", "Something handmade", "They ask what I want"] },
  { id: "lt-109", text: "Their favorite thing about us is...", choices: ["How we laugh together", "Our communication", "Our intimacy", "How we handle hard stuff"] },
  { id: "lt-110", text: "Our biggest recurring argument is about...", choices: ["Who does chores", "Money / spending", "Time together vs apart", "Family or in-laws"] },
  { id: "lt-111", text: "They want to travel with me to...", choices: ["Italy", "Japan", "Somewhere tropical", "Just a road trip is fine"] },
  { id: "lt-112", text: "When I'm sad they mostly...", choices: ["Hold me quietly", "Try to fix it", "Distract me", "Ask what I need"] },
  { id: "lt-113", text: "Their favorite photo of us is...", choices: ["Silly candid", "Posed / fancy", "An old one from early days", "Recent one"] },
  { id: "lt-114", text: "They'd describe my love style as...", choices: ["Passionate", "Steady", "Playful", "Deep"] },
  { id: "lt-115", text: "Our shared chore disaster is...", choices: ["Dishes", "Laundry", "Trash", "None — we split fine"] },
  { id: "lt-116", text: "If we got a pet today it'd be...", choices: ["Dog", "Cat", "Plant (pet-adjacent)", "Absolutely not"] },
  { id: "lt-117", text: "Our relationship song is...", choices: ["A slow love song", "Something upbeat", "An 80s classic", "We don't have one"] },
  { id: "lt-118", text: "The first fight we had was about...", choices: ["Miscommunication", "Money / logistics", "Family", "Jealousy"] },
  { id: "lt-119", text: "Our ideal Saturday night in would be...", choices: ["Movie + takeout", "Cooking together", "Board games", "Going to bed early"] },
  { id: "lt-120", text: "They'd say the sexiest thing I do is...", choices: ["A specific look I give", "The way I laugh", "How I focus on things", "Random kindness"] },
  { id: "lt-121", text: "Our shared guilty pleasure is...", choices: ["A trashy TV show", "Late-night junk food", "Spending too much on food delivery", "Singing badly in the car"] },
  { id: "lt-122", text: "If we had a kid they'd want to...", choices: ["Teach them sports", "Teach them art", "Take them everywhere", "Still figuring it out"] },
  { id: "lt-123", text: "Our future-dream big purchase is...", choices: ["A house", "A car", "A trip of a lifetime", "Investing / saving"] },
  { id: "lt-124", text: "When they miss me they...", choices: ["Text constantly", "Call randomly", "Stay quiet until we talk", "Plan a surprise"] },
  { id: "lt-125", text: "The tiny thing I do that they love is...", choices: ["A specific touch", "A word I say", "A look", "How I make them laugh"] },
  { id: "lt-126", text: "They'd say my best trait is...", choices: ["My kindness", "My humor", "My loyalty", "My ambition"] },
  { id: "lt-127", text: "Their dream weekend with me is...", choices: ["Just us, no phones", "A new city", "Stay home, no plans", "Group hangout"] },
  { id: "lt-128", text: "If we had a catchphrase it'd be...", choices: ["An inside joke word", "'Love you' variations", "A silly greeting", "We don't really have one"] },
  { id: "lt-129", text: "Our pet name style is...", choices: ["Traditional (babe, honey)", "Goofy / made-up", "Using our real names", "Changes every week"] },
  { id: "lt-130", text: "They'd want their ideal morning with me to include...", choices: ["Cuddling in bed", "Coffee together", "A walk", "Still asleep"] },
  // --- Weird / fun hypotheticals (20) ---
  { id: "lt-131", text: "If they were an animal they'd be a...", choices: ["Dog", "Cat", "Something wild", "Owl / nocturnal"] },
  { id: "lt-132", text: "Their childhood cartoon would be...", choices: ["SpongeBob", "Rugrats", "Scooby-Doo", "Pokemon"] },
  { id: "lt-133", text: "They'd pick their time machine destination as...", choices: ["Ancient times", "70s/80s", "50 years into the future", "Never — stay in the present"] },
  { id: "lt-134", text: "If they could only eat one cuisine forever: ...", choices: ["Italian", "Mexican", "Asian", "American classics"] },
  { id: "lt-135", text: "Zombie apocalypse role: ...", choices: ["Leader", "Scavenger", "Medic", "They die first"] },
  { id: "lt-136", text: "Their dream superpower is...", choices: ["Fly", "Invisible", "Read minds", "Teleport"] },
  { id: "lt-137", text: "If they could be famous for one thing: ...", choices: ["Music", "Acting", "Inventing something", "Activism / change"] },
  { id: "lt-138", text: "They'd name their dog...", choices: ["Classic human name", "Something goofy", "After a character", "Plain / short"] },
  { id: "lt-139", text: "If they won a gold medal it'd be in...", choices: ["A physical sport", "A mind sport (chess etc)", "Eating contest", "Napping"] },
  { id: "lt-140", text: "In a heist movie they'd be...", choices: ["The mastermind", "The muscle", "The tech person", "The getaway driver"] },
  { id: "lt-141", text: "They'd want their funeral song to be...", choices: ["A somber classic", "A banger everyone dances to", "Their favorite band's song", "They haven't thought about it"] },
  { id: "lt-142", text: "Pick their Hogwarts house...", choices: ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"] },
  { id: "lt-143", text: "Their star sign energy is...", choices: ["Fire sign", "Earth sign", "Air sign", "Water sign"] },
  { id: "lt-144", text: "Their go-to impression of someone is...", choices: ["Their mom/dad", "A famous person", "Me", "They don't do impressions"] },
  { id: "lt-145", text: "They'd pick as their 'dream co-worker': ...", choices: ["A comedian", "A genius", "Their best friend", "Just someone low-drama"] },
  { id: "lt-146", text: "If they were a bartender, their signature drink would be...", choices: ["Spicy", "Sweet", "Sour", "Strong and simple"] },
  { id: "lt-147", text: "They think aliens exist?", choices: ["Definitely", "Probably", "Probably not", "No way"] },
  { id: "lt-148", text: "Pineapple on pizza: their stance?", choices: ["Yes, obviously", "Absolutely not", "Only sometimes", "Don't care either way"] },
  { id: "lt-149", text: "They'd pick their villain origin story as...", choices: ["Heartbreak", "Betrayal by friends", "Childhood trauma", "Society failed them"] },
  { id: "lt-150", text: "If they had to give a TED talk, the topic would be...", choices: ["Their job / expertise", "A life lesson", "A hobby they love", "They'd refuse to do it"] },
];

function pickLoveTriviaQuestions(n: number): LoveTriviaQuestion[] {
  const shuffled = [...LOVE_TRIVIA_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// --- Neon Stacker (classic arcade stacker, server-authoritative) ---

type NeonStackerBlock = {
  x: number;
  width: number;
  playerIdx: 0 | 1 | null;
};

type NeonStackerMoving = {
  width: number;
  minX: number;
  maxX: number;
  speed: number;
  startedAt: number;
};

type NeonStackerState = {
  gameId: "neon-stacker";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  fieldWidth: number;
  stack: NeonStackerBlock[];
  moving: NeonStackerMoving | null;
  nextPlayerIdx: 0 | 1;
  dropsInLevel: number;
  level: number;
  playerDropCounts: [number, number];
  winnerIdx: 0 | 1 | null;
  banner: string | null;
  startedAt: number;
};

// Playfield constants — all values in logical units; client scales to canvas.
const NS_FIELD_WIDTH = 600;
const NS_BASE_PLATFORM_WIDTH = 150;
const NS_DROPS_PER_LEVEL = 5;
const NS_BASE_BLOCK_WIDTH = 120;
const NS_MIN_BLOCK_WIDTH = 40;
const NS_LEVEL_WIDTH_SHRINK = 10;
const NS_BASE_SPEED = 220; // units/second
const NS_SPEED_PER_LEVEL = 35;
const NS_MAX_SPEED = 520;

function neonStackerBlockWidthForLevel(level: number): number {
  const w = NS_BASE_BLOCK_WIDTH - (level - 1) * NS_LEVEL_WIDTH_SHRINK;
  return Math.max(NS_MIN_BLOCK_WIDTH, w);
}

function neonStackerSpeedForLevel(level: number): number {
  const s = NS_BASE_SPEED + (level - 1) * NS_SPEED_PER_LEVEL;
  return Math.min(NS_MAX_SPEED, s);
}

function neonStackerMakeMoving(
  width: number,
  level: number,
): NeonStackerMoving {
  const half = width / 2;
  return {
    width,
    minX: half,
    maxX: NS_FIELD_WIDTH - half,
    speed: neonStackerSpeedForLevel(level),
    startedAt: Date.now(),
  };
}

/** Deterministic position of the moving block at time `t` (ms). */
function neonStackerMovingX(m: NeonStackerMoving, t: number): number {
  const range = m.maxX - m.minX;
  if (range <= 0) return m.minX;
  const elapsed = Math.max(0, t - m.startedAt) / 1000;
  const traveled = elapsed * m.speed;
  const cycle = range * 2;
  const phase = traveled - Math.floor(traveled / cycle) * cycle;
  return phase <= range ? m.minX + phase : m.maxX - (phase - range);
}

type ActiveGame =
  | TicTacToeState
  | ConnectFourState
  | HangmanState
  | BattleshipInternal
  | DrawingGameState
  | NeonStackerState
  | LoveTriviaState
  | PromptGameState
  | LovingQuestState
  | WordChainState
  | TriviaState;

type Room = {
  code: string;
  /** Locked to these two clientIds after the second join. Mirrors DB when USE_DB. */
  owners: string[];
  peers: Map<string, Peer & { socketId: string }>;
  notes: Note[];
  game: ActiveGame | null;
  lastActivity: number;
};

const PORT = Number(process.env.PORT) || 3001;
const MAX_PEERS_PER_ROOM = 2;
const MAX_NOTES_PER_ROOM = 100;
const IDLE_ROOM_MS = 60 * 60 * 1000;

const rooms = new Map<string, Room>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getOrCreateRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      owners: [],
      peers: new Map(),
      notes: [],
      game: null,
      lastActivity: Date.now(),
    };
    rooms.set(code, room);
  }
  room.lastActivity = Date.now();
  return room;
}

function publicPeers(room: Room): Peer[] {
  return Array.from(room.peers.values()).map((p) => ({
    clientId: p.clientId,
    name: p.name,
  }));
}

const TTT_WIN_LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkTTTWinner(
  board: (TicTacToeSide | null)[],
): TicTacToeSide | "draw" | null {
  for (const [a, b, c] of TTT_WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

// --- Connect Four helpers ---
const C4_ROWS = 6;
const C4_COLS = 7;

function dropC4Piece(
  board: (ConnectFourSide | null)[],
  col: number,
  side: ConnectFourSide,
): number | null {
  // Returns the flat index where the piece landed, or null if column full.
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    const idx = r * C4_COLS + col;
    if (board[idx] === null) {
      board[idx] = side;
      return idx;
    }
  }
  return null;
}

function checkC4Winner(board: (ConnectFourSide | null)[]): {
  winner: ConnectFourSide | "draw" | null;
  line: number[] | null;
} {
  const rows = C4_ROWS;
  const cols = C4_COLS;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = board[r * cols + c];
      if (!v) continue;
      // horizontal
      if (
        c + 3 < cols &&
        board[r * cols + c + 1] === v &&
        board[r * cols + c + 2] === v &&
        board[r * cols + c + 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            r * cols + c + 1,
            r * cols + c + 2,
            r * cols + c + 3,
          ],
        };
      }
      // vertical
      if (
        r + 3 < rows &&
        board[(r + 1) * cols + c] === v &&
        board[(r + 2) * cols + c] === v &&
        board[(r + 3) * cols + c] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c,
            (r + 2) * cols + c,
            (r + 3) * cols + c,
          ],
        };
      }
      // diag down-right
      if (
        r + 3 < rows &&
        c + 3 < cols &&
        board[(r + 1) * cols + c + 1] === v &&
        board[(r + 2) * cols + c + 2] === v &&
        board[(r + 3) * cols + c + 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c + 1,
            (r + 2) * cols + c + 2,
            (r + 3) * cols + c + 3,
          ],
        };
      }
      // diag down-left
      if (
        r + 3 < rows &&
        c - 3 >= 0 &&
        board[(r + 1) * cols + c - 1] === v &&
        board[(r + 2) * cols + c - 2] === v &&
        board[(r + 3) * cols + c - 3] === v
      ) {
        return {
          winner: v,
          line: [
            r * cols + c,
            (r + 1) * cols + c - 1,
            (r + 2) * cols + c - 2,
            (r + 3) * cols + c - 3,
          ],
        };
      }
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: null };
  }
  return { winner: null, line: null };
}

// --- Hangman helpers ---
const HANGMAN_WORDS = [
  "apple", "banana", "castle", "dragon", "eagle", "forest", "garden",
  "harbor", "island", "jungle", "kitten", "lemon", "meadow", "nebula",
  "ocean", "pepper", "quartz", "ribbon", "sunset", "travel", "unicorn",
  "violet", "wizard", "yellow", "zephyr", "bridge", "coffee", "danger",
  "escape", "flower", "guitar", "honest", "jacket", "ladder", "mirror",
  "napkin", "orange", "puzzle", "rocket", "silver", "tunnel", "velvet",
  "window", "button", "camera", "dinner", "engine", "friend", "giggle",
  "hollow", "insect", "jelly", "knight", "legend", "magnet", "nature",
];

function pickHangmanWord(): string {
  return HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
}

function checkHangmanWin(word: string, guessed: string[]): boolean {
  return word.split("").every((ch) => guessed.includes(ch));
}

// --- Drawing game helpers ---

function generateDrawingPrompt(): string {
  const prompts = [
    "A cat wearing sunglasses",
    "Your dream house",
    "A happy sun with a face",
    "A dog driving a car",
    "Pizza with wings",
    "A smiling flower",
    "Your partner as a superhero",
    "A friendly monster",
    "A fish with legs",
    "A dancing banana",
    "A house on wheels",
    "A bird wearing a hat",
    "A laughing cloud",
    "A tree with eyes",
    "A car made of cheese",
    "A flying pig",
    "A robot cooking dinner",
    "A singing microphone",
    "A sleepy moon",
    "A bouncing ball with arms",
    "Your favorite food as a person",
    "A bicycle with butterfly wings",
    "A smiling toothbrush",
    "A dancing slice of cake",
    "A submarine in the sky",
    "A penguin at the beach",
    "A cactus wearing shoes",
    "A rainbow with a face",
    "A book reading itself",
    "A clock that's running late",
    "The inside of a vending machine's dreams"
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

function generateJudgeScore(judge: "fido" | "reginald" | "veloura", prompt: string): { score: number; comment: string } {
  const score = Math.floor(Math.random() * 10) + 1;

  if (judge === "fido") {
    const fidoLines = [
      "tail is wagging at MAXIMUM speed",
      "I like this. Can I have a treat now?",
      "good drawing. good human.",
      "I don't get it but I love it",
      "this makes my heart go bork bork",
      "would definitely sniff this drawing",
      "looks like something I'd chase in the park",
      "reminds me of my favorite stick",
      "this deserves ALL the belly rubs",
      "I want to play fetch with whatever this is",
      "very good! much art! wow!",
      "this drawing smells like happiness",
    ];
    return {
      score: Math.max(6, score), // Fido tends to score higher
      comment: fidoLines[Math.floor(Math.random() * fidoLines.length)],
    };
  } else if (judge === "reginald") {
    const reginaldLines = [
      "I've seen worse. Not often, but I have.",
      "confusing, but oddly committed",
      "I resent that I like this",
      "bold. deeply unfortunate, but bold",
      "this challenges my very understanding of art",
      "reminds me of my nephew's finger painting phase",
      "technically... well, no, it's not technical at all",
      "I suppose someone will find this charming",
      "the composition lacks... everything, really",
      "surprisingly not the worst thing I've judged today",
      "abstract in the sense that I cannot tell what it is",
      "daring choice to ignore all artistic conventions",
    ];
    return {
      score,
      comment: reginaldLines[Math.floor(Math.random() * reginaldLines.length)],
    };
  } else { // veloura
    const velouraLines = [
      "this has flair. I respect the drama",
      "oh we're SERVING tonight",
      "I don't understand it... but I feel it",
      "this is chaotic, but beautifully chaotic",
      "this needs confidence. and maybe a redo",
      "giving me avant-garde vibes, darling",
      "not what I expected, but I'm here for it",
      "this drawing said 'I have ARRIVED'",
      "pure artistic expression, honey",
      "I see the vision... sort of",
      "this is giving me life right now",
      "fabulous in its own unique way, sweetie",
    ];
    return {
      score: score <= 3 ? Math.max(4, score) : score, // Veloura avoids very low scores
      comment: velouraLines[Math.floor(Math.random() * velouraLines.length)],
    };
  }
}

function advanceToReveal(game: any, room: Room) {
  if (game.gameId !== "drawing") return;

  game.phase = "reveal";

  // After a delay, start judging
  setTimeout(() => {
    if (game.phase === "reveal") {
      startJudging(game, room);
    }
  }, 3000);

  emitGameUpdate(room);
}

function startJudging(game: any, room: Room) {
  if (game.gameId !== "drawing") return;

  game.phase = "judging";

  // Generate judge scores
  const judges: ("fido" | "reginald" | "veloura")[] = ["fido", "reginald", "veloura"];
  game.judgeScores = judges.map(judge => ({
    judge,
    ...generateJudgeScore(judge, game.prompt),
    revealed: false,
  }));

  // Complete judging after all judges have "spoken"
  setTimeout(() => {
    if (game.phase === "judging") {
      game.phase = "complete";
      emitGameUpdate(room);

      // Award points and record game
      persistGameEnd(room, game, io);
    }
  }, 8000); // 8 seconds for all judges to reveal

  emitGameUpdate(room);
}

// --- Battleship helpers ---
const BS_GRID = 10;
const BS_FLEET_DEF: { name: string; len: number }[] = [
  { name: "CARRIER", len: 5 },
  { name: "BATTLESHIP", len: 4 },
  { name: "CRUISER", len: 3 },
  { name: "SUBMARINE", len: 3 },
  { name: "DESTROYER", len: 2 },
];

function shipCells(
  ship: { x: number; y: number; len: number; vertical: boolean },
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push({
      x: ship.vertical ? ship.x : ship.x + i,
      y: ship.vertical ? ship.y + i : ship.y,
    });
  }
  return cells;
}

function validateFleetPlacement(
  ships: {
    name: string;
    len: number;
    x: number;
    y: number;
    vertical: boolean;
  }[],
): boolean {
  if (!Array.isArray(ships) || ships.length !== BS_FLEET_DEF.length) return false;
  // Fleet composition must match exactly.
  const expected = [...BS_FLEET_DEF].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const got = [...ships]
    .map((s) => ({ name: s.name, len: s.len }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].name !== got[i].name || expected[i].len !== got[i].len) {
      return false;
    }
  }
  // Each ship must fit on grid and not overlap.
  const occupied = new Set<string>();
  for (const ship of ships) {
    if (
      !Number.isInteger(ship.x) ||
      !Number.isInteger(ship.y) ||
      typeof ship.vertical !== "boolean"
    ) {
      return false;
    }
    if (ship.x < 0 || ship.y < 0) return false;
    const endX = ship.vertical ? ship.x : ship.x + ship.len - 1;
    const endY = ship.vertical ? ship.y + ship.len - 1 : ship.y;
    if (endX >= BS_GRID || endY >= BS_GRID) return false;
    for (const cell of shipCells(ship)) {
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
  }
  return true;
}

function isGameOver(game: ActiveGame): boolean {
  if (game.gameId === "battleship") return game.winnerIdx !== null;
  if (game.gameId === "drawing") return game.phase === "complete";
  if (game.gameId === "neon-stacker") return game.winnerIdx !== null;
  if (game.gameId === "word-chain") return game.winnerIdx !== null;
  if (game.gameId === "trivia") return game.winner !== null;
  if (game.gameId === "love-trivia") return game.winner !== null;
  if (game.gameId === "truth-or-dare") return game.winner !== null;
  if (game.gameId === "spicy-zone") return game.winner !== null;
  if (game.gameId === "loving-quest") return game.winner !== null;
  return game.winner !== null;
}

/**
 * Called after a move that ended a game. Writes game_records + points_events.
 * Safe to call when USE_DB is false (becomes a no-op). Never throws — DB
 * failures are logged but must not break the live game flow.
 */
async function persistGameEnd(room: Room, game: ActiveGame, io: Server): Promise<void> {
  try {
    let winnerClientId: string | null = null;
    let loserClientId: string | null = null;
    let outcome: "win" | "draw" | "coop-win" | "coop-loss" = "win";
    const pointsAwards: { clientId: string; delta: number; reason: string }[] =
      [];

    if (game.gameId === "tic-tac-toe") {
      if (game.winner === "draw") {
        outcome = "draw";
      } else if (game.winner) {
        outcome = "win";
        winnerClientId = game.players[game.winner].clientId;
        loserClientId =
          game.winner === "X"
            ? game.players.O.clientId
            : game.players.X.clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 10,
          reason: "tic-tac-toe win",
        });
      }
    } else if (game.gameId === "connect-four") {
      if (game.winner === "draw") {
        outcome = "draw";
      } else if (game.winner) {
        outcome = "win";
        winnerClientId = game.players[game.winner].clientId;
        loserClientId =
          game.winner === "red"
            ? game.players.yellow.clientId
            : game.players.red.clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 15,
          reason: "connect-four win",
        });
      }
    } else if (game.gameId === "hangman") {
      if (game.winner === "win") {
        outcome = "coop-win";
        // Cooperative — both players get points.
        for (const p of game.players) {
          pointsAwards.push({
            clientId: p.clientId,
            delta: 12,
            reason: "hangman win",
          });
        }
      } else if (game.winner === "lose") {
        outcome = "coop-loss";
      }
    } else if (game.gameId === "battleship") {
      if (game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 25,
          reason: "neon-fleet win",
        });
      }
    } else if (game.gameId === "neon-stacker") {
      if (game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 20,
          reason: "neon-stacker win",
        });
      }
    } else if (game.gameId === "love-trivia") {
      if (game.winner === "done") {
        // Cooperative — both players score for however well they
        // predicted their partner. Up to 20 points each (2 per
        // correct prediction out of 10).
        outcome = "coop-win";
        const awards: Array<{ clientId: string; delta: number; reason: string }> =
          [];
        game.players.forEach((p, idx) => {
          const score = game.scores[idx];
          const delta = Math.min(20, score * 2);
          if (delta > 0) {
            awards.push({
              clientId: p.clientId,
              delta,
              reason: `couples-trivia ${score}/10`,
            });
          }
        });
        for (const award of awards) pointsAwards.push(award);
      }
    } else if (
      game.gameId === "truth-or-dare" ||
      game.gameId === "spicy-zone"
    ) {
      if (game.winner === "win") {
        // Cooperative — both players score just for finishing.
        outcome = "coop-win";
        for (const p of game.players) {
          pointsAwards.push({
            clientId: p.clientId,
            delta: 10,
            reason: `${game.gameId} finished`,
          });
        }
      }
    } else if (game.gameId === "loving-quest") {
      if (game.winner === "done") {
        outcome = "coop-win";
        for (const p of game.players) {
          pointsAwards.push({
            clientId: p.clientId,
            delta: 15,
            reason: "loving-quest completed",
          });
        }
      }
    } else if (game.gameId === "word-chain") {
      if (game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 18,
          reason: "word-chain win",
        });
      }
    } else if (game.gameId === "trivia") {
      if (game.winner === "draw") {
        outcome = "draw";
      } else if (game.winner === "win" && game.winnerIdx !== null) {
        outcome = "win";
        winnerClientId = game.players[game.winnerIdx].clientId;
        loserClientId =
          game.winnerIdx === 0
            ? game.players[1].clientId
            : game.players[0].clientId;
        pointsAwards.push({
          clientId: winnerClientId,
          delta: 20,
          reason: "trivia win",
        });
      }
    }

    await dbRecordGame({
      room_code: room.code,
      game_id: game.gameId,
      winner_client_id: winnerClientId,
      loser_client_id: loserClientId,
      outcome,
      started_at: new Date(game.startedAt).toISOString(),
      meta: null,
    });

    for (const award of pointsAwards) {
      await dbRecordPoints(
        room.code,
        award.clientId,
        award.delta,
        award.reason,
      );
    }

    // Sync updated points to all clients in the room after awarding points
    if (pointsAwards.length > 0) {
      try {
        const balances = await pointsBalances(room.code);
        for (const [clientId] of room.peers) {
          const currentPoints = balances[clientId] || 0;
          io.to(room.code).emit("points:sync", {
            clientId: clientId,
            points: currentPoints,
          });
        }
      } catch (err) {
        console.error("[swoono] points sync error:", err);
      }
    }

    // Broadcast the updated game history so both clients can refresh
    // their Recent Games panel without a round-trip.
    try {
      const rows = await dbListGameRecords(room.code, 25);
      const records = rows.map((r) => ({
        id: r.id,
        roomCode: r.room_code,
        gameId: r.game_id,
        winnerClientId: r.winner_client_id,
        loserClientId: r.loser_client_id,
        outcome: r.outcome,
        startedAt: new Date(r.started_at).getTime(),
        finishedAt: new Date(r.finished_at).getTime(),
      }));
      io.to(room.code).emit("records:update", { records });
    } catch (err) {
      console.error("[swoono] records broadcast error:", err);
    }
  } catch (err) {
    console.error("[swoono] persistGameEnd error:", err);
  }
}

function buildBattleshipViewFor(
  game: BattleshipInternal,
  myIdx: 0 | 1,
): {
  gameId: "battleship";
  phase: "placement" | "battle" | "done";
  myIdx: 0 | 1;
  myName: string;
  opponentName: string;
  myReady: boolean;
  opponentReady: boolean;
  myShips: BattleshipShipData[];
  myShotsFired: BattleshipShot[];
  opponentShotsFired: BattleshipShot[];
  turnIdx: 0 | 1;
  winnerIdx: 0 | 1 | null;
  startedAt: number;
} {
  const oppIdx: 0 | 1 = myIdx === 0 ? 1 : 0;
  const me = game.players[myIdx];
  const opp = game.players[oppIdx];
  return {
    gameId: "battleship",
    phase: game.phase,
    myIdx,
    myName: me.name,
    opponentName: opp.name,
    myReady: me.ready,
    opponentReady: opp.ready,
    myShips: me.ships,
    myShotsFired: game.shotHistory[myIdx],
    opponentShotsFired: game.shotHistory[oppIdx],
    turnIdx: game.turnIdx,
    winnerIdx: game.winnerIdx,
    startedAt: game.startedAt,
  };
}

function emitGameUpdate(room: Room) {
  const game = room.game;
  if (!game) {
    io.to(room.code).emit("game:update", { game: null });
    return;
  }
  if (game.gameId === "battleship") {
    // Per-player redacted views.
    for (const peer of room.peers.values()) {
      const idx: 0 | 1 =
        game.players[0].clientId === peer.clientId ? 0 : 1;
      const view = buildBattleshipViewFor(game, idx);
      io.to(peer.socketId).emit("game:update", { game: view });
    }
    return;
  }
  io.to(room.code).emit("game:update", { game });
}

const app = express();

// Add raw body parser for Stripe webhook before other middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Add JSON middleware for other routes
app.use(express.json());

// Import and mount Stripe routes
import stripeRouter from './routes/stripe';
app.use('/api/stripe', stripeRouter);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Serve the built Vite client. server/dist/index.js -> ../../client/dist.
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: process.uptime(),
  });
});

// SPA catch-all for client-side routing (must come after API routes).
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

type JoinPayload = { code: string; name: string; clientId: string };
type NoteCreatePayload = { text: string; color: string };

io.on("connection", (socket: Socket) => {
  let joinedCode: string | null = null;
  let joinedClientId: string | null = null;

  socket.on("join", async (payload: JoinPayload, ack?: (res: unknown) => void) => {
    const rawCode = sanitizeRoomCode(payload?.code || "");
    const name = sanitizeDisplayName(payload?.name || "");
    const clientId = payload?.clientId || makeId();

    if (!rawCode) {
      ack?.({ ok: false, error: "Room code required" });
      return;
    }

    const room = getOrCreateRoom(rawCode);

    // Persistent path: authoritative ownership + notes live in Supabase.
    try {
      const { room: dbRoom } = await dbJoinRoom(rawCode, clientId, name);
      room.owners = dbRoom.owner_client_ids || [];
      // Load notes from DB into in-memory cache so existing code paths work.
      const dbNotes = await dbListNotes(rawCode, MAX_NOTES_PER_ROOM);
      room.notes = dbNotes.map((n) => ({
        id: n.id,
        roomCode: n.room_code,
        authorClientId: n.author_client_id,
        authorName: n.author_name,
        text: n.text,
        color: n.color,
        createdAt: new Date(n.created_at).getTime(),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "room_locked") {
        ack?.({
          ok: false,
          error: "Room is full (2 players maximum)",
        });
        return;
      }
      console.error("[swoono] join DB error:", err);
      ack?.({ ok: false, error: "Server error joining room" });
      return;
    }
    // Database is now required - no in-memory fallback

    // Rebind / add socket for the peer.
    const existing = room.peers.get(clientId);
    if (existing) {
      existing.socketId = socket.id;
      existing.name = name;
    } else {
      room.peers.set(clientId, { clientId, name, socketId: socket.id });
    }

    joinedCode = rawCode;
    joinedClientId = clientId;
    socket.join(rawCode);

    // Load recent game history so the leaderboard panel has something
    // to show the moment the room opens.
    let recentRecords: {
      id: string;
      roomCode: string;
      gameId: string;
      winnerClientId: string | null;
      loserClientId: string | null;
      outcome: "win" | "draw" | "coop-win" | "coop-loss";
      startedAt: number;
      finishedAt: number;
    }[] = [];
    if (USE_DB) {
      try {
        const rows = await dbListGameRecords(rawCode, 25);
        recentRecords = rows.map((r) => ({
          id: r.id,
          roomCode: r.room_code,
          gameId: r.game_id,
          winnerClientId: r.winner_client_id,
          loserClientId: r.loser_client_id,
          outcome: r.outcome,
          startedAt: new Date(r.started_at).getTime(),
          finishedAt: new Date(r.finished_at).getTime(),
        }));
      } catch (err) {
        console.error("[swoono] join records fetch error:", err);
      }
    }

    ack?.({
      ok: true,
      room: {
        code: rawCode,
        peers: publicPeers(room),
        notes: room.notes,
        records: recentRecords,
      },
    });

    io.to(rawCode).emit("presence", { peers: publicPeers(room) });

    // Sync current points to the joining client
    try {
      const balances = await pointsBalances(rawCode);
      const clientPoints = balances[clientId] || 0;
      socket.emit("points:sync", { clientId, points: clientPoints });
    } catch (err) {
      console.error("[swoono] join points sync error:", err);
    }

    // If a game is already in progress (player rejoining), send them its state.
    if (room.game) {
      emitGameUpdate(room);
    }
  });

  socket.on("note:create", async (payload: NoteCreatePayload) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    const me = Array.from(room.peers.values()).find(
      (p) => p.socketId === socket.id,
    );
    if (!me) return;

    const text = sanitizeString(payload?.text || "", 500);
    if (!text.trim()) return;
    const color = sanitizeString(payload?.color || "yellow", 20);

    let note: Note;

    try {
      const row = await dbInsertNote({
        room_code: room.code,
        author_client_id: me.clientId,
        author_name: me.name,
        text,
        color,
      });
      note = {
        id: row.id,
        roomCode: row.room_code,
        authorClientId: row.author_client_id,
        authorName: row.author_name,
        text: row.text,
        color: row.color,
        createdAt: new Date(row.created_at).getTime(),
      };
      await dbTouchRoom(room.code);
    } catch (err) {
      console.error("[swoono] note:create DB error:", err);
      return;
    }

    room.notes.push(note);
    if (room.notes.length > MAX_NOTES_PER_ROOM) {
      room.notes.splice(0, room.notes.length - MAX_NOTES_PER_ROOM);
    }
    room.lastActivity = Date.now();

    io.to(room.code).emit("note:new", note);
  });

  // -- Games ---------------------------------------------------------------
  socket.on("game:start", (payload: { gameId: string }) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    if (room.game && !isGameOver(room.game)) return; // already in play

    const peerArr = Array.from(room.peers.values());
    if (peerArr.length !== 2) return;

    const me = peerArr.find((p) => p.socketId === socket.id);
    if (!me) return;
    const other = peerArr.find((p) => p.socketId !== socket.id);
    if (!other) return;

    const gameId = payload?.gameId;
    let game: ActiveGame | null = null;

    if (gameId === "tic-tac-toe") {
      game = {
        gameId: "tic-tac-toe",
        board: Array(9).fill(null),
        players: {
          X: { clientId: me.clientId, name: me.name },
          O: { clientId: other.clientId, name: other.name },
        },
        nextPlayer: "X",
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "connect-four") {
      game = {
        gameId: "connect-four",
        board: Array(C4_ROWS * C4_COLS).fill(null),
        players: {
          red: { clientId: me.clientId, name: me.name },
          yellow: { clientId: other.clientId, name: other.name },
        },
        nextPlayer: "red",
        winner: null,
        winningLine: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "hangman") {
      game = {
        gameId: "hangman",
        word: pickHangmanWord(),
        guessedLetters: [],
        wrongCount: 0,
        maxWrong: 6,
        nextPlayerIdx: 0,
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "battleship") {
      game = {
        gameId: "battleship",
        phase: "placement",
        players: [
          {
            clientId: me.clientId,
            name: me.name,
            ships: [],
            ready: false,
          },
          {
            clientId: other.clientId,
            name: other.name,
            ships: [],
            ready: false,
          },
        ],
        shotHistory: [[], []],
        turnIdx: 0,
        winnerIdx: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "drawing") {
      const prompt = generateDrawingPrompt();
      game = {
        gameId: "drawing",
        phase: "drawing",
        prompt,
        timeLimit: 120, // 2 minutes
        timeRemaining: 120,
        players: {
          [me.clientId]: {
            name: me.name,
            drawing: { strokes: [] },
            readyForReveal: false,
          },
          [other.clientId]: {
            name: other.name,
            drawing: { strokes: [] },
            readyForReveal: false,
          },
        },
        judgeScores: [],
        currentJudgeIdx: 0,
        startedAt: Date.now(),
      };

      // Start countdown timer
      const countdown = setInterval(() => {
        if (game && game.gameId === "drawing" && game.phase === "drawing") {
          game.timeRemaining = Math.max(0, game.timeRemaining - 1);
          if (game.timeRemaining <= 0) {
            clearInterval(countdown);
            // Auto-advance to reveal if time runs out
            setTimeout(() => {
              if (game && game.gameId === "drawing" && game.phase === "drawing") {
                advanceToReveal(game, room);
              }
            }, 2000);
          }
          emitGameUpdate(room);
        } else {
          clearInterval(countdown);
        }
      }, 1000);
    } else if (gameId === "neon-stacker") {
      const platform: NeonStackerBlock = {
        x: NS_FIELD_WIDTH / 2,
        width: NS_BASE_PLATFORM_WIDTH,
        playerIdx: null,
      };
      game = {
        gameId: "neon-stacker",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        fieldWidth: NS_FIELD_WIDTH,
        stack: [platform],
        moving: neonStackerMakeMoving(
          neonStackerBlockWidthForLevel(1),
          1,
        ),
        nextPlayerIdx: 0,
        dropsInLevel: 0,
        level: 1,
        playerDropCounts: [0, 0],
        winnerIdx: null,
        banner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "love-trivia") {
      const questions = pickLoveTriviaQuestions(10);
      game = {
        gameId: "love-trivia",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        phase: "setup",
        questions,
        setupPredictions: [
          new Array(questions.length).fill(null),
          new Array(questions.length).fill(null),
        ],
        gameAnswers: [
          new Array(questions.length).fill(null),
          new Array(questions.length).fill(null),
        ],
        currentIdx: 0,
        scores: [0, 0],
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "truth-or-dare" || gameId === "spicy-zone") {
      game = {
        gameId,
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        turnIdx: 0,
        currentPrompt: null,
        roundsCompleted: 0,
        totalRounds: 10,
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "loving-quest") {
      game = {
        gameId: "loving-quest",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        prompts: pickLovingQuestPrompts(6),
        currentIdx: 0,
        doneFlags: [false, false],
        winner: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "word-chain") {
      game = {
        gameId: "word-chain",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        turnIdx: 0,
        nextLetter: randomStartLetter(),
        history: [],
        winnerIdx: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "trivia") {
      game = {
        gameId: "trivia",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        questions: pickTriviaQuestions(10),
        currentIdx: 0,
        lockedOut: [false, false],
        scores: [0, 0],
        winner: null,
        winnerIdx: null,
        startedAt: Date.now(),
      };
    } else {
      return; // unknown game id
    }

    room.game = game;
    room.lastActivity = Date.now();
    emitGameUpdate(room);
  });

  socket.on(
    "game:move",
    (payload: {
      cellIndex?: number;
      column?: number;
      letter?: string;
      action?:
        | "place"
        | "fire"
        | "add-stroke"
        | "ready-for-reveal"
        | "undo"
        | "clear"
        | "drop"
        | "reportGameOver"
        | "answer"
        | "setupPredict"
        | "pickPrompt"
        | "completePrompt"
        | "skipPrompt"
        | "markDone"
        | "submitWord"
        | "forfeit";
      ships?: {
        name: string;
        len: number;
        x: number;
        y: number;
        vertical: boolean;
      }[];
      x?: number;
      y?: number;
      // drawing game
      stroke?: any; // DrawingStroke type
      // neon-stacker drop
      craneX?: number;
      craneTime?: number;
      shape?: { width: number; height: number; name: string };
      // neon-stacker reportGameOver
      loserIdx?: 0 | 1;
      // love-trivia / trivia
      choice?: number;
      // love-trivia setup phase
      qIdx?: number;
      // truth-or-dare / spicy-zone
      promptType?: "truth" | "dare";
      // word-chain
      word?: string;
    }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room || !room.game) return;
      const game = room.game;
      if (isGameOver(game)) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      let changed = false;

      if (game.gameId === "tic-tac-toe") {
        const cellIndex = payload?.cellIndex;
        if (
          typeof cellIndex !== "number" ||
          cellIndex < 0 ||
          cellIndex > 8
        )
          return;
        if (game.board[cellIndex] !== null) return;

        const mySide: TicTacToeSide | null =
          game.players.X.clientId === me.clientId
            ? "X"
            : game.players.O.clientId === me.clientId
              ? "O"
              : null;
        if (!mySide || mySide !== game.nextPlayer) return;

        game.board[cellIndex] = mySide;
        const winner = checkTTTWinner(game.board);
        if (winner) {
          game.winner = winner;
        } else {
          game.nextPlayer = mySide === "X" ? "O" : "X";
        }
        changed = true;
      } else if (game.gameId === "connect-four") {
        const col = payload?.column;
        if (typeof col !== "number" || col < 0 || col >= C4_COLS) return;

        const mySide: ConnectFourSide | null =
          game.players.red.clientId === me.clientId
            ? "red"
            : game.players.yellow.clientId === me.clientId
              ? "yellow"
              : null;
        if (!mySide || mySide !== game.nextPlayer) return;

        const landedIdx = dropC4Piece(game.board, col, mySide);
        if (landedIdx === null) return; // column full

        const result = checkC4Winner(game.board);
        if (result.winner) {
          game.winner = result.winner;
          game.winningLine = result.line;
        } else {
          game.nextPlayer = mySide === "red" ? "yellow" : "red";
        }
        changed = true;
      } else if (game.gameId === "battleship") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        const oppIdx: 0 | 1 = myIdx === 0 ? 1 : 0;

        if (payload?.action === "place") {
          if (game.phase !== "placement") return;
          if (game.players[myIdx].ready) return;
          const rawShips = payload.ships || [];
          if (!validateFleetPlacement(rawShips)) return;
          game.players[myIdx].ships = rawShips.map((s) => ({
            name: s.name,
            len: s.len,
            x: s.x,
            y: s.y,
            vertical: s.vertical,
            hits: 0,
            hitPositions: [],
          }));
          game.players[myIdx].ready = true;
          if (game.players[0].ready && game.players[1].ready) {
            game.phase = "battle";
            game.turnIdx = Math.random() < 0.5 ? 0 : 1;
          }
          changed = true;
        } else if (payload?.action === "fire") {
          if (game.phase !== "battle") return;
          if (game.turnIdx !== myIdx) return;
          const x = payload.x;
          const y = payload.y;
          if (
            typeof x !== "number" ||
            typeof y !== "number" ||
            x < 0 ||
            x >= BS_GRID ||
            y < 0 ||
            y >= BS_GRID
          )
            return;
          // No double-fire on the same cell.
          if (
            game.shotHistory[myIdx].some((s) => s.x === x && s.y === y)
          )
            return;
          // Resolve against opponent fleet.
          const oppShips = game.players[oppIdx].ships;
          let hitShip: BattleshipShipData | null = null;
          for (const ship of oppShips) {
            for (const cell of shipCells(ship)) {
              if (cell.x === x && cell.y === y) {
                hitShip = ship;
                break;
              }
            }
            if (hitShip) break;
          }
          let sunkShipName: string | null = null;
          if (hitShip) {
            hitShip.hits++;
            hitShip.hitPositions.push({ x, y });
            if (hitShip.hits >= hitShip.len) {
              sunkShipName = hitShip.name;
            }
          }
          game.shotHistory[myIdx].push({
            x,
            y,
            hit: !!hitShip,
            sunkShipName,
          });
          // Check win.
          const allSunk = oppShips.every((s) => s.hits >= s.len);
          if (allSunk) {
            game.phase = "done";
            game.winnerIdx = myIdx;
          } else {
            game.turnIdx = oppIdx;
          }
          changed = true;
        }
      } else if (
        game.gameId === "truth-or-dare" ||
        game.gameId === "spicy-zone"
      ) {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winner !== null) return;

        if (payload?.action === "pickPrompt") {
          // Only the active player picks
          if (myIdx !== game.turnIdx) return;
          const type = payload.promptType;
          if (type !== "truth" && type !== "dare") return;
          if (game.currentPrompt) return; // already picked
          game.currentPrompt = {
            type,
            text: pickPrompt(game.gameId, type),
          };
          changed = true;
        } else if (payload?.action === "completePrompt") {
          if (myIdx !== game.turnIdx) return;
          if (!game.currentPrompt) return;
          game.currentPrompt = null;
          game.roundsCompleted += 1;
          game.turnIdx = myIdx === 0 ? 1 : 0;
          if (game.roundsCompleted >= game.totalRounds) {
            game.winner = "win";
          }
          changed = true;
        } else if (payload?.action === "skipPrompt") {
          // Chicken out — swap to the other type without ending the round
          if (myIdx !== game.turnIdx) return;
          if (!game.currentPrompt) return;
          const next: PromptType =
            game.currentPrompt.type === "truth" ? "dare" : "truth";
          game.currentPrompt = { type: next, text: pickPrompt(game.gameId, next) };
          changed = true;
        }
      } else if (game.gameId === "loving-quest") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winner !== null) return;

        if (payload?.action === "markDone") {
          game.doneFlags[myIdx] = true;
          if (game.doneFlags[0] && game.doneFlags[1]) {
            game.currentIdx += 1;
            game.doneFlags = [false, false];
            if (game.currentIdx >= game.prompts.length) {
              game.winner = "done";
            }
          }
          changed = true;
        }
      } else if (game.gameId === "word-chain") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winnerIdx !== null) return;

        if (payload?.action === "submitWord") {
          if (myIdx !== game.turnIdx) return;
          const raw = String(payload.word || "").trim().toLowerCase();
          // Validation: letters only, min length 2, must start with nextLetter,
          // must not have been used before.
          if (!/^[a-z]{2,}$/.test(raw)) return;
          if (raw[0] !== game.nextLetter.toLowerCase()) return;
          if (game.history.some((h) => h.word === raw)) return;

          game.history.push({ word: raw, playerIdx: myIdx });
          game.nextLetter = raw[raw.length - 1].toUpperCase();
          game.turnIdx = myIdx === 0 ? 1 : 0;
          changed = true;
        } else if (payload?.action === "forfeit") {
          if (myIdx !== game.turnIdx) return;
          // You forfeit = the OTHER player wins
          game.winnerIdx = myIdx === 0 ? 1 : 0;
          changed = true;
        }
      } else if (game.gameId === "trivia") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winner !== null) return;

        if (payload?.action === "answer") {
          const choice = payload.choice;
          if (
            typeof choice !== "number" ||
            choice < 0 ||
            choice > 3
          )
            return;
          if (game.lockedOut[myIdx]) return;
          const q = game.questions[game.currentIdx];
          if (!q) return;

          game.lockedOut[myIdx] = true;
          if (choice === q.correctIdx) {
            // First to correct wins the round
            game.scores[myIdx] += 10;
            // Advance to next question
            game.currentIdx += 1;
            game.lockedOut = [false, false];
          } else {
            // Wrong — stay locked out until the round ends. If both are
            // locked out (both wrong), move on.
            if (game.lockedOut[0] && game.lockedOut[1]) {
              game.currentIdx += 1;
              game.lockedOut = [false, false];
            }
          }

          // End of game?
          if (game.currentIdx >= game.questions.length) {
            if (game.scores[0] > game.scores[1]) {
              game.winner = "win";
              game.winnerIdx = 0;
            } else if (game.scores[1] > game.scores[0]) {
              game.winner = "win";
              game.winnerIdx = 1;
            } else {
              game.winner = "draw";
            }
          }
          changed = true;
        }
      } else if (game.gameId === "love-trivia") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winner !== null) return;

        const choice = payload?.choice;
        const qIdx = payload?.qIdx;

        if (payload?.action === "setupPredict") {
          // Parallel prediction during setup phase. myIdx submits a
          // prediction about partner's answer at position qIdx.
          if (game.phase !== "setup") return;
          if (
            typeof choice !== "number" ||
            choice < 0 ||
            choice > 3 ||
            typeof qIdx !== "number" ||
            qIdx < 0 ||
            qIdx >= game.questions.length
          ) {
            return;
          }
          if (game.setupPredictions[myIdx][qIdx] !== null) return;
          game.setupPredictions[myIdx][qIdx] = choice;

          // Transition to game phase once BOTH players have answered
          // every question in setup.
          const allDoneMe = game.setupPredictions[myIdx].every(
            (v) => v !== null,
          );
          const otherIdx: 0 | 1 = myIdx === 0 ? 1 : 0;
          const allDoneOther = game.setupPredictions[otherIdx].every(
            (v) => v !== null,
          );
          if (allDoneMe && allDoneOther) {
            game.phase = "game";
            game.currentIdx = 0;
          }
          changed = true;
        } else if (payload?.action === "answer") {
          // Game phase — player answers for themselves about the
          // current question.
          if (game.phase !== "game") return;
          if (
            typeof choice !== "number" ||
            choice < 0 ||
            choice > 3
          ) {
            return;
          }
          const idx = game.currentIdx;
          if (idx >= game.questions.length) return;
          if (game.gameAnswers[myIdx][idx] !== null) return;
          game.gameAnswers[myIdx][idx] = choice;

          // Once both players have answered the current round, score
          // and advance.
          const a0 = game.gameAnswers[0][idx];
          const a1 = game.gameAnswers[1][idx];
          if (a0 !== null && a1 !== null) {
            // p0 scored if p0's prediction about p1 (setupPredictions[0][idx])
            // matches p1's actual answer (a1)
            if (game.setupPredictions[0][idx] === a1) {
              game.scores[0] += 1;
            }
            if (game.setupPredictions[1][idx] === a0) {
              game.scores[1] += 1;
            }
            game.currentIdx += 1;
            if (game.currentIdx >= game.questions.length) {
              game.winner = "done";
              game.phase = "done";
            }
          }
          changed = true;
        }
      } else if (game.gameId === "neon-stacker") {
        const myIdx: 0 | 1 | null =
          game.players[0].clientId === me.clientId
            ? 0
            : game.players[1].clientId === me.clientId
              ? 1
              : null;
        if (myIdx === null) return;
        if (game.winnerIdx !== null) return;

        if (payload?.action === "drop") {
          if (game.nextPlayerIdx !== myIdx) return;
          if (!game.moving) return;

          // Trust the dropping client's X (clamped to the sweep range).
          // This avoids a latency penalty where the block would drift
          // further during the round-trip. The post-drop stack is then
          // broadcast authoritatively so both clients agree on the
          // final state — the non-dropping client's pre-drop animation
          // is purely cosmetic.
          const reportedX =
            typeof payload.x === "number" && isFinite(payload.x)
              ? payload.x
              : neonStackerMovingX(game.moving, Date.now());
          const dropX = Math.min(
            game.moving.maxX,
            Math.max(game.moving.minX, reportedX),
          );
          const dropWidth = game.moving.width;
          const newLeft = dropX - dropWidth / 2;
          const newRight = dropX + dropWidth / 2;

          const top = game.stack[game.stack.length - 1];
          const topLeft = top.x - top.width / 2;
          const topRight = top.x + top.width / 2;

          const overlapLeft = Math.max(newLeft, topLeft);
          const overlapRight = Math.min(newRight, topRight);
          const overlap = overlapRight - overlapLeft;

          game.playerDropCounts[myIdx] += 1;

          if (overlap <= 0) {
            // Total miss — the dropping player loses.
            game.winnerIdx = myIdx === 0 ? 1 : 0;
            game.moving = null;
            game.banner = "TOWER COLLAPSED";
            changed = true;
          } else {
            game.stack.push({
              x: (overlapLeft + overlapRight) / 2,
              width: overlap,
              playerIdx: myIdx,
            });
            game.dropsInLevel += 1;

            let nextWidth = overlap;
            let banner: string | null = null;
            if (game.dropsInLevel >= NS_DROPS_PER_LEVEL) {
              game.level += 1;
              game.dropsInLevel = 0;
              banner = `LEVEL ${game.level - 1} COMPLETE`;
              nextWidth = neonStackerBlockWidthForLevel(game.level);
            }
            game.nextPlayerIdx = myIdx === 0 ? 1 : 0;
            game.moving = neonStackerMakeMoving(nextWidth, game.level);
            game.banner = banner;
            if (banner) {
              // Clear banner after a short delay so it flashes once.
              const currentCode = room.code;
              setTimeout(() => {
                const r = rooms.get(currentCode);
                if (!r) return;
                const g = r.game;
                if (g && g.gameId === "neon-stacker" && g.banner === banner) {
                  g.banner = null;
                  emitGameUpdate(r);
                }
              }, 1800);
            }
            changed = true;
          }
        }
      } else if (game.gameId === "hangman") {
        const currentPlayer = game.players[game.nextPlayerIdx];
        if (!currentPlayer || currentPlayer.clientId !== me.clientId) return;

        // Handle word guess (solve attempt)
        const word = String(payload?.word || "").toLowerCase();
        if (word && word.length > 1) {
          if (!/^[a-z]+$/.test(word)) return;

          if (word === game.word.toLowerCase()) {
            // Correct word guess - win the game
            game.winner = "win";
          } else {
            // Wrong word guess - penalty (treat as 2 wrong letters)
            game.wrongCount += 2;
            if (game.wrongCount >= game.maxWrong) {
              game.winner = "lose";
            } else {
              game.nextPlayerIdx =
                (game.nextPlayerIdx + 1) % game.players.length;
            }
          }
          changed = true;
          return;
        }

        // Handle letter guess
        const letter = String(payload?.letter || "").toLowerCase();
        if (!/^[a-z]$/.test(letter)) return;
        if (game.guessedLetters.includes(letter)) return;

        game.guessedLetters.push(letter);
        if (!game.word.includes(letter)) {
          game.wrongCount++;
        }
        if (game.wrongCount >= game.maxWrong) {
          game.winner = "lose";
        } else if (checkHangmanWin(game.word, game.guessedLetters)) {
          game.winner = "win";
        } else {
          game.nextPlayerIdx =
            (game.nextPlayerIdx + 1) % game.players.length;
        }
        changed = true;
      } else if (game.gameId === "drawing") {
        // Handle drawing actions
        const action = (payload as any)?.action;

        if (action === "add-stroke") {
          const stroke = (payload as any).stroke;
          if (stroke && game.players[me.clientId] && game.phase === "drawing") {
            game.players[me.clientId].drawing.strokes.push(stroke);
            changed = true;
          }
        } else if (action === "ready-for-reveal") {
          if (game.players[me.clientId] && game.phase === "drawing") {
            game.players[me.clientId].readyForReveal = true;

            // Check if both players are ready
            const allReady = Object.values(game.players).every((p: any) => p.readyForReveal);
            if (allReady) {
              advanceToReveal(game, room);
            }
            changed = true;
          }
        } else if (action === "undo") {
          if (game.players[me.clientId] && game.phase === "drawing") {
            const strokes = game.players[me.clientId].drawing.strokes;
            if (strokes.length > 0) {
              strokes.pop(); // Remove the last stroke
              changed = true;
            }
          }
        } else if (action === "clear") {
          if (game.players[me.clientId] && game.phase === "drawing") {
            game.players[me.clientId].drawing.strokes = [];
            changed = true;
          }
        }
      }

      if (changed) {
        room.lastActivity = Date.now();
        emitGameUpdate(room);
        // If this move ended the game, persist the record + points.
        if (isGameOver(game)) {
          void persistGameEnd(room, game, io);
        }
      }
    },
  );

  socket.on("game:exit", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    room.game = null;
    emitGameUpdate(room);
  });

  // -- Room reset ----------------------------------------------------------
  // Escape hatch for stuck rooms: an owner requests a full wipe. All peers
  // in the room are ejected, Supabase tables scoped to the code are
  // cleared, and the room is rebuilt empty. Requires the caller to be one
  // of the current owners in memory — this is NOT cryptographic proof of
  // identity but stops a random third party from wiping someone else's
  // room just because they know the code.
  //
  // Also supports a "force" mode that only requires possession of the
  // clientId the caller is using — useful when the server lost in-memory
  // state but Supabase still owns the lock. The caller gets a single
  // escape hatch they can invoke from their own device.
  socket.on(
    "room:reset",
    async (
      payload: { code?: string; clientId?: string; force?: boolean },
      ack?: (res: unknown) => void,
    ) => {
      const rawCode = sanitizeRoomCode(payload?.code || "");
      const clientId = (payload?.clientId || "").slice(0, 64);
      const force = payload?.force === true;
      if (!rawCode || !clientId) {
        ack?.({ ok: false, error: "code and clientId required" });
        return;
      }

      // Authorization check: caller must currently be an owner on this
      // socket's in-memory room, OR the Supabase row must name them.
      const memRoom = rooms.get(rawCode);
      const memOwner = !!memRoom && memRoom.owners.includes(clientId);

      let dbOwner = false;
      if (USE_DB) {
        try {
          const { data, error } = await (
            await import("./db")
          )
            .db()
            .from("rooms")
            .select("owner_client_ids")
            .eq("code", rawCode)
            .maybeSingle();
          if (!error && data) {
            const owners: string[] =
              (data as { owner_client_ids: string[] })
                .owner_client_ids || [];
            dbOwner = owners.includes(clientId);
          }
        } catch (e) {
          console.error("[swoono] room:reset owner check error:", e);
        }
      }

      if (!memOwner && !dbOwner && !force) {
        ack?.({
          ok: false,
          error:
            "not an owner of this room. If you're stuck, pass force=true from " +
            "the same clientId to bypass (dev escape hatch).",
        });
        return;
      }

      // Eject any connected peers
      if (memRoom) {
        for (const peer of memRoom.peers.values()) {
          io.to(peer.socketId).emit("room:reset:forced", { code: rawCode });
        }
      }

      // Wipe Supabase scoped to this room
      if (USE_DB) {
        try {
          await dbWipeRoom(rawCode);
        } catch (e) {
          console.error("[swoono] room:reset DB wipe error:", e);
          ack?.({ ok: false, error: "db wipe failed" });
          return;
        }
      }

      // Drop in-memory state
      rooms.delete(rawCode);
      joinedCode = null;
      joinedClientId = null;

      console.log(
        `[swoono] room:reset code=${rawCode} by=${clientId} mem=${memOwner} db=${dbOwner} force=${force}`,
      );

      ack?.({ ok: true });
    },
  );

  // -- Reward effect relay -------------------------------------------------
  // A sends an effect (kiss, slap, fireworks) → server forwards to the
  // OTHER peers in the room, stamped with the sender's name. Sender never
  // receives their own effect back — they show a toast on the client side.
  socket.on(
    "effect:send",
    async (payload: {
      effectId?: string;
      data?: Record<string, unknown>;
    }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room) return;
      const effectId = typeof payload?.effectId === "string" ? payload.effectId : "";
      if (!effectId) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      // Resolve the recipient (the other peer).
      const other = Array.from(room.peers.values()).find(
        (p) => p.socketId !== socket.id,
      );
      const toClientId = other?.clientId || "";

      const forwarded = {
        effectId,
        fromClientId: me.clientId,
        data: {
          ...(payload.data || {}),
          fromName: me.name,
        },
      };
      // socket.to() excludes the sender automatically.
      socket.to(room.code).emit("effect:receive", forwarded);

      if (toClientId) {
        try {
          await dbLogRewardEvent({
            room_code: room.code,
            from_client_id: me.clientId,
            to_client_id: toClientId,
            effect_id: effectId,
            payload: payload.data || null,
            delivered: true, // we just pushed it; only matters for offline retries
          });
        } catch (err) {
          console.error("[swoono] effect:send log error:", err);
        }
      }
    },
  );

  // -- Distance apart ------------------------------------------------------
  // Clients push their coarse location. Server stores lat/lng in DB and
  // broadcasts the haversine distance to both peers. Raw coordinates never
  // leave the server — only the computed distance.
  socket.on(
    "location:update",
    async (payload: { lat?: number; lng?: number; accuracyM?: number }) => {
      if (!joinedCode) return;
      const room = rooms.get(joinedCode);
      if (!room) return;

      const me = Array.from(room.peers.values()).find(
        (p) => p.socketId === socket.id,
      );
      if (!me) return;

      const lat = payload?.lat;
      const lng = payload?.lng;
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return;
      }

      // Distance feature requires persistence for both peers

      try {
        await dbUpdatePeerLocation(
          room.code,
          me.clientId,
          lat,
          lng,
          typeof payload.accuracyM === "number" ? payload.accuracyM : undefined,
        );
        const locs = await dbListPeerLocations(room.code);
        if (locs.length === 2) {
          const [a, b] = locs;
          const meters = haversineMeters(a.lat, a.lng, b.lat, b.lng);
          io.to(room.code).emit("distance:update", {
            meters,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("[swoono] location:update error:", err);
      }
    },
  );


  socket.on("points:get", async (ack?: (res: { points: number }) => void) => {
    if (!joinedCode) {
      ack?.({ points: 0 });
      return;
    }
    
    try {
      const balances = await pointsBalances(joinedCode);
      const points = joinedClientId ? (balances[joinedClientId] || 0) : 0;
      ack?.({ points });
    } catch (err) {
      console.error("[swoono] points:get error:", err);
      ack?.({ points: 0 });
    }
  });
  socket.on("disconnect", () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;

    for (const [clientId, peer] of room.peers) {
      if (peer.socketId === socket.id) {
        room.peers.delete(clientId);
        break;
      }
    }

    if (room.peers.size > 0) {
      io.to(joinedCode).emit("presence", { peers: publicPeers(room) });
    }
  });
});

// Sweep empty idle rooms.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.peers.size === 0 && now - room.lastActivity > IDLE_ROOM_MS) {
      rooms.delete(code);
    }
  }
}, 60_000);

// Require database configuration for production - no in-memory fallback
if (!USE_DB) {
  console.error(`[swoono] FATAL: Supabase database not configured.

Required environment variables:
  SUPABASE_URL=https://your-project-ref.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

Set these in your deployment environment and restart.`);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`[swoono] listening on :${PORT} with Supabase persistence`);
});
