/** ערים נפוצות — קואורדינטות מרכז (תכנון מסלול יום) */
export const DRIVER_START_CITIES = [
  { id: "beitar", label: "ביתר עילית", lat: 31.697, lng: 35.105 },
  { id: "bnei-brak", label: "בני ברק", lat: 32.087, lng: 34.832 },
  { id: "jerusalem", label: "ירושלים", lat: 31.768, lng: 35.214 },
  { id: "tel-aviv", label: "תל אביב", lat: 32.085, lng: 34.781 },
  { id: "modiin-illit", label: "מודיעין עילית", lat: 31.932, lng: 35.038 },
  { id: "elad", label: "אלעד", lat: 32.052, lng: 34.952 },
  { id: "beit-shemesh", label: "בית שמש", lat: 31.747, lng: 34.988 },
  { id: "ashdod", label: "אשדוד", lat: 31.804, lng: 34.655 },
  { id: "ashkelon", label: "אשקלון", lat: 31.669, lng: 34.574 },
  { id: "haifa", label: "חיפה", lat: 32.794, lng: 34.989 },
  { id: "beer-sheva", label: "באר שבע", lat: 31.252, lng: 34.791 },
  { id: "petah-tikva", label: "פתח תקווה", lat: 32.084, lng: 34.887 },
  { id: "ramat-gan", label: "רמת גן", lat: 32.068, lng: 34.824 },
  { id: "netanya", label: "נתניה", lat: 32.321, lng: 34.853 },
  { id: "modiin", label: "מודיעין", lat: 31.898, lng: 35.01 },
];

export const buildClaimStartPayload = (startCityId) => {
  const city = DRIVER_START_CITIES.find((c) => c.id === startCityId);
  if (city) return { startLat: city.lat, startLng: city.lng };
  return null;
};

export const getDriverStartLabel = (startCityId) =>
  DRIVER_START_CITIES.find((c) => c.id === startCityId)?.label || null;
