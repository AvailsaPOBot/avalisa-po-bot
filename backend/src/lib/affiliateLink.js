// Single source of truth. PocketPartners supplies ac, cid, and al campaign
// parameters; changing them without its dashboard breaks revenue tracking silently.
const AFFILIATE_LINK = 'https://u3.shortink.io/register?utm_campaign=36377&utm_source=affiliate&utm_medium=sr&a=h00sp8e1L95KmS&al=1272290&ac=april2024&cid=845788&code=WELCOME50';

// Channel tag for PocketPartners attribution: sub_id1 comes back on the registration postback
// (postback 8206 sends sub_id1 since 2026-11-19), so each channel's sign-ups can be told apart.
// PocketPartners requires extra params strictly at the END of the link, after everything else.
function withSubId(url, channel) {
  if (!url || /[?&]sub_id1=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}sub_id1=${encodeURIComponent(channel)}`;
}

module.exports = { AFFILIATE_LINK, withSubId };

// HOW A CAMPAIGN SWAP REACHES USERS - the split below is deliberate, not accidental.
//
//   EXTENSION  fetches GET /api/config/affiliate-link at runtime (content.js), falling back to
//              its bundled constant. So changing THIS file reaches all installed extensions
//              LIVE - no Web Store release, no review wait. That matters: a store release takes
//              days, and the installed base is the population that earns.
//   DASHBOARD  uses a version-controlled constant (dashboard/src/lib/affiliate.js), the same
//              pattern as checkout.js. It redeploys in about a minute on push, and this project
//              has already paid two months of dead checkout for the alternative: a runtime value
//              silently disagreeing with the code someone read.
//
// So a swap is: edit this file (extensions update themselves) + edit the dashboard constant
// + push. Three files, one per independently-built artifact, all in git and all reviewable.
