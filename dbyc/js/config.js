// Google sign-in for your real YouTube subscriptions (see README → "Google setup").
// The client ID is public by design; Google only accepts it from the origins you list.
export const GOOGLE_CLIENT_ID = "";

// Piped servers to try for ad-free playback, search and channels, in order.
// DBYC also fetches the current public list and remembers whichever one last worked.
export const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.nosebs.ru"
];
export const PIPED_INSTANCE_LIST = "https://piped-instances.kavin.rocks/";
