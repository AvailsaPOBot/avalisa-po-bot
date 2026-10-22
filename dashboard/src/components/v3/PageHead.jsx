// Shared editorial pieces for the secondary pages (/pricing, /register, /guide), built on the
// homepage v3 tokens in styles/landing-v3.css. Nothing here animates in: first-screen text is
// static on purpose (Board rule), and the leader line renders drawn.

export function PageLabel({ index, total, children }) {
  return (
    <div className="v3-label v3p-label">
      <span>{index} / {total}</span><i className="v3-leader" aria-hidden="true" /><span>{children}</span>
    </div>
  );
}

export default function PageHead({ id, eyebrow, title, sub, numeral, aside, children, className = '' }) {
  return (
    <section className={`v3p-head ${className}`} aria-labelledby={id}>
      <div className="v3p-head__bg" aria-hidden="true"><div className="v3-grain" /></div>
      {numeral && <span className="v3-num v3-num--right v3p-head__num" aria-hidden="true">{numeral}</span>}
      <div className="v3-wrap v3p-head__grid">
        <div className="v3p-head__copy">
          <p className="v3-hud v3p-eyebrow"><i className="v3-dot" aria-hidden="true" />{eyebrow}</p>
          <h1 className="v3p-h1" id={id}>{title}</h1>
          {sub && <p className="v3p-sub">{sub}</p>}
          {children}
        </div>
        {aside && <div className="v3p-head__aside">{aside}</div>}
      </div>
    </section>
  );
}
