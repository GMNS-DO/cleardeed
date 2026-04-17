// Khordha district villages — English ↔ Odia mapping
// Source: Census 2011, Khordha district
// Hardcoded per ADR-005 to avoid dynamic Odia translation

export const DISTRICT_CODE = "18"; // Khordha in Bhulekh

export interface VillageMapping {
  english: string;
  odia: string;
  tahasil: string;
  riCircle: string;
}

export const KHRDHA_VILLAGES: VillageMapping[] = [
  // Bhubaneswar Tahasil
  { english: "Chandaka", odia: "ଚଣ୍ଡକା", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Haripur", odia: "ହରୀପୁର", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Mendhasala", odia: "ମେଣ୍ଡହାସାଲ", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Jatni", odia: "ଯାତନୀ", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Sangram", odia: "ସଂଗ୍ରାମ", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Gothapada", odia: "ଗୋଠପଦା", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Mandara", odia: "ମନ୍ଦର", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Sijua", odia: "ସିଜୁଆ", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Bhagabatipur", odia: "ଭଗବତୀପୁର", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Kudi", odia: "କୁଡି", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Dhaulimunda", odia: "ଧଉଳୀମୁଣ୍ଡ", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Brahmanabilen", odia: "ବ୍ରାହ୍ମଣ ବିଲ", tahasil: "Bhubaneswar", riCircle: "Chandaka" },

  // Balianta Tahasil
  { english: "Balipatna", odia: "ବଳିପାଟଣା", tahasil: "Balianta", riCircle: "Balipatna" },
  { english: "Dhaulipur", odia: "ଧଉଳୀପୁର", tahasil: "Balianta", riCircle: "Balipatna" },
  { english: "Gopalpur", odia: "ଗୋପାଳପୁର", tahasil: "Balianta", riCircle: "Balipatna" },
  { english: "Kakatpur", odia: "କାକାଟପୁର", tahasil: "Balianta", riCircle: "Balipatna" },
  { english: "Nayakendud", odia: "ନାୟକେଣ୍ଡୁଦ", tahasil: "Balianta", riCircle: "Balipatna" },

  // Balugaon Tahasil
  { english: "Balugaon", odia: "ବାଲୁଗାଁ", tahasil: "Balugaon", riCircle: "Balugaon" },
  { english: "Banapur", odia: "ବଣପୁର", tahasil: "Balugaon", riCircle: "Balugaon" },
  { english: "Nuagaon", odia: "ନୁଆଗାଁ", tahasil: "Balugaon", riCircle: "Balugaon" },
  { english: "Ranapur", odia: "ରଣପୁର", tahasil: "Balugaon", riCircle: "Balugaon" },
  { english: "Khurda", odia: "ଖୁର୍ଦ", tahasil: "Balugaon", riCircle: "Balugaon" },
];

// Lookup helpers
export function findVillageByEnglish(name: string): VillageMapping | undefined {
  return KHRDHA_VILLAGES.find(
    (v) => v.english.toLowerCase() === name.toLowerCase()
  );
}

export function findVillageByOdia(name: string): VillageMapping | undefined {
  return KHRDHA_VILLAGES.find((v) => v.odia === name);
}

// Get all villages for a tahasil
export function getVillagesByTahasil(tahasil: string): VillageMapping[] {
  return KHRDHA_VILLAGES.filter(
    (v) => v.tahasil.toLowerCase() === tahasil.toLowerCase()
  );
}

// Bhulekh API field values
export const BHULEKH_DISTRICT = "18";
export const BHULEKH_BASE_URL = "https://bhulekh.ori.nic.in";