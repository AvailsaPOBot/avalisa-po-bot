import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, Shield, Smartphone, SlidersHorizontal } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { AFFILIATE_LINK } from '../lib/affiliate';
import '../styles/home.css';

const AFFILIATE_PROMO_CODE = 'WELCOME50';
const heroHighlights = [
  { title: 'Start free Demo', text: 'Use 10 free Martingale trades on a practice balance.' },
];
const deviceLinks = [];
const steps = [
  ['Open Pocket Option', 'Use the Chrome extension on desktop, or open the phone setup in your mobile browser.'],
  ['Set your controls', 'Choose a stake, a Martingale step cap, and the minimum payout filter.'],
  ['Start on Demo', 'Try the 10 free Martingale trades on a practice balance. Stop the bot whenever you choose.'],
];

function ProductIllustration({ gsap }) {
  const [mode, setMode] = useState('Martingale');
  const [paused, setPaused] = useState(false);
  const [beat, setBeat] = useState(0);
  const [tradesLeft, setTradesLeft] = useState(10);
  const stageRef = useRef(null);
  useEffect(() => {
    if (!gsap || mode !== 'Martingale' || !stageRef.current) return undefined;
    let visible = false;
    let timeline;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !paused) timeline?.play(); else timeline?.pause();
    }, { threshold: 0.12 });
    observer.observe(stageRef.current);
    timeline = gsap.timeline({ repeat: -1, paused: true });
    timeline.call(() => setBeat(0), [], 0).call(() => setBeat(1), [], 2).call(() => setBeat(2), [], 4).call(() => { setBeat(3); setTradesLeft(9); }, [], 6).call(() => setTradesLeft(10), [], 8);
    return () => { observer.disconnect(); timeline.kill(); };
  }, [gsap, mode, paused]);
  useEffect(() => {
    if (!gsap || !stageRef.current) return;
    const marker = stageRef.current.querySelector('.buy-marker');
    if (beat === 1 && mode === 'Martingale') gsap.fromTo(marker, { scale: .6, autoAlpha: 0 }, { scale: 1.2, autoAlpha: 1, duration: .32, yoyo: true, repeat: 3, transformOrigin: 'center' });
    else gsap.to(marker, { autoAlpha: 0, duration: .2 });
  }, [gsap, beat, mode]);
  return <div className="home-stage" aria-label="Illustration of the Avalisa controls beside a chart">
    <div className="hero-motion-surface" ref={stageRef}>
    <div className="home-chart" aria-hidden="true">
      <div className="chart-top"><span>POCKET OPTION</span><span>EUR / USD <b>DEMO</b></span></div>
      <div className="chart-lines"><svg viewBox="0 0 600 300" role="img" aria-label="Illustrative chart">
        <path d="M0 240H600M0 180H600M0 120H600M0 60H600" />
        <polyline points="0,215 48,204 82,220 124,166 166,181 208,132 250,155 294,104 333,124 379,82 420,102 461,56 505,80 548,42 600,51" />
        {[['45',208,40],['92',169,52],['145',180,44],['196',136,50],['250',147,48],['303',105,52],['356',115,43],['408',83,48],['463',68,43],['519',48,55]].map(([x,y,h],i)=><rect key={x} x={x} y={y} width="12" height={h} className={i%2?'candle-up':'candle-down'}/>) }
        <g className="buy-marker" opacity="0"><circle cx="410" cy="82" r="23"/><text x="410" y="87" textAnchor="middle">BUY</text></g>
      </svg></div>
      <div className="chart-foot"><span>Chart illustration</span><span>Practice balance · $10,000</span></div>
    </div>
    <div className="product-panel">
      <div className="panel-head"><span className="brand-dot"/> AVALISA BOT <span className="demo-pill">DEMO · 10</span></div>
      <div className="mode-switch" role="group" aria-label="Illustration mode">
        <button className={mode==='Martingale'?'selected':''} onClick={()=>{setMode('Martingale');setBeat(0);setTradesLeft(10);}}>Martingale</button>
        <button className={mode==='Avalisa Bot'?'selected':''} onClick={()=>{setMode('Avalisa Bot');setBeat(0);setTradesLeft(10);setPaused(false);}}>Avalisa Bot <small>Pro</small></button>
      </div>
      <div className="panel-setting"><span>Start Amount</span><b>$10.00</b></div>
      <div className="panel-setting"><span>{mode==='Martingale'?'Recovery Steps':'Signal Rules'}</span><b>{mode==='Martingale'?'3 · capped':'4 of 4 · Pro'}</b></div>
      <div className={`panel-setting payout-scan ${beat===0&&mode==='Martingale'?'is-highlighted':''}`}><span>EUR/USD OTC · 92% payout</span><b>Passes 80% floor</b></div>
      <div className="panel-status"><i/> {paused?'Paused by you':mode==='Martingale'&&beat>=2?'Trade placed · Step 0 / 3 max':'Ready on Demo'}</div>
      <div className="panel-demo-count">Demo trades left <b>{tradesLeft} / 10</b></div>
      <button className="panel-pause" onClick={()=>setPaused(!paused)} aria-pressed={paused} disabled={mode!=='Martingale'} aria-label={paused?'Play demo loop':'Pause demo loop'}>{mode!=='Martingale'?'Demo loop · Martingale only':paused?'▶ Play Demo':'Ⅱ Pause Demo'}</button>
      <span className="illustration-label">Illustration · not a live trading screen</span>
    </div>
    <div className="phone-card"><div className="phone-camera"/><b>Phone browser</b><span>Avalisa webapp</span><div className="phone-pill">● Ready · Demo</div><small>Illustration</small></div>
    <img className="home-mascot" src="/images/landing/generated/avalisa-girl-cutout.png" alt="Avalisa mascot" width="1024" height="1536" loading="lazy" fetchPriority="low" />
    </div>
  </div>;
}

function SectionHeading({ eyebrow, title, children }) { return <div className="home-heading"><span className="home-eyebrow">{eyebrow}</span><h2>{title}</h2>{children&&<p>{children}</p>}</div>; }

export default function Landing() {
  const { user } = useAuth();
  const [showSticky, setShowSticky] = useState(false);
  const [stepCap, setStepCap] = useState(3);
  const [startAmount, setStartAmount] = useState(10);
  const [minimumPayout, setMinimumPayout] = useState(80);
  const [sandboxStopped, setSandboxStopped] = useState(false);
  const [motionGsap, setMotionGsap] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const homeRef = useRef(null);
  const totalExposureRef = useRef(null);
  const barRefs = useRef([]);
  const amountRefs = useRef([]);
  const cycleExposure = startAmount * (2 ** (stepCap + 1) - 1);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false, addEventListener() {}, removeEventListener() {} };
    if (preference.matches) return undefined;
    let idleId; let timeoutId; let cancelled = false;
    const load = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (cancelled || preference.matches) return;
      gsap.registerPlugin(ScrollTrigger);
      setMotionGsap(gsap);
    };
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(load, { timeout: 1800 });
    else timeoutId = window.setTimeout(load, 250);
    const onPreferenceChange = (event) => { if (event.matches) { cancelled = true; setMotionGsap(null); } };
    preference.addEventListener?.('change', onPreferenceChange);
    return () => { cancelled = true; if (idleId) window.cancelIdleCallback(idleId); if (timeoutId) window.clearTimeout(timeoutId); preference.removeEventListener?.('change', onPreferenceChange); };
  }, []);
  useEffect(() => {
    if (!motionGsap || !homeRef.current) return undefined;
    const gsap = motionGsap;
    const context = gsap.context(() => {
      // No hero-copy entrance: GSAP loads after first paint, so hiding already-painted text would make it
      // flicker, and if animation frames are throttled the CTAs would stay invisible (CEO QC 2026-10-22).
      gsap.fromTo('.home-chart', { rotateX: 8, scale: .96, transformPerspective: 1200 }, { rotateX: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.home-hero', start: 'top top', end: '+=280', scrub: .5 } });
      gsap.utils.toArray('.content-section:not(.how-section)').forEach((section) => gsap.from(section, { y: 16, autoAlpha: 0, duration: .65, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top 86%', once: true } }));
      if (window.matchMedia('(min-width: 1024px)').matches) {
        const stage = document.querySelector('.how-illustration');
        const cards = gsap.utils.toArray('.how-step-card');
        if (!stage || !document.querySelector('.how-scrolly')) return;
        gsap.fromTo('.how-window', { y: 22, scale: .96, autoAlpha: .75 }, { y: 0, scale: 1, autoAlpha: 1, scrollTrigger: {
          trigger: '.how-scrolly', start: 'top 16%', end: '+=180%', scrub: .5,
          onUpdate: () => {
            const stepIndex = cards.findIndex((card) => card.getBoundingClientRect().top + card.offsetHeight / 2 >= window.innerHeight * .45);
            setActiveStep(stepIndex < 0 ? 2 : stepIndex);
          },
        } });
        gsap.plugins.ScrollTrigger?.refresh();
      }
    }, homeRef);
    return () => context.revert();
  }, [motionGsap]);
  useEffect(() => {
    if (!motionGsap || !totalExposureRef.current) return;
    const node = totalExposureRef.current;
    const target = cycleExposure;
    const counter = { value: Number(node.dataset.value || target) };
    motionGsap.to(counter, { value: target, duration: .28, ease: 'power2.out', onUpdate: () => { node.textContent = `Maximum cycle exposure: $${Math.round(counter.value)} · ${Math.round(counter.value / startAmount)}× base stake`; } });
    node.dataset.value = String(target);
    barRefs.current.forEach((bar) => {
      if (!bar) return;
      const width = Number(bar.dataset.width || 0);
      motionGsap.fromTo(bar, { scaleX: Number(bar.dataset.prev || 0) / 100 }, { scaleX: width / 100, duration: .28, ease: 'power2.out', transformOrigin: 'left center' });
      bar.dataset.prev = String(width);
    });
    amountRefs.current.forEach((node, index) => {
      if (!node) return;
      const value = startAmount * 2 ** index;
      const counter = { value: Number(node.dataset.value || value) };
      motionGsap.to(counter, { value, duration: .28, ease: 'power2.out', onUpdate: () => { node.textContent = `$${Math.round(counter.value)}`; } });
      node.dataset.value = String(value);
    });
  }, [motionGsap, cycleExposure, stepCap, startAmount]);
  useEffect(()=>{
    const onScroll=()=>setShowSticky(window.scrollY>360);
    onScroll(); window.addEventListener('scroll',onScroll,{passive:true});
    return ()=>window.removeEventListener('scroll',onScroll);
  },[]);
  return <div className="home-page" ref={homeRef}>
    <Navbar />
    <main>
      <section className="home-hero" id="top">
        <div className="home-hero-copy">
          <span className="home-eyebrow">DESKTOP CHROME · PHONE BROWSER</span>
          <h1>Automate Pocket Option trades with rules you control.</h1>
          <p>Avalisa runs inside your own Pocket Option tab. Set your stake, Martingale step cap, and minimum payout floor, then try 10 trades on Demo.</p>
          <div className="home-actions"><Link className="home-button" to={user?'/dashboard':'/register'}>Start 10 Free Demo Trades <ArrowRight size={18}/></Link><a className="home-secondary" href="#how-it-works">See how it works <ArrowDown size={16}/></a></div>
          <ul className="home-trust"><li><Check/>10 Demo trades</li><li><Check/>No card required</li><li><Check/>No Pocket Option password asked</li></ul>
          <p className="risk-note">Trading involves risk. Start on a demo account.</p>
        </div>
        <ProductIllustration gsap={motionGsap} />
      </section>

      <section className="home-section how-section content-section" id="how-it-works">
        <SectionHeading eyebrow="HOW IT WORKS" title="Three steps to your first Demo session.">Open it where you trade, set your limits, and keep control of the session.</SectionHeading>
        <div className="how-scrolly"><div className="how-step-list">{steps.map(([title,copy],i)=><article className={`home-card how-step-card ${activeStep===i?'is-active':''}`} key={title}><span className="step-number">0{i+1}</span><div className="step-visual" aria-hidden="true">{i===0?<Smartphone/>:i===1?<SlidersHorizontal/>:<Check/>}</div><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="how-illustration" aria-label={`Illustration for step ${activeStep+1}`}><div className="how-window"><div className="how-window-head"><i/> Pocket Option · Demo <span>AVALISA</span></div><div className="how-mini-chart"><svg viewBox="0 0 320 120" aria-hidden="true"><path d="M8 90 50 68 85 79 125 46 160 58 205 30 242 44 300 15"/></svg></div><div className="how-control-row"><span>{activeStep===0?'Browser session':activeStep===1?'Martingale steps':'Demo trade'}</span><b>{activeStep===0?'Connected':activeStep===1?'3 · capped':'Start · Demo'}</b></div><div className="how-progress">{steps.map((_,i)=><i className={i<=activeStep?'active':''} key={i}/>)}</div></div><span className="how-step-caption">STEP 0{activeStep+1} · {steps[activeStep][0]}</span></div></div>
        <div className="home-links"><Link to="/guide">Read the setup guide <ArrowRight/></Link><Link to="/webapp">Open phone setup <ArrowRight/></Link></div>
      </section>

      <section className="home-section controls-section content-section" id="controls">
        <SectionHeading eyebrow="VISIBLE CONTROLS" title="You set the limits before a session.">See how a step cap and payout filter shape the controls you choose.</SectionHeading>
        <div className="controls-layout"><div className="home-card controls-list"><div><span>Strategy</span><b>Martingale <small>Demo</small></b></div><label><span>Start amount</span><select value={startAmount} onChange={(event)=>setStartAmount(Number(event.target.value))}><option value="1">$1</option><option value="5">$5</option><option value="10">$10</option><option value="25">$25</option></select></label><div><span>Multiplier</span><b>2.0×</b></div><label className="sandbox-range"><span>Martingale recovery steps: <b>{stepCap}</b></span><input aria-label="Martingale recovery steps" type="range" min="1" max="6" value={stepCap} onChange={(event)=>setStepCap(Number(event.target.value))}/></label><label className="sandbox-range"><span>Minimum payout: <b>{minimumPayout}%</b></span><input aria-label="Minimum payout" type="range" min="70" max="92" step="2" value={minimumPayout} onChange={(event)=>setMinimumPayout(Number(event.target.value))}/></label><p>Avalisa Bot 4-rule mode is available with Pro.</p></div>
          <div className="home-card exposure-card"><span className="home-eyebrow">ILLUSTRATIVE EXAMPLE · 2.0×</span><h3>Steps {stepCap} means {stepCap+1} trades in a cycle</h3><div className="exposure-bars">{Array.from({length:stepCap+1},(_,i)=>startAmount*2**i).map((v,i)=><div key={i}><span>{i===0?'Trade 1':`Step ${i}`}</span><i ref={(element)=>{barRefs.current[i]=element;}} data-width={v/(startAmount*2**stepCap)*100} style={{'--bar':`${v/(startAmount*2**stepCap)*100}%`}}/><b ref={(element)=>{amountRefs.current[i]=element;}} data-value={v}>${v}</b></div>)}</div><strong ref={totalExposureRef} data-value={cycleExposure}>Maximum cycle exposure: ${cycleExposure} · {2 ** (stepCap + 1) - 1}× base stake</strong><p>A losing streak can reduce your balance. Use a cap and test on Demo.</p><button className="stop-demo" type="button" aria-pressed={sandboxStopped} onClick={()=>setSandboxStopped((stopped)=>!stopped)}>■ {sandboxStopped?'START DEMO':'STOP BOT'}</button><span className="sandbox-status" role="status" aria-live="polite">Status: {sandboxStopped?'Stopped by you':'Ready on Demo'}</span></div></div>
        <div className="pair-row">{[['EUR/USD',92],['AUD/CAD',86],['GBP/JPY',68]].map(([pair,payout])=><span key={pair}>{pair} · {payout}% <b className={payout>=minimumPayout?'eligible':'skipped'}>{payout>=minimumPayout?'Eligible':'Skipped below floor'}</b></span>)}</div>
      </section>

      <section className="home-section demo-section content-section" id="demo"><SectionHeading eyebrow="TRY BEFORE YOU DECIDE" title="10 free Martingale trades on Demo.">Use a practice balance to see how the panel and controls work.</SectionHeading><div className="demo-grid home-card"><div className="demo-count"><strong>10</strong><span>Demo trades</span><div className="demo-ring"><Check/></div></div><ul><li><Check/>Desktop Chrome extension</li><li><Check/>Phone browser access</li><li><Check/>Martingale mode and step cap</li><li><Check/>Dashboard trade history</li></ul><div className="demo-promise"><h3>What we never ask for</h3><p>No card to start Demo.</p><p>No Pocket Option password.</p><p>No real-money deposit to test.</p></div></div><Link className="home-button" to={user?'/dashboard':'/register'}>Claim your Demo trades <ArrowRight/></Link></section>

      <section className="home-section pricing-section content-section" id="pricing"><SectionHeading eyebrow="SIMPLE UNLOCK PATHS" title="Choose how to unlock more controls.">Keep Demo, use a new Pocket Option account through our link for Pro eligibility, or choose a paid plan.</SectionHeading><div className="plan-grid">
        <article className="home-card plan-card"><span className="home-eyebrow">NEW POCKET OPTION ACCOUNT</span><h3>Partner Pro</h3><strong>Free Pro</strong><p>Register a new Pocket Option account through our link. Pro is granted once the partner system confirms it.</p><a href={AFFILIATE_LINK} target="_blank" rel="noreferrer">Open Pocket Option <ArrowRight/></a><Link to="/register?intent=affiliate">Partner account steps <ArrowRight/></Link></article>
        <article className="home-card plan-card"><span className="home-eyebrow">PRO</span><h3>Pro access</h3><strong>$119 once <small>or $29/month</small></strong><p>Unlimited Martingale and Avalisa Bot 4-rule mode.</p><Link to="/pricing#pro">Compare Pro options <ArrowRight/></Link><Link to="/pricing#pro">View Pro</Link></article>
        <article className="home-card plan-card"><span className="home-eyebrow">MARTINGALE MODE</span><h3>Basic</h3><strong>$69 one-time</strong><p>Unlimited Martingale controls. Avalisa Bot mode is not included.</p><Link to="/pricing#basic">View Basic <ArrowRight/></Link></article>
      </div><p className="demo-footnote">Demo includes 10 Martingale trades. Avalisa Bot 4-rule mode requires Pro.</p></section>

      <section className="home-section trust-section content-section" id="trust"><SectionHeading eyebrow="PRIVACY & SUPPORT" title="Your broker account stays yours.">You log in to Pocket Option yourself. Avalisa works in the open browser session.</SectionHeading><div className="trust-grid"><article className="home-card"><Shield/><h3>Your login stays with you</h3><p>Avalisa never asks you for your Pocket Option password. Your balance and account remain in your Pocket Option session.</p></article><article className="home-card"><SlidersHorizontal/><h3>See the setup first</h3><p>Review the phone or desktop instructions and control guide before creating an account.</p><Link to="/guide">Open the guide <ArrowRight/></Link></article><article className="home-card"><Smartphone/><h3>Desktop and phone</h3><p>Use the Chrome extension on desktop or the browser bookmark setup on iPhone and Android.</p><Link to="/webapp">Phone setup <ArrowRight/></Link></article></div></section>

      <section className="home-section faq-section content-section" id="faq"><SectionHeading eyebrow="COMMON QUESTIONS" title="A few useful answers.">Understand the Demo and plan options before you begin.</SectionHeading><div className="faq-list"><details><summary>What is included in free Demo?</summary><p>10 Martingale trades, phone webapp access, dashboard access, and basic trade history.</p></details><details><summary>Does Demo include Avalisa Bot mode?</summary><p>No. Demo includes Martingale mode. Avalisa Bot 4-rule mode is Pro.</p></details><details><summary>Does Avalisa need my Pocket Option password?</summary><p>No. You log in to Pocket Option yourself in your browser.</p></details><details><summary>What does Pro cost?</summary><p>Pro is $119 one-time or $29/month. Basic is $69 one-time.</p></details></div></section>

      <section className="home-final content-section"><div><span className="home-eyebrow">START ON DEMO</span><h2>Try the controls at your own pace.</h2><p>Start with 10 free Martingale trades on a practice balance.</p><Link className="home-button" to={user?'/dashboard':'/register'}>Start free Demo <ArrowRight/></Link></div><img src="/images/landing/generated/avalisa-girl-cutout.png" alt="Avalisa mascot" width="1024" height="1536" loading="lazy"/><span className="risk-note">Trading involves risk. Start on a demo account.</span></section>
    </main>
    {showSticky&&<div className="home-sticky"><span>10 Free Demo Trades · No Card</span><Link to={user?'/dashboard':'/register'}>Start Free Demo <ArrowRight size={16}/></Link></div>}
  </div>;
}
