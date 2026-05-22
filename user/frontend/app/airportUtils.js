import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

// 📥 Read asset
const readAsset = async (module) => {
  try {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    return await FileSystem.readAsStringAsync(asset.localUri);
  } catch (err) {
    console.error("Asset Read Error:", err);
    return "";
  }
};

// ✅ CSV safe split
const splitCSVLine = (line) => {
  return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
};

// 🇮🇳 Indian Airlines List
const INDIAN_AIRLINES = [
  "IndiGo",
  "Air India",
  "Vistara",
  "Air India Express",
  "SpiceJet",
  "Akasa Air",
  "Alliance Air",
  "Star Air"
];

// 🏙 Indian Airports
export const loadIndianAirports = async () => {
  try {
    const data = await readAsset(require('../assets/data/indian_airports.csv'));
    if (!data) return [];

    const lines = data.split(/\r?\n/).filter(l => l.trim() !== "");

    return lines.slice(1).map(line => {
      const parts = splitCSVLine(line);

      return {
        iata: parts[0]?.replace(/["']/g, '').trim() || '',
        name: parts[1]?.replace(/["']/g, '').trim() || 'Unknown Airport',
        city: parts[2]?.replace(/["']/g, '').trim() || 'Unknown City',
        country: 'India',
        isDomestic: true
      };
    })
    .filter(a => a.name !== 'Unknown Airport'); // keep valid
  } catch (e) {
    console.log("Indian Airport Error:", e);
    return [];
  }
};

// 🌍 Global Airports
export const loadGlobalAirports = async () => {
  try {
    const data = await readAsset(require('../assets/data/global_airports.dat'));
    if (!data) return [];

    const lines = data.split(/\r?\n/).filter(l => l.trim() !== "");

    return lines.map(line => {
      const parts = splitCSVLine(line);

      const iata = parts[4]?.replace(/["']/g, '').trim();

      return {
        iata: (iata && iata !== '\\N') ? iata : '',
        name: parts[1]?.replace(/["']/g, '').trim() || 'Unknown Airport',
        city: parts[2]?.replace(/["']/g, '').trim() || 'Unknown City',
        country: parts[3]?.replace(/["']/g, '').trim() || '',
        isDomestic: false
      };
    })
    .filter(a => a.name !== 'Unknown Airport');
  } catch (e) {
    console.log("Global Airport Error:", e);
    return [];
  }
};

// ✈️ Airlines (Indian first, global searchable)
export const loadGlobalAirlines = async () => {
  try {
    const data = await readAsset(require('../assets/data/global_airlines.dat'));
    if (!data) return [];

    const lines = data.split(/\r?\n/).filter(l => l.trim() !== "");

    const airlines = lines.map(line => {
      const parts = splitCSVLine(line);
      const name = parts[1]?.replace(/["']/g, '').trim();

      if (!name || name === 'Name' || name === '\\N') return null;

      const isIndian = INDIAN_AIRLINES.some(ind =>
        name.toLowerCase().includes(ind.toLowerCase())
      );

      return { name, isIndian };
    }).filter(Boolean);

    // 🔥 Indian airlines first
    const indian = airlines.filter(a => a.isIndian);
    const global = airlines.filter(a => !a.isIndian);

    return [...indian, ...global]; // order matters
  } catch (e) {
    console.log("Airline Error:", e);
    return [];
  }
};

export default function UtilitySetup() { return null; }