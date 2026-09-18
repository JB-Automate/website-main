import consentSource from "../scripts/advertising-consent.js?raw";
import { siteConfig } from "./site-config";
export { default as googleTagScript } from "../scripts/google-tag.js?raw";
export const consentScript = `(function(){const adsId = ${JSON.stringify(siteConfig.ads.id)};const conversionLabel = ${JSON.stringify(siteConfig.ads.conversionLabel)};${consentSource}})();`;
