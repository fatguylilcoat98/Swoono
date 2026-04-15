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

const TOD_TRUTHS: string[] = [
  "What's the most embarrassing song on your playlist right now?",
  "What's one thing you've never told your partner but want to?",
  "What's your most irrational fear?",
  "What's the worst lie you've ever told?",
  "If you had to re-live one day of your life, which one?",
  "What's your guilty pleasure TV show?",
  "What's something you did as a teenager that you'd be horrified to admit now?",
  "Who was your first crush?",
  "What's the most childish thing you still do?",
  "What would you do if you could be invisible for a day?",
  "What's one habit of your partner's that drives you secretly crazy?",
  "When was the last time you cried and why?",
  "What's the worst gift you've ever received?",
  "What's a belief you used to hold that you've changed your mind about?",
  "If you had to pick one superpower, what would it be and why?",
  "What's your most toxic trait you're actually working on?",
  "What's the pettiest thing you've ever done in an argument?",
  "What celebrity crush are you too embarrassed to admit?",
  "What's one thing you googled this week that you'd never say out loud?",
  "What's the weirdest thing you've ever eaten on a dare?",
  "What was your most awkward first-date moment?",
  "What's the dumbest thing you've spent money on?",
  "What's a compliment you hate getting?",
  "If you had 24 hours to do anything with no consequences, what?",
  "What's your partner's most attractive non-physical trait?",
  "What's one thing you wish you'd done by now?",
  "What's your pettiest hill you will die on?",
  "Name one thing you've lied about on a resume.",
  "What's the meanest thing you've said to someone and regretted?",
  "What's your weirdest recurring dream?",
];

const TOD_DARES: string[] = [
  "Do your best impression of your partner for 30 seconds.",
  "Text a friend saying 'I need to confess something' then say 'nvm' when they ask.",
  "Do 15 pushups right now.",
  "Let your partner post anything they want on your social media for the next 60 seconds.",
  "Give your partner a 30-second foot rub.",
  "Sing the chorus of the last song you listened to.",
  "Do your best dance move for 20 seconds.",
  "Let your partner style your hair any way they want.",
  "Write a haiku about your partner in 60 seconds and read it out loud.",
  "Do a full cartwheel (or attempt — points for effort).",
  "Call someone and say 'I can't talk right now, I'm being held hostage by my partner for a dare.' Then hang up.",
  "Let your partner pick your outfit for tomorrow.",
  "Say three nice things about your partner in a dramatic movie-trailer voice.",
  "Do your most convincing cry for 15 seconds.",
  "Eat a spoonful of something your partner picks from the fridge.",
  "Attempt to juggle for 30 seconds with whatever's in reach.",
  "Send your partner a selfie with the worst face you can make.",
  "Talk in only questions for the next 2 minutes.",
  "Do a handstand against a wall. (Or attempt.)",
  "Let your partner draw on your face with a marker for 20 seconds.",
  "Do your best animal impression and let your partner guess.",
  "Eat the next thing you drink from a bowl with a spoon.",
  "Send a voice message to a friend of just laughter.",
  "Act out a scene from the last movie you watched — your partner has to guess.",
  "Balance a book on your head and walk across the room.",
  "Do 10 jumping jacks while spelling your partner's full name.",
  "Let your partner give you a new pet name and you have to use it until the next round.",
  "Let your partner pick your profile picture — they get final say.",
  "Do a 30-second freestyle rap about this game.",
  "Pick up anything random and use it as a microphone for a song of your partner's choice.",
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

const TRIVIA_BANK: TriviaQuestion[] = [
  { id: "tv-01", text: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Saturn"], correctIdx: 1, category: "Science" },
  { id: "tv-02", text: "What's the capital of Australia?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIdx: 2, category: "Geography" },
  { id: "tv-03", text: "Who painted the Mona Lisa?", choices: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], correctIdx: 1, category: "Art" },
  { id: "tv-04", text: "What's the largest ocean on Earth?", choices: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIdx: 3, category: "Geography" },
  { id: "tv-05", text: "In what year did World War II end?", choices: ["1943", "1944", "1945", "1946"], correctIdx: 2, category: "History" },
  { id: "tv-06", text: "What element has the chemical symbol 'Au'?", choices: ["Silver", "Gold", "Aluminum", "Argon"], correctIdx: 1, category: "Science" },
  { id: "tv-07", text: "Which is the smallest prime number?", choices: ["0", "1", "2", "3"], correctIdx: 2, category: "Math" },
  { id: "tv-08", text: "Who wrote 'Romeo and Juliet'?", choices: ["Dickens", "Shakespeare", "Chaucer", "Austen"], correctIdx: 1, category: "Literature" },
  { id: "tv-09", text: "How many continents are there?", choices: ["5", "6", "7", "8"], correctIdx: 2, category: "Geography" },
  { id: "tv-10", text: "What's the tallest mountain in the world?", choices: ["K2", "Everest", "Kangchenjunga", "Denali"], correctIdx: 1, category: "Geography" },
  { id: "tv-11", text: "Which country invented pizza?", choices: ["France", "Greece", "Italy", "Spain"], correctIdx: 2, category: "Food" },
  { id: "tv-12", text: "What year did the first iPhone release?", choices: ["2005", "2006", "2007", "2008"], correctIdx: 2, category: "Tech" },
  { id: "tv-13", text: "What's the hardest natural substance?", choices: ["Quartz", "Diamond", "Steel", "Titanium"], correctIdx: 1, category: "Science" },
  { id: "tv-14", text: "Who painted the ceiling of the Sistine Chapel?", choices: ["Raphael", "Da Vinci", "Michelangelo", "Donatello"], correctIdx: 2, category: "Art" },
  { id: "tv-15", text: "Which planet has the most moons?", choices: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctIdx: 1, category: "Science" },
  { id: "tv-16", text: "What's the currency of Japan?", choices: ["Won", "Yuan", "Yen", "Ringgit"], correctIdx: 2, category: "Geography" },
  { id: "tv-17", text: "What color is a ripe banana's skin right before brown?", choices: ["Green", "Yellow", "Orange", "Red"], correctIdx: 1, category: "Misc" },
  { id: "tv-18", text: "How many sides does a hexagon have?", choices: ["5", "6", "7", "8"], correctIdx: 1, category: "Math" },
  { id: "tv-19", text: "Who directed 'Jurassic Park'?", choices: ["George Lucas", "James Cameron", "Steven Spielberg", "Ridley Scott"], correctIdx: 2, category: "Movies" },
  { id: "tv-20", text: "What's the longest river in the world?", choices: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIdx: 1, category: "Geography" },
  { id: "tv-21", text: "Which blood type is the universal donor?", choices: ["A+", "O-", "B+", "AB+"], correctIdx: 1, category: "Science" },
  { id: "tv-22", text: "How many hearts does an octopus have?", choices: ["1", "2", "3", "4"], correctIdx: 2, category: "Science" },
  { id: "tv-23", text: "What year did the Berlin Wall fall?", choices: ["1987", "1988", "1989", "1990"], correctIdx: 2, category: "History" },
  { id: "tv-24", text: "What's the main ingredient in guacamole?", choices: ["Tomato", "Avocado", "Lime", "Onion"], correctIdx: 1, category: "Food" },
  { id: "tv-25", text: "Who invented the telephone?", choices: ["Edison", "Tesla", "Bell", "Marconi"], correctIdx: 2, category: "History" },
  { id: "tv-26", text: "What's the rarest blood type?", choices: ["O-", "AB-", "B+", "A-"], correctIdx: 1, category: "Science" },
  { id: "tv-27", text: "What language has the most native speakers?", choices: ["English", "Spanish", "Mandarin", "Hindi"], correctIdx: 2, category: "Geography" },
  { id: "tv-28", text: "What's the fastest land animal?", choices: ["Lion", "Cheetah", "Pronghorn", "Ostrich"], correctIdx: 1, category: "Nature" },
  { id: "tv-29", text: "How many bones are in the adult human body?", choices: ["198", "206", "212", "220"], correctIdx: 1, category: "Science" },
  { id: "tv-30", text: "What's the chemical symbol for water?", choices: ["Wo", "H2O", "HO2", "H3O"], correctIdx: 1, category: "Science" },
  { id: "tv-31", text: "Which Greek god is king of the gods?", choices: ["Poseidon", "Hades", "Apollo", "Zeus"], correctIdx: 3, category: "Mythology" },
  { id: "tv-32", text: "What's the smallest country in the world?", choices: ["Monaco", "Vatican City", "Nauru", "San Marino"], correctIdx: 1, category: "Geography" },
  { id: "tv-33", text: "Who wrote 'Harry Potter'?", choices: ["Tolkien", "Rowling", "Pullman", "Lewis"], correctIdx: 1, category: "Literature" },
  { id: "tv-34", text: "What year did humans first land on the moon?", choices: ["1967", "1968", "1969", "1970"], correctIdx: 2, category: "History" },
  { id: "tv-35", text: "Which instrument has 88 keys?", choices: ["Organ", "Piano", "Harpsichord", "Accordion"], correctIdx: 1, category: "Music" },
  { id: "tv-36", text: "What's the largest mammal?", choices: ["Elephant", "Blue whale", "Giraffe", "Orca"], correctIdx: 1, category: "Nature" },
  { id: "tv-37", text: "How many players on a soccer team on the field?", choices: ["9", "10", "11", "12"], correctIdx: 2, category: "Sports" },
  { id: "tv-38", text: "What's the freezing point of water in Celsius?", choices: ["-10", "0", "10", "32"], correctIdx: 1, category: "Science" },
  { id: "tv-39", text: "Who painted 'Starry Night'?", choices: ["Monet", "Van Gogh", "Picasso", "Dalí"], correctIdx: 1, category: "Art" },
  { id: "tv-40", text: "What animal is known as the 'Ship of the Desert'?", choices: ["Horse", "Camel", "Donkey", "Llama"], correctIdx: 1, category: "Nature" },
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

type LoveTriviaRoundResult = {
  questionId: string;
  answers: [number, number];
  matched: boolean;
};

type LoveTriviaState = {
  gameId: "love-trivia";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  questions: LoveTriviaQuestion[];
  currentIdx: number;
  currentAnswers: [number | null, number | null];
  matchedCount: number;
  history: LoveTriviaRoundResult[];
  winner: "done" | null;
  startedAt: number;
};

// Question bank. Each question has 4 choices; the game is cooperative —
// both players pick what they think their partner prefers, and they
// score when they match. No "right" answer from the server's view.
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
];

function pickLoveTriviaQuestions(n: number): LoveTriviaQuestion[] {
  const shuffled = [...LOVE_TRIVIA_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// --- Neon Stacker (physics tower, client-simulated, server-arbitrated) ---

type NeonStackerShape = {
  width: number;
  height: number;
  name: string;
};

type NeonStackerDrop = {
  index: number;
  playerIdx: 0 | 1;
  craneX: number;
  craneTime: number;
  shape: NeonStackerShape;
  at: number;
};

type NeonStackerState = {
  gameId: "neon-stacker";
  players: [
    { clientId: string; name: string },
    { clientId: string; name: string },
  ];
  nextPlayerIdx: 0 | 1;
  dropCount: number;
  level: number;
  playerDropCounts: [number, number];
  winnerIdx: 0 | 1 | null;
  lastDrop: NeonStackerDrop | null;
  startedAt: number;
};

type ActiveGame =
  | TicTacToeState
  | ConnectFourState
  | HangmanState
  | BattleshipInternal
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
  if (!USE_DB) return;
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
        outcome = "coop-win";
        const pointsEach = Math.min(20, game.matchedCount * 2);
        if (pointsEach > 0) {
          for (const p of game.players) {
            pointsAwards.push({
              clientId: p.clientId,
              delta: pointsEach,
              reason: `love-trivia ${game.matchedCount}/10`,
            });
          }
        }
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

    if (USE_DB) {
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
    } else {
      // In-memory fallback (dev mode). Lock to the first two clientIds.
      if (!room.owners.includes(clientId)) {
        if (room.owners.length >= MAX_PEERS_PER_ROOM) {
          ack?.({
            ok: false,
            error: "Room is full (2 players maximum)",
          });
          return;
        }
        room.owners.push(clientId);
      }
    }

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
    if (USE_DB) {
      try {
        const balances = await pointsBalances(rawCode);
        const clientPoints = balances[clientId] || 0;
        socket.emit("points:sync", { clientId, points: clientPoints });
      } catch (err) {
        console.error("[swoono] join points sync error:", err);
      }
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

    if (USE_DB) {
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
    } else {
      note = {
        id: makeId(),
        roomCode: room.code,
        authorClientId: me.clientId,
        authorName: me.name,
        text,
        color,
        createdAt: Date.now(),
      };
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
    } else if (gameId === "neon-stacker") {
      game = {
        gameId: "neon-stacker",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        nextPlayerIdx: 0,
        dropCount: 0,
        level: 1,
        playerDropCounts: [0, 0],
        winnerIdx: null,
        lastDrop: null,
        startedAt: Date.now(),
      };
    } else if (gameId === "love-trivia") {
      game = {
        gameId: "love-trivia",
        players: [
          { clientId: me.clientId, name: me.name },
          { clientId: other.clientId, name: other.name },
        ],
        questions: pickLoveTriviaQuestions(10),
        currentIdx: 0,
        currentAnswers: [null, null],
        matchedCount: 0,
        history: [],
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
        | "drop"
        | "reportGameOver"
        | "answer"
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
      // neon-stacker drop
      craneX?: number;
      craneTime?: number;
      shape?: { width: number; height: number; name: string };
      // neon-stacker reportGameOver
      loserIdx?: 0 | 1;
      // love-trivia / trivia
      choice?: number;
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

        if (payload?.action === "answer") {
          const choice = payload.choice;
          if (
            typeof choice !== "number" ||
            choice < 0 ||
            choice > 3
          )
            return;
          // Ignore double-submits for the same round
          if (game.currentAnswers[myIdx] !== null) return;
          game.currentAnswers[myIdx] = choice;

          // If both players answered, evaluate the round
          if (
            game.currentAnswers[0] !== null &&
            game.currentAnswers[1] !== null
          ) {
            const a0 = game.currentAnswers[0];
            const a1 = game.currentAnswers[1];
            const matched = a0 === a1;
            const question = game.questions[game.currentIdx];
            game.history.push({
              questionId: question.id,
              answers: [a0, a1],
              matched,
            });
            if (matched) game.matchedCount += 1;
            game.currentIdx += 1;
            game.currentAnswers = [null, null];
            // End of game after 10 rounds
            if (game.currentIdx >= game.questions.length) {
              game.winner = "done";
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

        if (payload?.action === "drop") {
          if (game.nextPlayerIdx !== myIdx) return;
          const craneX = payload.craneX;
          const craneTime = payload.craneTime;
          const shape = payload.shape;
          if (
            typeof craneX !== "number" ||
            typeof craneTime !== "number" ||
            !shape ||
            typeof shape.width !== "number" ||
            typeof shape.height !== "number" ||
            typeof shape.name !== "string"
          ) {
            return;
          }
          game.dropCount += 1;
          game.playerDropCounts[myIdx] += 1;
          // Level up every 5 drops — matches Chris's spec.
          if (game.dropCount > 0 && game.dropCount % 5 === 0) {
            game.level += 1;
          }
          game.lastDrop = {
            index: game.dropCount,
            playerIdx: myIdx,
            craneX,
            craneTime,
            shape: {
              width: shape.width,
              height: shape.height,
              name: shape.name,
            },
            at: Date.now(),
          };
          game.nextPlayerIdx = myIdx === 0 ? 1 : 0;
          changed = true;
        } else if (payload?.action === "reportGameOver") {
          // Client-reported game over. The loser is whoever made the
          // last drop — their block caused the tower to collapse.
          // Both clients may report concurrently; the winnerIdx guard
          // below makes this idempotent so only the first one wins.
          if (game.winnerIdx !== null) return; // already ended
          if (!game.lastDrop) return;
          const loserIdx = game.lastDrop.playerIdx;
          game.winnerIdx = loserIdx === 0 ? 1 : 0;
          changed = true;
        }
      } else if (game.gameId === "hangman") {
        const letter = String(payload?.letter || "").toLowerCase();
        if (!/^[a-z]$/.test(letter)) return;
        if (game.guessedLetters.includes(letter)) return;

        const currentPlayer = game.players[game.nextPlayerIdx];
        if (!currentPlayer || currentPlayer.clientId !== me.clientId) return;

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

      if (USE_DB && toClientId) {
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

      if (!USE_DB) return; // distance needs persistence for both peers

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
    if (!joinedCode || !USE_DB) {
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

server.listen(PORT, () => {
  console.log(`[swoono] listening on :${PORT}`);
});
