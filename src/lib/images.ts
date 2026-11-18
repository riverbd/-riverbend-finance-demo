/**
 * Homepage imagery.
 *
 * These are photographic placeholders chosen to suit the About copy already in
 * the CMS (a family-led group with a European head office and a global
 * footprint). They carry no company history, figures or claims of their own —
 * every statement on the page comes from `content.about`.
 *
 * They are imported rather than referenced by URL so Vite fingerprints and
 * inlines them at build time; the production build is a single self-contained
 * index.html with no external asset requests.
 *
 * To swap in real photography, replace the .jpg files in this folder. Nothing
 * else needs to change.
 */

import bankExterior from "./assets/bank-exterior.jpg";
import familyAdvisor from "./assets/family-advisor.jpg";
import adviceDetail from "./assets/advice-detail.jpg";
import citySkyline from "./assets/city-skyline.jpg";

export const homeImages = {
  /** Head-office facade — used for the story section. */
  bank: bankExterior,
  /** Advisor meeting a couple — used for the "family first" section. */
  advisor: familyAdvisor,
  /** Close-up of a consultation — secondary detail image. */
  advice: adviceDetail,
  /** Aerial cityscape — used behind the footprint figures. */
  city: citySkyline,
};
