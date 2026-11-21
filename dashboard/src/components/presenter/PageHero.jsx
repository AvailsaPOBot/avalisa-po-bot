// Page header used on every page except the homepage: title and lede on the left, Avalisa on the
// right. `pose` picks one of the on-model images in public/assets/presenter (see MASCOT below).

export const MASCOT = {
  standing: { src: '/assets/presenter/avalisa-standing.webp', w: 705, h: 1700 },
  turn: { src: '/assets/presenter/avalisa-turn.webp', w: 738, h: 1362 },
  glance: { src: '/assets/presenter/avalisa-glance.webp', w: 738, h: 1362 },
  front: { src: '/assets/presenter/girl-f0.webp', w: 738, h: 1362 },
  portrait: { src: '/assets/presenter/avalisa-portrait.webp', w: 893, h: 1000 },
};

/** Small round Avalisa for cards, empty states and headers. */
export function MascotAvatar({ size = 56, className = '' }) {
  return (
    <span className={`pz-avatar ${className}`.trim()} style={{ '--s': `${size}px` }} aria-hidden="true">
      <img src={MASCOT.portrait.src} alt="" width={MASCOT.portrait.w} height={MASCOT.portrait.h} loading="lazy" decoding="async" />
    </span>
  );
}

export default function PageHero({ title, lede, pose = 'front', compact = false, titleId, as: Heading = 'h1', children }) {
  const image = MASCOT[pose] || MASCOT.front;
  return (
    <header className={`pz pz-pagehero${compact ? ' pz-pagehero--compact' : ''}`}>
      <div className="pz-wrap pz-pagehero__in">
        <div className="pz-pagehero__copy">
          <Heading className="pz-display pz-pagehero__title" id={titleId}>{title}</Heading>
          {lede && <p className="pz-lede">{lede}</p>}
          {children && <div className="pz-pagehero__actions">{children}</div>}
        </div>
        <div className="pz-pagehero__art" aria-hidden="true">
          <img src={image.src} alt="" width={image.w} height={image.h} decoding="async" />
        </div>
      </div>
    </header>
  );
}
