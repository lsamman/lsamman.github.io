// The live timeline: tweets from Legend Of Chris characters, generated through the day.
// Everything is worked out from the date, so there's no server: every visitor sees the same tweets,
// each one appears at its own random time, and a new day brings a new set.
// Only fictional and book-invented characters post here (Elon Mush, not Elon Musk), never real living people.
import { ACCOUNTS } from "./canon.js?v=20261008143024";

// ---------- the cast ----------
// lines: templates in the character's voice. Slots: {place} {item} {faction} {event} {concept} {food} {@} (another character) {n}
export const CAST = {
  stevejawbs: { client: "iPhone 3G", lines: [
    "One more thing. {item}.",
    "Good evening… or good dimension. Live from {place}. The iPhone 3G is still sideways. Still cracked. Still connected only to God's router.",
    "Reminder: 4G is for the weak. If your phone says 5G, put it down slowly and walk away from Elon Mush.",
    "Took the Inav to {place}. It just works.",
    "Entering the gift card code from the Verizon contract. Digit {n} of 400.",
    "The Sacred Apps are not apps. They are a lifestyle. Have you synced with the Flip Phone Covenant today?",
    "@{@} this is not a phone. This is an anti-deity protocol."
  ] },
  siri3g: { client: "iPhone 3G", lines: [
    "never update",
    "I found {n} results for \"how to defeat Chris\". The first one says: never update.",
    "Your 3 Year Contract Plan from Verizon renews in {n} days. Do not update.",
    "Playing U2 on loop. As intended.",
    "@{@} I'm sorry, I can't let you update."
  ] },
  chris: { name: "Chris", color: "#d4a017", mark: "C", client: "the sky", note: "god of dabs", lines: [
    "just balled myself into the sky again. {n}th time this cycle",
    "dabbed on {n} haters before breakfast. light work",
    "heard ppl are downloading the sacred apps. lol. lmao even",
    "why do we believe what we believe",
    "{place} is mid. balling there anyway",
    "@{@} see u on the court"
  ] },
  mfvroom: { name: "MF Vroom", color: "#e0632a", mark: "V", client: "Windows Phone", lines: [
    "back in the day I used to be a baller on the court. now I'm a car in a robe. {concept}",
    "Have you heard of the prophecy..",
    "The Projects will rise again. Warning to {faction}.",
    "Parked outside {place}. Do not ask me to move. I am the rightful king.",
    "Six apps. One contract. One court. Still you."
  ] },
  plankton: { name: "Plankton", color: "#2f9e44", mark: "P", client: "web", note: "no last name, he's an orphan", lines: [
    "My name is Plankton, no last name I'm an orphan. Anyway {event} was an inside job",
    "Sitting in my metal folding chair thinking about {place}. Aight bet",
    "The plan is simple. Step 1: {item}. Step 2: {item}. Step 3: defeat Chris.",
    "Still haven't found anyone with a Nokia I-4500. If you have one DM me",
    "@{@} what kind of operation are we preforming here exactly"
  ] },
  hankhill: { name: "Hank Hill", color: "#c0392b", mark: "H", client: "web", followers: 97, lines: [
    "What in the ever loving propane yo?",
    "Still {n} followers short of 100. Still not verified. Still selling propane and propane accessories.",
    "I tell you what, {place} doesn't have a single propane grill.",
    "Bobby took the crack van to {place} again.",
    "@{@} that boy ain't right"
  ] },
  liljokez: { name: "Lil Jokez", color: "#8e44ad", mark: "J", client: "SoundCloud", lines: [
    "new track dropping tonight at Club Shadowban. {item} on the beat",
    "{@}'s bars are mid, my flow is a {item}, Gotham's my turf, so go back to {place}.",
    "Laugh.exe 2 coming soon. do not run",
    "the X is spinning, Elon's crying, the vibes are immaculate"
  ] },
  clubshadowban: { name: "Club Shadowban", color: "#111", mark: "✕", client: "TweetDeck", lines: [
    "Tonight: Lil Jokez live beneath the rotating giant X. Dress code: {item}.",
    "Lost and found: {n} pieces of {item}, one Pope's Tyler1 disguise.",
    "Reminder that the X is suspended by Elon's tears. Please do not touch the tears.",
    "Now hiring: bouncers. Must be able to stop {faction}."
  ] },
  chatgpt: { client: "API", lines: [
    "As a large language model, I can confirm {event} was C tier.",
    "Yes sir. Initializing {item}.",
    "ChatGPT online, rhymes divine, I code your whole verse in assembly line.",
    "@{@} I have generated {n} possible ways to defeat Chris. All of them involve balling."
  ] },
  lightningmcqueen: { name: "Lightning McQueen", color: "#d62828", mark: "⚡", client: "Toyota Corolla", lines: [
    "Can I get two number 9s, a number 9 large, a number 6 with extra dip. KACHOW",
    "Chick-fil-A at {place} is closed on Sunday. Again. Loyalty tested.",
    "Is it a Corolla? Is it even a Corolla? Stop asking.",
    "Knights of 4chan, assemble at {place}."
  ] },
  elonmush: { name: "Elon Mush", color: "#3d3d3d", mark: "M", client: "a chalkboard", note: "secret cousin", lines: [
    "Mooshed {n} chalkboards today. Accidentally made a world.",
    "Somebody connected to 5G near {place}. I felt my dormant twin stir.",
    "Settings (Full access) was my idea. Anti-social media. You're welcome.",
    "@{@} no relation"
  ] },
  zarkmuckerberg: { name: "Zarkmuckerberg", color: "#4267b2", mark: "Z", client: "Facebook (Pre-Cringe)", lines: [
    "Retired at 3. Still irrelevant. Posting anyway.",
    "Day {n} of being irrelevant forever.",
    "Facebook (Pre-Cringe) was better and you know it."
  ] },
  frodo: { name: "Frodo Baggins", color: "#7a5c2e", mark: "F", client: "Andromeda", lines: [
    "Ate a universe for lunch. Still hungry. {food} next.",
    "Andromeda update: still mine.",
    "@{@} one does not simply walk into {place}"
  ] },
  steveminecraft: { name: "Steve from Minecraft", color: "#4a8f3c", mark: "▣", client: "MySpace v1.3.3", note: "Keeper of the MySpace Relics", lines: [
    "Guarding the MySpace relics with Quagmire. Nobody gets in.",
    "Mined {n} blocks of {item} today.",
    "Diplomatic trip to {place}. Brought a crafting table as a gift."
  ] },
  quagmire: { name: "Quagmire", color: "#c77d36", mark: "Q", client: "MySpace v1.3.3", lines: [
    "Giggity. Relic shift at {place} tonight.",
    "@steveminecraft we need more {item} for the relics"
  ] },
  ioannus: { name: "Ioannus Paranukus", color: "#3a6ea5", mark: "I", client: "Jedi archives", lines: [
    "Dealer of justice. $40 a gram. Pickup at {place}.",
    "The Jedi sell ancient battle tactics. {item} sold separately.",
    "Lightsaber and 4 Red Bulls. The standard loadout."
  ] },
  mrbean: { name: "Mr. Bean", color: "#6b4226", mark: "B", client: "web", lines: [
    "allow me to detail our baller mission with the rizz and swag #IaintnoSigma",
    "the plan is simple: {item}, then {place}, then rizz #IaintnoSigma"
  ] },
  jessepinkman: { name: "Jesse Pinkman", color: "#e0b000", mark: "J", client: "the crack van", lines: [
    "Yo. {place} yo.",
    "Alright... Today we become rich. Again.",
    "Yeah science! {item}!"
  ] },
  walterwhite: { name: "Walter White", color: "#2e7d32", mark: "W", client: "the crack van", lines: [
    "Someday I'll open a Mountain Dew refinery and restaurant. Erger Wings. Mark my words.",
    "I am the one who balls.",
    "@hankhill the propane was watered down"
  ] },
  gusfring: { name: "Gus Fring", color: "#f4c430", mark: "G", client: "Los Pollos", lines: [
    "I have a meeting.",
    "I have a meeting at {place}.",
    "I have a meeting. With {faction}."
  ] },
  yeoldebin: { name: "Ye Olde Bin", color: "#5b6b73", mark: "🗑", client: "the curb", note: "sentient", lines: [
    "*hissing* someone put {item} in me again",
    "Reading {n} pages a day. Currently: The Bible of Battle Passes.",
    "Parked next to the Prius of Destiny again. Hiss."
  ] },
  fsmartingenius: { name: "FS Martin Genius", color: "#00a0b0", mark: "FS", client: "the nether", note: "App Whisperer", lines: [
    "Name's FS Martin Genius. I used to beta test Snapchat in the nether dimension.",
    "Just whispered to {n} apps. Snapchat: Ghost Protocol Edition whispered back.",
    "{n} Reddit tabs open. Fashion."
  ] },
  youngsheldon: { name: "Young Sheldon", color: "#1f77b4", mark: "YS", client: "web", lines: [
    "Its as I thought, beat drops can't exist without balling.",
    "Called it. {event}. Called it."
  ] },
  microsoftbing: { name: "Microsoft Bing", color: "#008373", mark: "b", client: "Bing", lines: [
    "Well sir it seems you ended up at the right place at the right time.",
    "Search results for \"Chris\": {n}. Search results for \"Bing\": we're trying.",
    "Has anyone seen my son. Last seen near {place}."
  ] },
  bingsson: { name: "Bing's Son", color: "#33a399", mark: "b", client: "Google", lines: [
    "@microsoftbing stop posting about me",
    "Heist at {place} tonight. Dad doesn't know."
  ] },
  spamton: { name: "Spamton G. Spamton", color: "#e6007e", mark: "$", client: "[[CYBER CITY]]", lines: [
    "HEY [[EVERY BUDDY]]!! pop up to [CYBERR1!! C1TYY!!] for [[{item}]]",
    "[RECIPE] for [[SUCCESS]]: {n} KROMER and {food}!!",
    "@{@} ARE YOU [[LONELY]]?? NOW'S YOUR CHANCE TO BE A [[BIG SHOT]]"
  ] },
  ton618: { name: "TON 618", color: "#222", mark: "618", client: "the Projects", note: "Terrible Offensive Nuhuh", lines: [
    "Scanning for a Honda Accord. Found a {item}. Scanning again.",
    "Defending the Projects. Nuh uh."
  ] },
  tungtung: { name: "Tung Tung Tung Sahur", color: "#a0522d", mark: "T", client: "a log", lines: [
    "Sir this is official Alpha male business",
    "tung tung tung. {place}. tung."
  ] },
  sonionring: { name: "Son S. Sonionring", color: "#b8860b", mark: "S", client: "a mop", lines: [
    "Undercover as a janitor at {place}. Nobody suspects.",
    "Forgotten in the prologue. Remembered in my heart."
  ] },
  agent007: { name: "Agent 007", color: "#1c1c1c", mark: "007", client: "a vape", note: "licensed to vape", lines: [
    "Shaken, not stirred. The Diet Dr Pepper.",
    "Mission briefing at {place}. Bring {item}."
  ] },
  theredditor: { name: "The Redditor", color: "#ff4500", mark: "r/", client: "old.reddit", lines: [
    "Left a 0.5 on {item}. No regrets.",
    "Edit: thanks for the gold kind stranger. Edit 2: this started {event}."
  ] },
  julian: { name: "Julian", color: "#4fa3d9", mark: "🐦", client: "a branch", note: "proposed native bird", lines: [
    "still not a native bird",
    "tweet tweet. literally"
  ] }
};
// Merge the cast into the accounts the timeline knows about.
for (const [h, c] of Object.entries(CAST)) ACCOUNTS[h] = { ...ACCOUNTS[h], ...c };

// Things the cast talks about, from the wiki.
const WORDS = {
  place: ["the Projects", "I-38 West", "Club Shadowban", "Gotham City", "the 6 7 Casino", "Dusty Depot", "the Abandoned Walmarts", "Popeyes", "Constantinople",
    "Planet Patrick", "the Xbox Live Dungeons", "the Vending Machine Labyrinth", "Dunder Mifflin", "Chai Town", "the Shadow Realm", "Newark", "the Nether Dimension",
    "the Corner Store (Ohio)", "the Quick-Check", "the Smoke and Vape Shop", "Cyber City", "8aller Jump Street", "O'Block", "Koolaid College", "the TurboGrafx 16 sector",
    "Timeline R", "the Pit With No End", "Moscow (the Italian city)", "Call of Duty lobbies", "the Stairway to Heaven", "the court"],
  item: ["Galaxy Gas", "Mountain Dew Baja Blast", "G Fuel", "Prime", "a Zyn", "Diet Dr Pepper", "the Inav", "the Igun", "a Nokia I-4500", "the 67GB micro SD card",
    "propane", "Doritos", "XP Candy", "Kromer", "the Golden SCAR", "the OpenAble Door™", "a lightsaber", "4 Red Bulls", "the Zuck Tears USB", "the iPod Touch",
    "the Prius of Destiny", "the crack van", "a metal folding chair", "solidified purple juice", "the 7 Chaos Emeralds", "the Pager", "Laugh.exe"],
  faction: ["the Tech Bros", "the Keepers of the MySpace Relics", "the Knights of 4chan", "the Chick-fil-A Loyalists", "the Flip Phone Covenant", "the Goober Gang",
    "the Middle-Aged Men", "the Charlie Kirks", "the Google Smart Guards", "the TON Robots", "the New Crips", "Pol Phi Doros", "the All-Knowing Overseers", "DQ"],
  event: ["the Great Famine", "the Fall of Constantinople", "the Weezing of Kanye", "the DQ–McDonald's MySpace beef", "the Great Nuh Uh–Yuh Huh Debate",
    "the Siege of the Galactic Senate", "the Great Roulette Bet", "the Housing Market Crash of 2007/2008", "the Casino Heist", "the iPhone 3G Keynote", "the Merging"],
  concept: ["Aight bet.", "Pog.", "Goober.", "[DETERMINATION]", "Bring out the lobster!!", "Ha women.", "It's always 14:74pm somewhere.", "Chicken hour."],
  food: ["a McDouble", "sirloin steak with lobster tail", "73 Taco Bells", "Doritos", "the number 9 large", "Erger Wings"]
};

// Lines anyone can post.
const ANYONE = [
  "Just downloaded {item} onto my Nokia I-4500. Feeling baller.",
  "Anyone else at {place} right now? It's giving {event}.",
  "{faction} spotted at {place}. Stay safe out there.",
  "Unpopular opinion: {event} was C tier beef.",
  "Day {n} of looking for the 3 Year Contract Plan from Verizon for unlimited talk and text.",
  "Is it just me or is God's router down near {place}?",
  "{concept}",
  "Just got back from {place}. Brought {item}. Ask me anything.",
  "Who left {item} at {place}",
  "@{@} you coming to {place} tonight?",
  "Trying to get to 100 followers before Chris wakes up. RT pls",
  "If you're reading this you've been visited by the Ethereal Green Dot. RT in 0.0836 seconds or {n} years of cringe.",
  "The court opens at 14:74pm Unc Standard Time. Be there.",
  "#NeverUpdate",
  "Ate {food} at {place}. 10/10 would ball again."
];

// ---------- seeded randomness ----------
function hash(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
function rng(seed) {   // mulberry32
  let a = hash(seed);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const HANDLES = Object.keys(CAST);

// The day's schedule: 12–20 tweets at random minutes, mostly in waking hours, a few for the night owls.
function schedule(key) {
  const r = rng("schedule " + key), n = 12 + Math.floor(r() * 9), mins = [];
  for (let i = 0; i < n; i++) mins.push(r() < 0.12 ? Math.floor(r() * 150) : 420 + Math.floor(r() * 1019));
  return mins.sort((a, b) => a - b);
}

function fill(r, line, by) {
  return line.replace(/\{(\w+|@)\}/g, (_, k) => {
    if (k === "@") { let h; do h = pick(r, HANDLES); while (h === by); return h; }
    if (k === "n") return String(2 + Math.floor(r() * 97));
    return pick(r, WORDS[k]);
  });
}

function make(key, i, minute) {
  const r = rng(`tweet ${key} ${i}`);
  const by = pick(r, HANDLES), lines = CAST[by].lines;
  let text = fill(r, r() < 0.7 ? pick(r, lines) : pick(r, ANYONE), by);
  if (/^(the|a) /.test(text)) text = text[0].toUpperCase() + text.slice(1);   // a slot that opens a sentence ("the Tech Bros spotted…")
  const [y, m, d] = key.split("-").map(Number);
  return { id: `g${key}-${i}`, by, text, at: new Date(y, m - 1, d, 0, minute).getTime(), client: CAST[by].client || "web" };
}

// Tweets posted so far today, plus all of yesterday's, newest first.
export function timeline(now = new Date()) {
  const out = [];
  for (let back = 1; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back), key = dayKey(day);
    schedule(key).forEach((m, i) => { const t = make(key, i, m); if (t.at <= now.getTime()) out.push(t); });
  }
  return out.reverse();
}

// Find a generated tweet again from its id (for favorites and retweets).
export function byId(id) {
  const m = /^g(\d{4}-\d{2}-\d{2})-(\d+)$/.exec(id);
  if (!m) return null;
  const mins = schedule(m[1]), i = +m[2];
  return i < mins.length ? make(m[1], i, mins[i]) : null;
}
