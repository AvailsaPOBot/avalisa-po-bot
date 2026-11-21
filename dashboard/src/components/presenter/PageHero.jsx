// Page header used on every page except the homepage: title and lede on the left, Avalisa on the
// right. `pose` picks one of the scene photos in public/assets/presenter (see MASCOT below).

// Scene photos generated from the Board's character sheet (champagne knot dress, no smile).
// `pos` is the object-position that keeps her face inside a wide, short header band.
const SCENES = {
  card: { src: '/assets/presenter/scene-card.webp', w: 1120, h: 1500, pos: '50% 17%' },
  phone: { src: '/assets/presenter/scene-phone.webp', w: 1120, h: 1500, pos: '50% 13%' },
  laptop: { src: '/assets/presenter/scene-laptop.webp', w: 1120, h: 1500, pos: '62% 12%' },
  desk: { src: '/assets/presenter/scene-desk.webp', w: 1500, h: 837, pos: '62% 18%' },
  corridor: { src: '/assets/presenter/scene-corridor.webp', w: 1500, h: 837, pos: '50% 42%' },
  face: { src: '/assets/presenter/avalisa-face.webp', w: 420, h: 420, pos: '50% 50%' },
};
export const MASCOT = { ...SCENES, glance: SCENES.desk, standing: SCENES.corridor, turn: SCENES.laptop, front: SCENES.card, portrait: SCENES.face };

/** Small round Avalisa for cards, empty states and headers. */
export function MascotAvatar({ size = 56, className = '' }) {
  return (
    <span className={`pz-avatar ${className}`.trim()} style={{ '--s': `${size}px` }} aria-hidden="true">
      <img src={MASCOT.face.src} alt="" width={MASCOT.face.w} height={MASCOT.face.h} loading="lazy" decoding="async" />
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
          <img src={image.src} alt="" width={image.w} height={image.h} decoding="async" style={{ objectPosition: image.pos }} />
        </div>
      </div>
    </header>
  );
}
