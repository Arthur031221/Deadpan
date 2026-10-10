// Photo rules. Every number below is copied from the page named in `source`,
// read on `checked`. Rules that are not in this list are not claimed.
export const CHECKED = "2026-10-10";

const ICAO_NOTE =
  "The 32 to 36 mm head height is the ICAO 70 to 80 percent of a 45 mm photo, as stated on the BOCA page.";

export const SPECS = [
  {
    id: "us",
    name: "United States passport",
    photo: { w: 50.8, h: 50.8 },
    head: { min: 25, max: 35 },
    source: {
      label: "travel.state.gov, U.S. Passport Photos",
      url: "https://travel.state.gov/content/travel/en/passports/how-apply/photos.html",
    },
    notes: [
      "2 x 2 inches. Head from the bottom of the chin to the top of the head, 1 to 1 3/8 inches.",
      "A closed mouth smile is allowed. Deadpan asks for a neutral face because every preset accepts it.",
      "The State Department does not accept edited or filtered photos, so Deadpan never edits the picture.",
    ],
  },
  {
    id: "us-visa",
    name: "United States visa or green card lottery (digital)",
    photo: { w: 50.8, h: 50.8 },
    head: { min: 25.4, max: 35 },
    digital: { minPx: 600, maxPx: 1200, maxKB: 240 },
    source: {
      label: "travel.state.gov, Digital Image Requirements",
      url: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html",
    },
    notes: [
      "Square JPEG, 600 to 1200 pixels on a side, at most 240 KB.",
      "Head height is 50 to 69 percent of the image height, which is 25.4 to 35 mm on a 2 inch photo.",
    ],
  },
  {
    id: "tw",
    name: "Taiwan passport",
    photo: { w: 35, h: 45 },
    head: { min: 32, max: 36 },
    source: {
      label: "BOCA, Passport Photos",
      url: "https://www.boca.gov.tw/np-140-2.html",
    },
    notes: [
      "35 x 45 mm. Head from chin to crown 32 to 36 mm, evenly centered. Neutral expression with the mouth closed.",
      "Plain white background. Resampling the image before printing is not permitted.",
    ],
  },
  {
    id: "schengen",
    name: "Schengen visa",
    photo: { w: 35, h: 45 },
    head: { min: 32, max: 36 },
    source: {
      label: "Czech Ministry of Foreign Affairs, Visa Code Article 13",
      url: "https://mzv.gov.cz/jnp/en/information_for_aliens/supporting_documents_overview/photo.html",
    },
    notes: [
      "35 x 45 mm. The ministry also asks for at least 13 mm from the eyes to the bottom of the chin.",
      "The ministry page gives no head height. The 32 to 36 mm range is the ICAO figure. " + ICAO_NOTE,
      "Embassies differ, so check the one you apply to.",
    ],
  },
];

export const CUSTOM_ID = "custom";

export function customSpec({ w, h, min, max }) {
  return {
    id: CUSTOM_ID,
    name: "Your own size",
    photo: { w, h },
    head: { min, max },
    source: null,
    notes: ["Numbers you typed in. Deadpan cannot vouch for them."],
  };
}

export function findSpec(id) {
  return SPECS.find((s) => s.id === id) ?? SPECS[0];
}
