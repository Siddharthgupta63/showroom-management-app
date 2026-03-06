export const STATES_UTS = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi",
  "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
];

// Keep this small now (MP districts you mainly use)
export const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Madhya Pradesh": [
    "Umaria","Katni","Shahdol","Anuppur","Satna","Jabalpur","Rewa","Sidhi","Singrauli","Dindori",
    "Bhopal","Indore","Ujjain","Sagar","Chhindwara","Seoni","Narsinghpur","Damoh","Panna","Tikamgarh",
    "Gwalior","Morena","Bhind","Dewas","Ratlam","Neemuch","Mandsaur","Khandwa","Khargone","Betul"
  ],
};

// Tehsils (depend on district) – based on district NIC sources
export const TEHSILS_BY_DISTRICT: Record<string, string[]> = {
  "Umaria": ["Bandhavgarh","Manpur","Pali","Chandia","Nowrozabad","Karkeli","Bilaspur"],
  "Katni": ["Katni Nagar","Katni","Rithi","Badwara","Bahoriband","Sleemnabad","Vijayraghavgarh","Barhi","Dheemarkheda"],
  "Shahdol": ["Beohari","Jaisinghnagar","Sohagpur","Gohapru","Burhar","Jaitpur"],
};
