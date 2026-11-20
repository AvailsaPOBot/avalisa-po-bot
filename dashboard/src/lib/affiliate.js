// PocketPartners supplies ac, cid, and al as revenue-attribution parameters.
// Changing them outside its dashboard silently breaks tracking.
export const AFFILIATE_LINK = 'https://u3.shortink.io/register?utm_campaign=36377&utm_source=affiliate&utm_medium=sr&a=h00sp8e1L95KmS&al=1272290&ac=april2024&cid=845788&code=WELCOME50&sub_id1=site';

// Channel tags PocketPartners reads back through postback 8206 (sub_id1). Pages that clips or
// the extension send people to (e.g. /free-pro?src=yt) pass the tag on so the per-channel split
// still works when the visitor goes through our site first. Anything else stays "site".
const CHANNEL_TAGS = ['yt', 'fb', 'tt', 'ext', 'ig', 'email'];
export function affiliateLinkFor(src) {
  const tag = CHANNEL_TAGS.includes(String(src || '').toLowerCase()) ? String(src).toLowerCase() : 'site';
  return AFFILIATE_LINK.replace(/sub_id1=[^&]*/, `sub_id1=${tag}`);
}
