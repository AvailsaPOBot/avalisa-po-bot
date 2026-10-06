const { PLAN_IDS, getPlanEntitlements } = require('./plans');
const { notifyUserOfClaimOutcome } = require('./claimNotify');

// A queued free-Pro claim is approved as soon as PocketPartners confirms the same PO UID
// registered through our link. Before 2026-10-06 a claim submitted BEFORE the postback
// arrived stayed pending until an admin approved it by hand: the postback only looked up
// `user.poUserId`, which a pending claim never sets (it stores `license.claimedPoUid`).
// Same rule the claim route already applies when the referral row exists first.
async function approvePendingClaimForUid(prisma, uid) {
  const poUid = String(uid || '').trim();
  if (!poUid) return null;

  const license = await prisma.license.findFirst({
    where: { claimedPoUid: poUid, claimStatus: 'pending' },
  });
  if (!license) return null;

  // One PO UID belongs to exactly one account. If another account already holds it,
  // leave the claim for an admin instead of guessing.
  const holder = await prisma.user.findUnique({ where: { poUserId: poUid } });
  if (holder && holder.id !== license.userId) return null;

  await prisma.$transaction([
    prisma.license.update({
      where: { userId: license.userId },
      data: {
        claimStatus: 'approved',
        plan: PLAN_IDS.PRO,
        tradesLimit: getPlanEntitlements(PLAN_IDS.PRO).tradesLimit,
        claimNote: null,
      },
    }),
    prisma.user.update({
      where: { id: license.userId },
      data: { poUserId: poUid },
    }),
  ]);

  notifyUserOfClaimOutcome(prisma, { userId: license.userId, poUid, outcome: 'approved' });
  console.log(`[affiliateClaim] Pending claim auto-approved for userId=${license.userId} poUid=${poUid}`);
  return license.userId;
}

// Approve every pending claim whose PO UID PocketPartners has already confirmed.
// Run once at startup so claims stuck before this fix heal on the next deploy.
async function sweepPendingAffiliateClaims(prisma) {
  const pending = await prisma.license.findMany({
    where: { claimStatus: 'pending', NOT: { claimedPoUid: null } },
    select: { claimedPoUid: true },
  });
  const approved = [];
  for (const { claimedPoUid } of pending) {
    const referral = await prisma.affiliateReferral.findUnique({ where: { poUid: claimedPoUid } });
    if (!referral) continue;
    const userId = await approvePendingClaimForUid(prisma, claimedPoUid);
    if (userId) approved.push(userId);
  }
  return { checked: pending.length, approved: approved.length };
}

module.exports = { approvePendingClaimForUid, sweepPendingAffiliateClaims };
