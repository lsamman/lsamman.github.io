// In-world words for codenames and screens. Places, items and people from The Legend Of Chris.
const ADJ = ["Sideways", "Cracked", "Sacred", "Dormant", "Nether", "Legacy", "Pre-Cringe", "Unlimited", "Rancid", "Glowing",
  "Ancient", "Silent", "Haunted", "Analog", "Unpatched", "Shadowbanned", "Baller", "Midnight", "Frozen", "Vintage"];
const NOUN = ["Baja Blast", "God's Router", "Flip Phone", "Mixtape", "Prius", "Razr", "Zuck Tears", "Bluebird", "Ghost",
  "U2 Loop", "Club Shadowban", "Verizon Contract", "Accord", "Taco Bell", "Vine Loop", "Keynote", "Nokia", "3G Tower",
  "Siri", "MySpace Server"];

export function codename() {
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  return `Operation ${ADJ[r(ADJ.length)]} ${NOUN[r(NOUN.length)]}`;
}
export function fileNo() {
  const b = crypto.getRandomValues(new Uint8Array(3));
  return `File no. ${[...b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase()}-3G`;
}

// The refusal you get when the only camera faces you.
export const SELF_REFLECTION = {
  title: "Front camera detected",
  body: "The iPhone 3G has no front camera. To avoid self-reflection. Literally. This lens points at you, so Ghost Protocol has switched it off.",
  accept: "I accept self-reflection",
  library: "Pick a photo instead",
};

export const BURN_LINES = [
  "This message has self-destructed.",
  "Burned. Like Jokez’s autotune on a legacy format.",
  "Gone. FS Martin Genius vaped it into a drain.",
  "Destroyed. Return when Fortnite ends.",
];
