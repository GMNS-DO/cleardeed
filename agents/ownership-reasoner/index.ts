/**
 * OwnershipReasoner (A5) — Odia name matching for ClearDeed
 *
 * Compares seller-claimed English owner names against Bhulekh Odia RoR tenant names.
 * Produces a structured ownership assessment for A10 ConsumerReportWriter.
 */
import {
  OwnershipReasonerInputSchema,
  type OwnershipReasonerInput,
  type OwnershipReasonerResult,
  type NameMatch,
  type OwnerClaimValidation,
} from "./schema";

// Re-export for external consumers
export type { OwnershipReasonerInput } from "./schema";

// ─── Comprehensive known Bhulekh name transliterations ─────────────────────────

const KNOWN_ODIA_NAMES: Record<string, string> = {
  // Full multi-word names (most common Bhulekh tenants in Khordha)
  "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Krushnachandra Barajena",
  "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Pratima Chandra Barajena",
  "ସୁବର ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Subhra Chandra Barajena",
  "ସୁବର ଚନ୍ଦ୍ର ବାରଲ": "Subhra Chandra Baral",
  "ଗୌର ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Gaur Chandra Barajena",
  "ଗୌର ଚନ୍ଦ୍ର ବାରଲ": "Gaur Chandra Baral",
  "ସୁନୀତା ଦେବୀ": "Sunita Devi",
  "ସୁନୀତା ପଣଦା": "Sunita Panda",
  "ସୁନୀତା ମିଷାର": "Sunita Misra",
  "ରଖିତ ଅନାବାଦୀ": "Rakhit Anabadi",
  "ରମଣ ଚରଣ ମିଷାର": "Ramana Charan Misra",
  // Common given names (single token)
  "କୃଷ୍ଣଚନ୍ଦ୍ର": "Krushnachandra",
  "କୃଷ୍ଣ": "Krushna",
  "ପ୍ରତିମା": "Pratima",
  "ଚନ୍ଦ୍ର": "Chandra",
  "ସୁବର": "Subhra",
  "ସୁନୀତା": "Sunita",
  "ଗୌର": "Gaur",
  "ମୋହାପାତ୍ର": "Mohapatra",
  "ମହାନ୍ତୀ": "Mohanty",
  "ମଲ୍ଲିକ": "Mallick",
  "ମିଷାର": "Misra",
  "ନାଯକ": "Nayak",
  "ଝେନା": "Jena",
  "ତ୍ରିପାତ୍ତୀ": "Tripathy",
  "ଷାତ୍ତା": "Satya",
  "ଷହୂ": "Sahoo",
  "ଷ୍ବୈନ": "Swain",
  "ସୁବା": "Suba",
  "ସୁବରା": "Subra",
  "ସୁନା": "Suban",
  "ପ୍ରଫୁଲ୍ଲ": "Prafulla",
  "ପ୍ରଭା": "Prabha",
  "ପ୍ରଭାସ": "Prabhas",
  "ପ୍ରସନ୍ନ": "Prasanna",
  "ପ୍ରଣବ": "Pranab",
  "ବିକାଶ": "Bikash",
  "ବିଜୟ": "Vijay",
  "ବିନୋଦ": "Binod",
  "ବନମାଳୀ": "Banamali",
  "ବଳାଠକ": "Balabanta",
  "ବିଭୂତି": "Vibhuti",
  "ଭୂପେନ୍ଦ୍ର": "Bhuban",
  "ଭଗତ": "Bhagwat",
  "ମନୋଜ": "Manoj",
  "ମିଲନ": "Milan",
  "ଦିଲୀପ": "Dilip",
  "ଦିନବନ୍ଧୁ": "Dinabandhu",
  "ନରେନ୍ଦ୍ର": "Narendra",
  "ନିରଞ୍ଜନ": "Niranjan",
  "ନିତ୍യାନନ୍ଦ": "Nityananda",
  "ରାମ": "Ram",
  "ରାଘବ": "Raghava",
  "ରାଜେନ୍ଦ୍ର": "Rajendra",
  "ରଖିତ": "Rakhit",
  "ରମଣ": "Ramana",
  "ରାଧା": "Radha",
  "ରାଧକୃଷ୍ଣ": "Radhakrishna",
  "ରାଧାମଣ": "Radhaman",
  "ସୁଭାଷ": "Subhash",
  "ସତ୍ୟ": "Satya",
  "ସତ୍ୟ ପ୍ରକାଶ": "Satya Prakash",
  "ସୋମନାଥ": "Somanath",
  "ଶଙ୍କର": "Shankar",
  "ଶ୍ରୀ": "Shri",
  "ଚିତ୍ତରଂଜ": "Chitrasen",
  "ଚନ୍ଦ୍ରଶେଖର": "Chandrasekhar",
  "ଅମର": "Amar",
  "ଅରୁଣ": "Arun",
  "ଅନିଲ": "Anil",
  "ଆନନ୍ଦ": "Ananda",
  "କିଶୋର": "Kishore",
  "କାଳୀ": "Kali",
  "ଗୋପାଳ": "Gopal",
  "ମହେଶ": "Mahes",
  "ମଧୁ": "Madhu",
  "ମଧୁ ସୁଦାନ": "Madhu Sudan",
  "ପ୍ରମୋଦ": "Pramod",
  "ପୁରୁଷୋତ୍ତମ": "Purusottam",
  "ଭୀମ": "Bhim",
  "ଜଗନ୍ନାଥ": "Jagannath",
  "ନୃସିଂହ": "Nrusinha",
  "ନାରାୟଣ": "Narayan",
  "ବିଶ୍ଵନାଥ": "Bishwanath",
  "ଦ୍ୱାରକା ନାଥ": "Dwarka Nath",
  "ହରେକୃଷ୍ଣ": "Harekrushna",
  "କମଲନ୍ଦର": "Kamalananda",
  "ସ୍ନେହଲ": "Snehil",
  "ପ୍ରଶାଂତ": "Prasant",
  "ପ୍ରଦ୍ୟୁମନ": "Pradyumna",
  "ସୁମନ": "Suman",
  "ଅନ୍ଜନା": "Anjana",
  "ରେଖା": "Rekha",
  "ମମତା": "Mamata",
  "ମଙ୍ଗଳ": "Mangala",
  "ଚାରୁ": "Charu",
  "ମୃଣାଲ": "Mrinala",
  "ପୂଜା": "Puja",
  "ଭାବନା": "Bhabana",
  "ମାଲତୀ": "Malati",
  "କୃଷ୍ଣା": "Krushna",
  "ସୁଜାତ": "Sujata",
  "ବଂଶୀଧର": "Banshidhar",
  // Surnames
  "ବଡ଼ଯେନା": "Barajena",
  "ବାରଲ": "Baral",
  "ଦାଷ": "Das",
  "ବେହେରା": "Behera",
  "ବେଉରିଇ": "Beuria",
  "ବିଷ୍ଵାଲ": "Biswal",
  "ରାଉତ": "Raut",
  "ପଣଦା": "Panda",
  "ପରିଦା": "Parida",
  "ଦେବୀ": "Devi",
  "ସାହୁ": "Sahu",
  "ପରିଜା": "Parija",
  "କଲେଇ": "Kalei",
  "କଲ୍ୟ": "Kalia",
  "ସିଂହ": "Singh",
  "ସିଂହଦେବ": "Singhadeba",
  "ଶର୍ମା": "Sharma",
  "ଆଚାର୍ଯ୍ୟ": "Acharjya",
  "ତ୍ରିପାଠୀ": "Tripathi",
  "ଦ୍ଵିବେଦୀ": "Divedi",
  "ଭୋଇ": "Bhoi",
  "ସାଉ": "Sao",
  "ଧାର": "Dhar",
  "ମାଲେଇ": "Malei",
  "ବାରେଇ": "Barei",
  "ମହାପତ୍ର": "Mahapatra",
  "ଦାଶ": "Dash",
  "ତ୍ରିବେଦୀ": "Tribedi",
  "ଚଉଦ": "Choudhury",
  "ଚୌଧୁରୀ": "Choudhury",
  "ସେନ": "Sen",
  "କର": "Kara",
  "କରଣ": "Karan",
  "କୁମାର": "Kumar",
  "ପ୍ରସାଦ": "Prasad",
  "ଚରଣ": "Charan",
  "ଭୂଷଣ": "Bhusan",
  "ନାଥ": "Nath",
  "ମଲ୍ଲ": "Malla",
  "ଭୂତର": "Bhutra",
  "ଭୂତେଇ": "Bhue",
  "ପହଡ଼": "Pahada",
  "ମାହୁଣ୍ଟ": "Mahunta",
  // Multi-name patterns (common in Bhulekh)
  "ଭଗତ ଚନ୍ଦ୍ର ବେହେରା": "Bhagwat Chandra Behera",
  "ଭଗତ ଚନ୍ଦ୍ର ଝେନା": "Bhagwat Chandra Jena",
  "ଭଗତ ଚନ୍ଦ୍ର ନାଯକ": "Bhagwat Chandra Nayak",
  "ଭଗତ ଚନ୍ଦ୍ର ପରିଦା": "Bhagwat Chandra Parida",
  "ଭଗତ ଚନ୍ଦ୍ର ରାଉତ": "Bhagwat Chandra Raut",
  "ଭଗତ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Bhagwat Chandra Mohapatra",
  "ଭଗତ ଚନ୍ଦ୍ର ମହାନ୍ତୀ": "Bhagwat Chandra Mohanty",
  "ଭଗତ ଚନ୍ଦ୍ର ଦାଷ": "Bhagwat Chandra Das",
  "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Bikash Chandra Mohapatra",
  "ବିକାଶ ଚନ୍ଦ୍ର ବେହେରା": "Bikash Chandra Behera",
  "ବିକାଶ ଚନ୍ଦ୍ର ଝେନା": "Bikash Chandra Jena",
  "ବିକାଶ ଚନ୍ଦ୍ର ନାଯକ": "Bikash Chandra Nayak",
  "ବିକାଶ ଚନ୍ଦ୍ର ଦାଷ": "Bikash Chandra Das",
  "ବିକାଶ ଚନ୍ଦ୍ର ମହାନ୍ତୀ": "Bikash Chandra Mohanty",
  "ପ୍ରଭାସ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Prabhas Chandra Mohapatra",
  "ପ୍ରଭାସ ଚନ୍ଦ୍ର ଝେନା": "Prabhas Chandra Jena",
  "ପ୍ରଭାସ ଚନ୍ଦ୍ର ପରିଦା": "Prabhas Chandra Parida",
  "ପ୍ରଭାସ ଚନ୍ଦ୍ର ରାଉତ": "Prabhas Chandra Raut",
  "ପ୍ରଭାସ ଚନ୍ଦ୍ର ନାଯକ": "Prabhas Chandra Nayak",
  "ରାମ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Ram Chandra Mohapatra",
  "ରାମ ଚନ୍ଦ୍ର ଝେନା": "Ram Chandra Jena",
  "ରାମ ଚନ୍ଦ୍ର ଦାଷ": "Ram Chandra Das",
  "ରାମ ଚନ୍ଦ୍ର ନାଯକ": "Ram Chandra Nayak",
  "ରାମ ଚନ୍ଦ୍ର ବେହେରା": "Ram Chandra Behera",
  "ରାମ ଚନ୍ଦ୍ର ପରିଦା": "Ram Chandra Parida",
  "ରାମ ଚନ୍ଦ୍ର ମହାନ୍ତୀ": "Ram Chandra Mohanty",
  "ଦିନବନ୍ଧୁ ମୋହାପାତ୍ର": "Dinabandhu Mohapatra",
  "ଦିନବନ୍ଧୁ ଝେନା": "Dinabandhu Jena",
  "ଦିନବନ୍ଧୁ ଦାଷ": "Dinabandhu Das",
  "ଦିନବନ୍ଧୁ ପରିଦା": "Dinabandhu Parida",
  "ଦିନବନ୍ଧୁ ବେହେରା": "Dinabandhu Behera",
  "ଦିନବନ୍ଧୁ ରାଉତ": "Dinabandhu Raut",
  "ଦିନବନ୍ଧୁ ନାଯକ": "Dinabandhu Nayak",
  "ଦିନବନ୍ଧୁ ମହାନ୍ତୀ": "Dinabandhu Mohanty",
  "ନରେନ୍ଦ୍ର ନାଯକ": "Narendra Nayak",
  "ନରେନ୍ଦ୍ର ମୋହାପାତ୍ର": "Narendra Mohapatra",
  "ନିରଞ୍ଜନ ମୋହାପାତ୍ର": "Niranjan Mohapatra",
  "ନିରଞ୍ଜନ ଝେନା": "Niranjan Jena",
  "ନିରଞ୍ଜନ ଦାଷ": "Niranjan Das",
  "ନିରଞ୍ଜନ ପରିଦା": "Niranjan Parida",
  "ସୁଭାଷ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Subhash Chandra Mohapatra",
  "ସୁଭାଷ ଚନ୍ଦ୍ର ଝେନା": "Subhash Chandra Jena",
  "ସୁଭାଷ ଚନ୍ଦ୍ର ଦାଷ": "Subhash Chandra Das",
  "ସୁଭାଷ ଚନ୍ଦ୍ର ମହାନ୍ତୀ": "Subhash Chandra Mohanty",
  "ସୁଭାଷ ଚନ୍ଦ୍ର ବେହେରା": "Subhash Chandra Behera",
  "ମନୋଜ କୁମାର ମୋହାପାତ୍ର": "Manoj Kumar Mohapatra",
  "ମନୋଜ କୁମାର ଝେନା": "Manoj Kumar Jena",
  "ମନୋଜ କୁମାର ଦାଷ": "Manoj Kumar Das",
  "ମନୋଜ କୁମାର ପରିଦା": "Manoj Kumar Parida",
  "ମନୋଜ କୁମାର ବେହେରା": "Manoj Kumar Behera",
  "ମନୋଜ କୁମାର ରାଉତ": "Manoj Kumar Raut",
  "ପ୍ରଫୁଲ୍ଲ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Prafulla Chandra Mohapatra",
  "ପ୍ରଫୁଲ୍ଲ ଚନ୍ଦ୍ର ଝେନା": "Prafulla Chandra Jena",
  "ପ୍ରଫୁଲ୍ଲ ଚନ୍ଦ୍ର ଦାଷ": "Prafulla Chandra Das",
  "ବନମାଳୀ ସାହୁ": "Banamali Sahu",
  "ବନମାଳୀ ପଣଦା": "Banamali Panda",
  "ବନମାଳୀ ଦେବୀ": "Banamali Dei",
  "ବନମାଳୀ ମୋହାପାତ୍ର": "Banamali Mohapatra",
  "ପ୍ରସନ୍ନ କୁମାର ଦାଷ": "Prasanna Kumar Das",
  "ପ୍ରସନ୍ନ କୁମାର ମୋହାପାତ୍ର": "Prasanna Kumar Mohapatra",
  "ଅମର ମୋହାପାତ୍ର": "Amar Mohapatra",
  "ଅରୁଣ ମୋହାପାତ୍ର": "Arun Mohapatra",
  "ଅନିଲ ମୋହାପାତ୍ର": "Anil Mohapatra",
  "ଆନନ୍ଦ ମୋହାପାତ୍ର": "Ananda Mohapatra",
  "ଚିତ୍ତରଂଜ ମୋହାପାତ୍ର": "Chitrasen Mohapatra",
  "ଭୂପେନ୍ଦ୍ର ମୋହାପାତ୍ର": "Bhuban Mohapatra",
  "ଭୂପେନ୍ଦ୍ର ଝେନା": "Bhuban Jena",
  "ଭୂପେନ୍ଦ୍ର ଦାଷ": "Bhuban Das",
  "ଭୂପେନ୍ଦ୍ର ନାଯକ": "Bhuban Nayak",
  "ଭୂପେନ୍ଦ୍ର ରାଉତ": "Bhuban Raut",
  "ଭୂପେନ୍ଦ୍ର ବେହେରା": "Bhuban Behera",
  "ଭୂପେନ୍ଦ୍ର ମହାନ୍ତୀ": "Bhuban Mohanty",
  "ଗୌର ଚରଣ ମୋହାପାତ୍ର": "Gaur Charan Mohapatra",
  "କିଶୋର ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Kishore Chandra Mohapatra",
  "କିଶୋର ଚନ୍ଦ୍ର ଦାଷ": "Kishore Chandra Das",
  "ସତ୍ୟ ପ୍ରକାଶ ମୋହାପାତ୍ର": "Satya Prakash Mohapatra",
  "ସତ୍ୟ ପ୍ରକାଶ ଝେନା": "Satya Prakash Jena",
  "ସତ୍ୟ ପ୍ରକାଶ ଦାଷ": "Satya Prakash Das",
  "ସତ୍ୟ ପ୍ରକାଶ ବେହେରା": "Satya Prakash Behera",
  "ସତ୍ୟ ପ୍ରକାଶ ମହାନ୍ତୀ": "Satya Prakash Mohanty",
  "ସତ୍ୟ ପ୍ରକାଶ ନାଯକ": "Satya Prakash Nayak",
  "ସତ୍ୟ ପ୍ରକାଶ ପରିଦା": "Satya Prakash Parida",
  "ସତ୍ୟ ପ୍ରକାଶ ରାଉତ": "Satya Prakash Raut",
  "ବିଜୟ କୁମାର ମୋହାପାତ୍ର": "Vijay Kumar Mohapatra",
  "ବିଜୟ କୁମାର ଝେନା": "Vijay Kumar Jena",
  "ବିଜୟ କୁମାର ଦାଷ": "Vijay Kumar Das",
  "ବିଜୟ କୁମାର ବେହେରା": "Vijay Kumar Behera",
  "ବିଜୟ କୁମାର ମହାନ୍ତୀ": "Vijay Kumar Mohanty",
  "ବିଜୟ କୁମାର ରାଉତ": "Vijay Kumar Raut",
  "ଚନ୍ଦ୍ରଶେଖର ମୋହାପାତ୍ର": "Chandrasekhar Mohapatra",
  "ଚନ୍ଦ୍ରଶେଖର ଝେନା": "Chandrasekhar Jena",
  "ଚନ୍ଦ୍ରଶେଖର ଦାଷ": "Chandrasekhar Das",
  "ପ୍ରଣବ କୁମାର ମୋହାପାତ୍ର": "Pranab Kumar Mohapatra",
  "ରାଧା ମୋହାପାତ୍ର": "Radha Mohapatra",
  "ରାଧା ଦେବୀ": "Radha Devi",
  "ରାଧା ପଣଦା": "Radha Panda",
  "ମନୋରମା ଦେବୀ": "Manorama Devi",
  "କମଲ ଦେବୀ": "Kamala Devi",
  "ଲକ୍ଷ୍ମୀ ଦେବୀ": "Laxmi Devi",
  "ଗୌରୀ ଦେବୀ": "Gauri Devi",
  "ଭାଗୀରଥୀ ଦେବୀ": "Bhagirthi Devi",
  "ଶ୍ରୀ ରାମ ଦାଷ": "Shri Ram Das",
  "ଜଗନ୍ନାଥ ଦାଷ": "Jagannath Das",
  "ଜଗନ୍ନାଥ ମୋହାପାତ୍ର": "Jagannath Mohapatra",
  "ଜଗନ୍ନାଥ ଝେନା": "Jagannath Jena",
  "ଜଗନ୍ନାଥ ପରିଦା": "Jagannath Parida",
  "ଜଗନ୍ନାଥ ରାଉତ": "Jagannath Raut",
  "ଜଗନ୍ନାଥ ବେହେରା": "Jagannath Behera",
  "ଜଗନ୍ନାଥ ନାଯକ": "Jagannath Nayak",
  "ଜଗନ୍ନାଥ ମହାନ୍ତୀ": "Jagannath Mohanty",
  "କାଳୀ ଚରଣ ଦାଷ": "Kali Charan Das",
  "ସୋମନାଥ ଦାଷ": "Somanath Das",
  "ସୋମନାଥ ମୋହାପାତ୍ର": "Somanath Mohapatra",
  "ବଳାଠକ ମୋହାପାତ୍ର": "Balabanta Mohapatra",
  "ଗୋପାଳ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର": "Gopal Chandra Mohapatra",
  "ରାଧାକୃଷ୍ଣ ମୋହାପାତ୍ର": "Radhakrishna Mohapatra",
  "ବଂଶୀଧର ମୋହାପାତ୍ର": "Banshidhar Mohapatra",
  "ବଂଶୀଧର ଝେନା": "Banshidhar Jena",
  "ବଂଶୀଧର ଦାଷ": "Banshidhar Das",
  "ବଂଶୀଧର ରାଉତ": "Banshidhar Raut",
  "ବିଭୂତି ଭୂଷଣ ଦାଷ": "Vibhuti Bhusan Das",
  "ମଧୁ ସୁଦାନ ଦାଷ": "Madhu Sudan Das",
  "କୃଷ୍ଣ ଚରଣ ମୋହାପାତ୍ର": "Krushna Charan Mohapatra",
  "ଦିଲୀପ କୁମାର ମୋହାପାତ୍ର": "Dilip Kumar Mohapatra",
  "ଶଙ୍କର ଦାଷ": "Shankar Das",
  "ଶଙ୍କର ମୋହାପାତ୍ର": "Shankar Mohapatra",
  "ପୁରୁଷୋତ୍ତମ ମୋହାପାତ୍ର": "Purusottam Mohapatra",
  "ପୁରୁଷୋତ୍ତମ ଝେନା": "Purusottam Jena",
  "ପୁରୁଷୋତ୍ତମ ମହାନ୍ତୀ": "Purusottam Mohanty",
  "ପୁରୁଷୋତ୍ତମ ନାଯକ": "Purusottam Nayak",
  "ପୁରୁଷୋତ୍ତମ ବେହେରା": "Purusottam Behera",
  "ପୁରୁଷୋତ୍ତମ ରାଉତ": "Purusottam Raut",
  "ହରେକୃଷ୍ଣ ମୋହାପାତ୍ର": "Harekrushna Mohapatra",
  "ହରେକୃଷ୍ଣ ଝେନା": "Harekrushna Jena",
  "ହରେକୃଷ୍ଣ ମହାନ୍ତୀ": "Harekrushna Mohanty",
  "ନାରାୟଣ ମୋହାପାତ୍ର": "Narayan Mohapatra",
  "ନାରାୟଣ ଝେନା": "Narayan Jena",
  "ନାରାୟଣ ମହାନ୍ତୀ": "Narayan Mohanty",
  "ନାରାୟଣ ବେହେରା": "Narayan Behera",
  "ବିଶ୍ଵନାଥ ମୋହାପାତ୍ର": "Bishwanath Mohapatra",
  "ବିଶ୍ଵନାଥ ଝେନା": "Bishwanath Jena",
  "ବିଶ୍ଵନାଥ ଦାଷ": "Bishwanath Das",
  // Land class
  "ଦାନ୍ଥା": "Bagayat",
  "ଦଣ୍ଡା": "Danda",
  // Odia digits
  "୦": "0", "୧": "1", "୨": "2", "୩": "3", "୪": "4",
  "୫": "5", "୬": "6", "୭": "7", "୮": "8", "୯": "9",
  // Titles
  "ଶ୍ରୀମାନ": "Shriman",
  "ଶ୍ରୀମତୀ": "Shrimati",
  "କୁମାରୀ": "Kumari",
};

// ─── Odia character maps ─────────────────────────────────────────────────────

const ODIA_CONSONANTS = new Set([
  "କ","ଖ","ଗ","ଘ","ଙ","ଚ","ଛ","ଜ","ଝ","ଞ",
  "ଟ","ଠ","ଡ","ଢ","ଣ","ତ","ଥ","ଦ","ଧ","ନ",
  "଩","ପ","ଫ","ବ","ଭ","ମ","ଯ","ର","଱","ଲ",
  "ଳ","ଵ","ଶ","ଷ","ସ","ହ",
]);
const ODIA_CANDRA_BINDU = "଼";
const ODIA_VOWELS = new Set(["ଅ","ଆ","ଇ","ଈ","ଉ","ଊ","ଋ","ଌ","଍","଎","ଏ","ଐ"]);
const ODIA_VOWEL_MODIFIERS = new Set(["ା","ି","ୀ","ୁ","ୂ","ୃ","ୄ","େ","ୈ","ୋ","ୌ","ୖ"]);
const ODIA_VIRAMA = "୍";
const ODIA_ANUSVARA = new Set(["ଁ","ଂ"]);

const ODIA_CONSONANT_MAP: Record<string, string> = {
  "କ":"k","ଖ":"kh","ଗ":"g","ଘ":"gh","ଙ":"ng",
  "ଚ":"ch","ଛ":"chh","ଜ":"j","ଝ":"jh","ଞ":"ny",
  "ଟ":"t","ଠ":"th","ଡ":"d","ଢ":"dh","ଣ":"n",
  "ତ":"t","ଥ":"th","ଦ":"d","ଧ":"dh","ନ":"n",
  "଩":"ng","ପ":"p","ଫ":"ph","ବ":"b","ଭ":"bh",
  "ମ":"m","ଯ":"y","ର":"r","଱":"sh","ଲ":"l",
  "ଳ":"l","ଵ":"sh","ଶ":"s","ଷ":"s","ସ":"s","ହ":"h",
};
const ODIA_CLUSTER_CONSONANT_MAP: Record<string, string> = {
  "କ":"k","ଖ":"kh","ଗ":"g","ଘ":"gh",
  "ଚ":"ch","ଛ":"chh","ଜ":"j","ଝ":"jh",
  "ଟ":"t","ଠ":"th","ଡ":"d","ଢ":"dh",
  "ତ":"t","ଥ":"th","ଦ":"d","ଧ":"dh",
  "ପ":"p","ଫ":"ph","ବ":"b","ଭ":"bh",
  "ମ":"m","ଯ":"y","ର":"r","ଲ":"l",
  "ଶ":"sh","ଷ":"sh","ସ":"sh","ହ":"h",
};
const ODIA_VOWEL_MAP: Record<string, string> = {
  "ଅ":"a","ଆ":"aa","ଇ":"i","ଈ":"ii","ଉ":"u","ଊ":"uu","ଋ":"ri","ଏ":"e","ଐ":"ai",
};
const ODIA_MODIFIER_MAP: Record<string, string> = {
  "ା":"aa","ି":"i","ୀ":"ii","ୁ":"u","ୂ":"uu","ୃ":"ri","େ":"e","ୈ":"ai","ୋ":"o","ୌ":"au","ୖ":"au",
};

// ─── Transliteration ──────────────────────────────────────────────────────────

export function containsOdia(text: string): boolean {
  return /[଀-୿]/.test(text);
}

export function transliterateOdia(text: string): string {
  if (!text) return "";
  if (!containsOdia(text)) return text;
  const trimmed = text.trim();
  if (KNOWN_ODIA_NAMES[trimmed]) return KNOWN_ODIA_NAMES[trimmed];
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => KNOWN_ODIA_NAMES[w.trim()] ?? charByChar(w.trim())).join(" ");
  }
  return charByChar(trimmed);
}

function charByChar(text: string): string {
  const result: string[] = [];
  const chars = [...text];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === ODIA_CANDRA_BINDU) { result.push("n"); i++; continue; }
    if (ODIA_ANUSVARA.has(c)) { result.push("n"); i++; continue; }
    if (ODIA_VOWELS.has(c)) { result.push(ODIA_VOWEL_MAP[c] ?? c); i++; continue; }
    if (ODIA_VOWEL_MODIFIERS.has(c)) {
      if (result.length > 0) result[result.length - 1] += ODIA_MODIFIER_MAP[c] ?? "";
      i++; continue;
    }
    if (ODIA_CONSONANTS.has(c)) {
      const cluster: string[] = [c];
      let scan = i + 1;
      while (scan < chars.length - 1 && chars[scan] === ODIA_VIRAMA && ODIA_CONSONANTS.has(chars[scan + 1])) {
        cluster.push(chars[scan], chars[scan + 1]);
        scan += 2;
      }
      const modifiers: string[] = [];
      while (scan < chars.length && (ODIA_VOWEL_MODIFIERS.has(chars[scan]) || chars[scan] === ODIA_CANDRA_BINDU)) {
        modifiers.push(chars[scan++]);
      }
      let base: string;
      if (cluster.length > 1) {
        const consonants = cluster.filter((_, idx) => idx % 2 === 0);
        const lastC = consonants[consonants.length - 1];
        const prefix = consonants.slice(0, -1).map(x => ODIA_CONSONANT_MAP[x] ?? x).join("");
        base = prefix + (ODIA_CLUSTER_CONSONANT_MAP[lastC] ?? lastC);
      } else {
        base = ODIA_CONSONANT_MAP[c] ?? c;
      }
      const hasIMatra = modifiers.includes("ି");
      if (hasIMatra) {
        const lastC = cluster.filter((_, idx) => idx % 2 === 0).at(-1);
        const unaspMap: Record<string, string> = { "ଖ":"k","ଘ":"g","ଛ":"ch","ଝ":"j","ଠ":"t","ଢ":"d","ଥ":"th","ଧ":"dh","ଫ":"p","ଭ":"b" };
        if (lastC && unaspMap[lastC]) {
          base = base.replace(ODIA_CONSONANT_MAP[lastC] ?? lastC, unaspMap[lastC]);
        }
      }
      if (modifiers.length === 0) {
        if (cluster.length === 1) base += "a";
        result.push(base);
      } else {
        for (const mod of modifiers) {
          if (mod === ODIA_CANDRA_BINDU) base += "n";
          else if (mod !== "ି") base += ODIA_MODIFIER_MAP[mod] ?? "";
        }
        result.push(base);
      }
      i = scan;
      continue;
    }
    if (/\s/.test(c) || /^[.,;:!?-]$/.test(c)) result.push(c);
    i++;
  }
  return result.join("");
}

export function transliterateOdiaName(text: string): string {
  if (!text) return "";
  return containsOdia(text) ? transliterateOdia(text) : text;
}

type TransliterationMethod =
  | "known_name_dictionary"
  | "odia_transliteration_v1"
  | "latin_passthrough"
  | "empty";

function transliterationMethod(text: string): TransliterationMethod {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (!containsOdia(trimmed)) return "latin_passthrough";
  return KNOWN_ODIA_NAMES[trimmed] ? "known_name_dictionary" : "odia_transliteration_v1";
}

// ─── Dice coefficient ─────────────────────────────────────────────────────────

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string): Set<string> => {
    const s2 = s.toLowerCase();
    const set = new Set<string>();
    for (let i = 0; i < s2.length - 1; i++) set.add(s2.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  return ba.size + bb.size === 0 ? 0 : (2 * inter) / (ba.size + bb.size);
}

// ─── Surname maps ─────────────────────────────────────────────────────────────

const ODIA_SURNAME_MAP: Record<string, string> = {
  mohapatra:"ମୋହାପାତ୍ର", mahapatra:"ମହାପତ୍ର", misra:"ମିଷାର",
  parida:"ପରିଦା", baral:"ବାରଲ", barajena:"ବଡ଼ଯେନା",
  das:"ଦାଷ", dash:"ଦାଶ", mohanty:"ମହାନ୍ତୀ",
  nayak:"ନାଯକ", tripathy:"ତ୍ରିପାତ୍ତୀ", panda:"ପଣଦା",
  raut:"ରାଉତ", rout:"ରାଉତ", behera:"ବେହେରା",
  jena:"ଝେନା", sahoo:"ଷହୂ", swain:"ଷ୍ବୈନ",
  ray:"ରଇଯ", mallick:"ମଲ୍ଲିକ",
};
const SURNAME_CLUSTERS: Record<string, string[]> = {
  mohapatra:["mohapatra","mahapatra","misra","parida","panda","swain","dash"],
  barajena:["barajena","baral","raut","rout","ray"],
};

// ─── Name matching ───────────────────────────────────────────────────────────

interface MatchResult { matches: boolean; nameMatch: NameMatch; confidence: number; score: number; method: string; }

export function matchOwnerName(claimedName: string, odiaTenantName: string, fatherNameOdia?: string): MatchResult {
  if (!claimedName || !odiaTenantName) return { matches:false, nameMatch:"unknown", confidence:0, score:0, method:"none" };
  const cl = claimedName.toLowerCase().trim();
  const parts = cl.split(/\s+/);
  const clSurname = parts[parts.length - 1];
  const clGiven = parts.slice(0,-1).join(" ");
  const trans = transliterateOdiaName(odiaTenantName);
  const transL = trans.toLowerCase();
  const transParts = transL.split(/\s+/);
  const transSurname = transParts[transParts.length - 1];
  const transGiven = transParts.slice(0,-1).join(" ");
  const transFather = fatherNameOdia ? transliterateOdiaName(fatherNameOdia).toLowerCase() : "";
  if (cl === transL) return { matches:true, nameMatch:"exact", confidence:0.95, score:1.0, method:"exact_transliteration" };
  const diceFull = diceCoefficient(cl, transL);
  if (diceFull >= 0.85) return { matches:true, nameMatch:"exact", confidence:0.90, score:diceFull, method:"dice_full_name" };
  if (diceFull >= 0.60) return { matches:true, nameMatch:"partial", confidence:0.70, score:diceFull, method:"dice_full_name" };
  const odiaScript = ODIA_SURNAME_MAP[clSurname];
  if (odiaScript && odiaTenantName.includes(odiaScript)) return { matches:true, nameMatch:"partial", confidence:0.62, score:0.62, method:"odia_surname_map" };
  const surnameDice = diceCoefficient(clSurname, transSurname);
  if (surnameDice >= 0.85) return { matches:true, nameMatch:"partial", confidence:0.60, score:surnameDice, method:"surname_dice" };
  const cluster = findSurnameCluster(clSurname);
  if (cluster && transSurname && cluster.includes(transSurname)) return { matches:true, nameMatch:"partial", confidence:0.60, score:surnameDice, method:"surname_cluster" };
  if (transFather && cl.includes(transFather)) return { matches:true, nameMatch:"partial", confidence:0.40, score:0.4, method:"father_name_match" };
  if (transGiven) {
    const givenDice = diceCoefficient(clGiven, transGiven);
    if (givenDice >= 0.70 && surnameDice >= 0.60) return { matches:true, nameMatch:"partial", confidence:0.50, score:(givenDice+surnameDice)/2, method:"given_name_dice" };
  }
  return { matches:false, nameMatch:"mismatch", confidence:surnameDice, score:surnameDice, method:"none" };
}

function findSurnameCluster(surname: string): string[] | null {
  const lower = surname.toLowerCase();
  for (const [,members] of Object.entries(SURNAME_CLUSTERS)) if (members.includes(lower)) return members;
  for (const [base,members] of Object.entries(SURNAME_CLUSTERS)) if (lower.includes(base) || base.includes(lower)) return members;
  return null;
}

// ─── Input sanitization ───────────────────────────────────────────────────────

export function sanitize(text: string): string {
  if (!text) return "";
  return String(text).slice(0,10_000).replace(/<[^>]*>/g," ").replace(/\bjavascript:/gi,"").replace(/\bon\w+\s*=/gi,"").replace(/\bsrc\s*=/gi,"").replace(/\s+/g," ").trim();
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function reasonOwnership(input: OwnershipReasonerInput): Promise<OwnershipReasonerResult> {
  const parsed = OwnershipReasonerInputSchema.safeParse(input);
  if (!parsed.success) return unavailableOwnershipResult("Invalid input.", "Input validation failed.");
  const { claimedOwnerName, fatherHusbandName, rorDocument } = parsed.data;
  const cleanClaimed = sanitize(claimedOwnerName);
  const inputQuality = classifyOwnerInput(cleanClaimed);
  if (!rorDocument.tenants || rorDocument.tenants.length === 0) return unavailableOwnershipResult("No owner records found in Bhulekh.", "RoR returned no tenants.", inputQuality);
  const tenants = rorDocument.tenants;
  let bestMatch: MatchResult | null = null;
  let matchedIdx = 0;
  const coOwnerNames: string[] = [];
  for (let i = 0; i < tenants.length; i++) {
    const t = tenants[i];
    const m = matchOwnerName(cleanClaimed, t.tenantName, t.fatherHusbandName ? sanitize(t.fatherHusbandName) : undefined);
    if (!bestMatch || m.confidence > bestMatch.confidence) { bestMatch = m; matchedIdx = i; }
    coOwnerNames.push(transliterateOdiaName(t.tenantName));
  }
  const primary = tenants[matchedIdx];
  const offOdia = primary?.tenantName ?? "";
  const transliterated = transliterateOdiaName(offOdia);
  const fatherTrans = transliterateOdiaName(primary?.fatherHusbandName ?? "");
  const matchedOwnerProvenance = {
    sourceTenantIndex: matchedIdx,
    rawOwnerName: offOdia,
    transliteratedOwnerName: transliterated,
    ownerTransliterationMethod: transliterationMethod(offOdia),
    rawGuardianName: primary?.fatherHusbandName,
    transliteratedGuardianName: fatherTrans || undefined,
    guardianTransliterationMethod: transliterationMethod(primary?.fatherHusbandName ?? ""),
  };
  const matchedOwnerKey = normalizeOwnerIdentity(coOwnerNames[matchedIdx] ?? transliterated);
  const coOwners = dedupeOwnerNames(
    coOwnerNames.filter((name, i) => i !== matchedIdx && normalizeOwnerIdentity(name) !== matchedOwnerKey)
  );
  const fatherHusbandMatch = compareFatherHusbandName(fatherHusbandName, primary?.fatherHusbandName);
  const ownerClaimValidation = buildOwnerClaimValidation({
    bestMatch,
    inputQuality,
    matchedIdx,
    offOdia,
    transliterated,
    fatherHusbandMatch,
    tenantCount: tenants.length,
  });
  const explanation = buildExplanation(bestMatch, cleanClaimed, transliterated, coOwners.length, ownerClaimValidation);
  return {
    officialOwnerName: offOdia, transliteratedOwnerName: transliterated,
    nameMatch: ownerClaimValidation.claimState === "ambiguous" ? "partial" : bestMatch?.nameMatch ?? "unknown",
    nameMatchConfidence: bestMatch ? { score:bestMatch.score, method:bestMatch.method } : undefined,
    discrepancyExplanation: explanation, coOwners,
    fatherNameOnRecord: fatherTrans || undefined,
    confidence: ownerClaimValidation.confidence,
    confidenceBasis: buildBasis(bestMatch, tenants.length, ownerClaimValidation),
    matchedTenantIndex: matchedIdx,
    claimState: ownerClaimValidation.claimState,
    readiness: ownerClaimValidation.readiness,
    inputQuality,
    fatherHusbandMatch,
    matchReasons: ownerClaimValidation.reasons,
    blockingWarnings: ownerClaimValidation.blockingWarnings,
    ownerClaimValidation,
    matchedOwnerProvenance,
  };
}

function unavailableOwnershipResult(
  discrepancyExplanation: string,
  confidenceBasis: string,
  inputQuality: OwnerClaimValidation["inputQuality"] = "empty"
): OwnershipReasonerResult {
  const ownerClaimValidation: OwnerClaimValidation = {
    claimState: "unavailable",
    readiness: "L0",
    inputQuality,
    officialOwnerName: "",
    transliteratedOwnerName: "",
    fatherHusbandMatch: "not_provided",
    confidence: 0,
    reasons: [{ code: "owner_records_unavailable", label: confidenceBasis, weight: 0 }],
    blockingWarnings: ["Bhulekh owner records were unavailable or unusable."],
  };
  return {
    officialOwnerName: "",
    transliteratedOwnerName: "",
    nameMatch: "unknown",
    discrepancyExplanation,
    coOwners: [],
    confidence: 0,
    confidenceBasis,
    claimState: ownerClaimValidation.claimState,
    readiness: ownerClaimValidation.readiness,
    inputQuality,
    fatherHusbandMatch: ownerClaimValidation.fatherHusbandMatch,
    matchReasons: ownerClaimValidation.reasons,
    blockingWarnings: ownerClaimValidation.blockingWarnings,
    ownerClaimValidation,
  };
}

function classifyOwnerInput(name: string): OwnerClaimValidation["inputQuality"] {
  if (!name.trim()) return "empty";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return "single_token";
  if (parts.some((part) => /^[a-z]\.?$/i.test(part))) return "initials_or_abbrev";
  return "full_name";
}

function compareFatherHusbandName(
  claimedFatherHusbandName: string | undefined,
  officialFatherHusbandName: string | undefined
): OwnerClaimValidation["fatherHusbandMatch"] {
  const claimed = sanitize(claimedFatherHusbandName ?? "");
  if (!claimed) return "not_provided";
  if (!officialFatherHusbandName) return "not_on_record";
  const official = transliterateOdiaName(officialFatherHusbandName);
  const score = diceCoefficient(claimed.toLowerCase(), official.toLowerCase());
  return score >= 0.8 ? "matched" : "mismatch";
}

function dedupeOwnerNames(names: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const name of names) {
    const key = normalizeOwnerIdentity(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(name);
  }
  return deduped;
}

function normalizeOwnerIdentity(name: string): string {
  return sanitize(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOwnerClaimValidation(input: {
  bestMatch: MatchResult | null;
  inputQuality: OwnerClaimValidation["inputQuality"];
  matchedIdx: number;
  offOdia: string;
  transliterated: string;
  fatherHusbandMatch: OwnerClaimValidation["fatherHusbandMatch"];
  tenantCount: number;
}): OwnerClaimValidation {
  const { bestMatch, inputQuality, matchedIdx, offOdia, transliterated, fatherHusbandMatch, tenantCount } = input;
  const reasons: OwnerClaimValidation["reasons"] = [];
  const blockingWarnings: string[] = [];

  if (inputQuality === "single_token") {
    blockingWarnings.push("Only a surname or single-word owner name was provided; this is not enough to confirm identity.");
  } else if (inputQuality === "initials_or_abbrev") {
    blockingWarnings.push("The owner name includes initials or abbreviations; ask for the full legal name from ID and sale documents.");
  } else if (inputQuality === "empty") {
    blockingWarnings.push("No owner name was provided.");
  }

  if (bestMatch) {
    reasons.push({
      code: bestMatch.method,
      label: ownerMatchMethodLabel(bestMatch.method),
      weight: bestMatch.confidence,
      detail: `Automated score ${bestMatch.score.toFixed(2)} against matched tenant ${matchedIdx + 1} of ${tenantCount}.`,
    });
  }

  if (fatherHusbandMatch === "matched") {
    reasons.push({
      code: "father_husband_match",
      label: "Provided father/husband context matched the RoR guardian field.",
      weight: 0.15,
    });
  } else if (fatherHusbandMatch === "mismatch") {
    blockingWarnings.push("Provided father/husband context did not match the RoR guardian field.");
    reasons.push({
      code: "father_husband_mismatch",
      label: "Provided father/husband context did not match the RoR guardian field.",
      weight: -0.25,
    });
  }

  let claimState: OwnerClaimValidation["claimState"] = "manual_required";
  let readiness: OwnerClaimValidation["readiness"] = "L1";
  let confidence = bestMatch?.confidence ?? 0;

  if (!bestMatch || bestMatch.nameMatch === "unknown") {
    claimState = "manual_required";
    readiness = "L1";
  } else if (inputQuality === "single_token" && bestMatch.matches) {
    claimState = "ambiguous";
    readiness = "L2";
    confidence = Math.min(confidence, 0.55);
  } else if (bestMatch.nameMatch === "exact" && bestMatch.matches) {
    claimState = "matched";
    readiness = fatherHusbandMatch === "matched" ? "L3" : "L2";
  } else if (bestMatch.nameMatch === "partial" && bestMatch.matches) {
    claimState = "partial";
    readiness = "L2";
    confidence = Math.min(confidence, 0.7);
  } else if (bestMatch.nameMatch === "mismatch") {
    claimState = "mismatch";
    readiness = "L2";
  }

  return {
    claimState,
    readiness,
    inputQuality,
    matchedTenantIndex: matchedIdx,
    officialOwnerName: offOdia,
    transliteratedOwnerName: transliterated,
    fatherHusbandMatch,
    confidence,
    reasons,
    blockingWarnings,
  };
}

function ownerMatchMethodLabel(method: string): string {
  if (method === "exact_transliteration") return "Full transliterated name matched exactly.";
  if (method === "dice_full_name") return "Full-name similarity matched after transliteration.";
  if (method === "odia_surname_map") return "Surname appears in the Odia RoR name.";
  if (method === "surname_dice") return "Surname similarity matched after transliteration.";
  if (method === "surname_cluster") return "Surname variant cluster matched.";
  if (method === "father_name_match") return "Guardian/father name appears in the available text.";
  if (method === "given_name_dice") return "Given name and surname partially matched.";
  return "No reliable automated owner-name match.";
}

function buildExplanation(m: MatchResult | null, claimed: string, trans: string, coCount: number, validation: OwnerClaimValidation): string {
  const coNote = coCount > 0 ? ` ${coCount} other co-owner(s) must consent to any sale.` : "";
  if (!m) return "No name matching possible. Manual verification required.";
  if (validation.claimState === "ambiguous") {
    return `The provided name "${claimed}" is only a surname or single word. Bhulekh contains a similar recorded owner name "${trans}", but this is not enough to confirm the seller's identity.${coNote} Ask for the seller's full legal name, photo ID, and title-chain documents.`;
  }
  switch (m.nameMatch) {
    case "exact": return `Bhulekh RoR shows a recorded owner name that matches the seller-provided full name "${claimed}" as "${trans}".${coNote} This is a name match only, not title certification.`;
    case "partial":
      if (m.method === "father_name_match") return `Seller name not in Bhulekh, but father's name present — may be a descendant. Lawyer should verify title chain.${coNote}`;
      return `Seller-claimed "${claimed}" partially matches Bhulekh "${trans}". Possible spelling variant or unregistered mutation.${coNote} Ask seller for original title docs going back 30 years.`;
    case "mismatch": return `Seller-claimed "${claimed}" not in Bhulekh record (shows "${trans}"). Significant discrepancy — do not proceed without property lawyer review.${coNote}`;
    default: return "Bhulekh record could not be compared. Manual verification required.";
  }
}

function buildBasis(m: MatchResult | null, count: number, validation?: OwnerClaimValidation): string {
  if (!m) return "No tenants to compare.";
  const note = count > 1 ? ` Among ${count} tenants, best match selected.` : "";
  const state = validation ? ` Claim state: ${validation.claimState}; readiness: ${validation.readiness}.` : "";
  const warnings = validation?.blockingWarnings.length
    ? ` Warning: ${validation.blockingWarnings.join(" ")}`
    : "";
  return `${m.method} matching, confidence ${((validation?.confidence ?? m.confidence)*100).toFixed(0)}%.${note}${state}${warnings}`;
}
