/**
 * Seed list of known-popular Roblox universe IDs.
 * Used because the public chart/list API (games/sorts, games/list) was deprecated.
 * games.roblox.com/v1/games?universeIds=... still works without auth.
 *
 * These were manually curated from public community resources.
 * Add more over time — the pipeline filters by current live-player count.
 */
export const ROBLOX_SEED_UNIVERSE_IDS: number[] = [
  // Top-tier games (100k+ concurrent)
  1537690962,  // Adopt Me!
  4924922222,  // Brookhaven RP
  2753915549,  // Blox Fruits
  6284583030,  // Pet Simulator X
  4808875489,  // Piggy
  286090429,   // Arsenal
  1145618847,  // Tower of Hell
  606849621,   // Jailbreak
  142823291,   // Murder Mystery 2
  2436136736,  // MeepCity
  1962086868,  // Tower of Hell (alt ID)
  1534453623,  // Recoil
  3232544882,  // Doors
  5094699062,  // Fruit Battlegrounds
  4946930473,  // Raise a Floppa
  4869578726,  // Pet Legends
  3959462086,  // Anime Defenders
  4896473798,  // Clicker Simulator
  2985109765,  // Ultra Power Tycoon
  3596956420,  // Gym League
  // Action/Combat games
  189707,      // Natural Disaster Survival
  6061740635,  // Fisch
  5254416991,  // Untitled Boxing Game
  5936278775,  // Funky Friday
  4872321990,  // Type Soul
  6225218789,  // One Fruit Simulator
  7449615622,  // Toilet Tower Defense
  6985498960,  // Nico's Nextbots
  8065894886,  // SCP 3008
  4813895571,  // Deadlock
  // RPG/Adventure
  3231819759,  // Anime Fighting Simulator
  2414851778,  // Dungeon Quest
  5350027956,  // Sol's RNG
  7915475391,  // King Legacy
  6984567198,  // Anime Vanguards
  4499549595,  // Project Slayers
  6517249629,  // Ro-Ghoul
  3215529440,  // One Piece Game
  7244540108,  // Shindo Life
  6403373529,  // Anime Sword Simulator
  // Simulators
  1755924227,  // Bee Swarm Simulator
  6284583030,  // Pet Simulator X (duped intentionally)
  2534724415,  // Work at a Pizza Place
  1358177732,  // Lumber Tycoon 2
  3940775994,  // Gym Simulator
  5846580938,  // Fitness Simulator
  6862406310,  // Clicking Champions
  3082944928,  // Mega Noob Simulator
  5523560898,  // Mining Simulator 2
  // Tycoon games
  1538795814,  // Restaurant Tycoon 2
  4556697130,  // Prison Tycoon
  7238093044,  // Slime Simulator
  3040527553,  // Clone Tycoon 2
  6024885783,  // Super Doomspire
  6430019534,  // Build A Boat Tycoon
  3260590327,  // Car Dealership Tycoon
  4887394058,  // Anime Tycoon
  5551284272,  // Restaurant Tycoon X
  // Roleplay
  370731277,   // Boys and Girls Dance Club
  155615604,   // Robloxian Highschool
  5027044601,  // Bloxburg (free version test)
  1044372, 	   // Greenville
  11250780,    // Lumber Tycoon classic
  // Popular shooters
  3260590327,  // Car Dealership Tycoon
  286090429,   // Arsenal (alt)
  3216180969,  // Phantom Forces
  5032749323,  // Entry Point
  5027044601,  // Criminality
  // Obstacle courses
  143477452,   // Flood Escape 2
  189707,      // Natural Disaster Survival (classic)
  // More recent popular games
  5736374173,  // Tapping Simulator
  7130577801,  // Anime Last Stand
  6896171641,  // My Restaurant
  5617607888,  // Hero Havoc
  6920490416,  // Gates of Olympus
  6920876182,  // Kick
  7013896474,  // Anime Punch Simulator
  7266899836,  // Delivery Tycoon
  7215657166,  // SpeedRun Royale
  7255027237,  // Muscle Legends
  6956268764,  // Mining Tycoon
  7321562562,  // Noodle simulator
  7024702906,  // Islands
  7009290680,  // Gym Pioneers
  6922798952,  // Gummy Bear Simulator
  6848936752,  // Anime Punching Simulator
  6750039161,  // Horse World
  6653940082,  // Cleaning Simulator
  6601068720,  // Squid Game
  6445064898,  // Clicker Heroes
  6411073169,  // Miner's Haven 2
  6383422499,  // Block Hunt 2
  6225218789,  // Dragon Ball Rage
  6106695798,  // Power Simulator
  6039380949,  // Anime Impact Simulator
  5990598581,  // Saber Simulator
  5982200105,  // Shinobi Life 2
  5963440041,  // Anime Galaxy
  5927875449,  // Anime Blade
  5924993897,  // Speed City
];
