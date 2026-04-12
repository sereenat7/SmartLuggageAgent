/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Pickup latitude
 * @param {number} lon1 - Pickup longitude
 * @param {number} lat2 - Drop latitude
 * @param {number} lon2 - Drop longitude
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  return distance;
}

/**
 * Calculate price based on weight, bags, and distance
 * @param {number} bagCount - Number of bags
 * @param {string} weight - Weight in format "10-20 kg" or "10 kg"
 * @param {number} distance - Distance in kilometers
 * @returns {number} Total price in rupees
 */
export function calculatePrice(bagCount, weight, distance) {
  // FOR TESTING: Return ₹1
  return 1;

  // Uncomment below for production pricing
  /*
  // Base price
  const basePrice = 100;

  // Weight pricing: Extract numeric weight and calculate per kg charge
  let weightInKg = 0;
  if (weight) {
    // Handle formats like "10-20 kg", "10 kg", "10.5 kg"
    const weightMatch = weight.match(/(\d+(?:\.\d+)?)/);
    if (weightMatch) {
      weightInKg = parseFloat(weightMatch[1]);
    }
  }

  // Pricing per kg: ₹20 per kg
  const weightCharge = Math.max(10, weightInKg * 20);

  // Bag pricing: ₹50 per bag
  const bagCharge = Math.max(1, bagCount) * 50;

  // Distance pricing: ₹5 per km (minimum ₹50)
  const distanceCharge = Math.max(50, distance * 5);

  // Total price
  const totalPrice = basePrice + weightCharge + bagCharge + distanceCharge;

  // Round to nearest rupee
  return Math.round(totalPrice);
  */
}

export { calculateDistance };
