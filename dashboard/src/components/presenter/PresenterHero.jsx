import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { startHeroShow } from './heroShow';

// Homepage hero, concept A "The Presenter": headline left, Avalisa in the middle, the product on
// the right. The Pocket Option window and the panel are drawn to match the real screens
// (labels, colours and status wording copied from extension/overlayView.js).

const TABS = [['Bitcoin OTC', 92], ['Cardano OTC', 92], ['CHF/JPY OTC', 92], ['CAD/JPY OTC', 92], ['BHD/CNY OTC', 64], ['AUD/USD OTC', 92]];
const RULES = ['RSI overbought (>70)', 'Above upper band', 'Momentum turning down', 'Red candle'];
const SETTINGS = [['Strategy', 'Avalisa Bot', true], ['Intensity', 'Low', true], ['Pair Scan', 'Auto scan favorites', true], ['Start Amount ($)', '1', false], ['Martingale ×', '2.0×', true], ['Martingale Steps', '5', true]];

function PoWindow() {
  return (
    <div className="powin" aria-hidden="true">
      <div className="po__bar">
        <img className="po__logo" src="/assets/presenter/po-logo.png" alt="" />
        <span className="po__sp" />
        <span className="po__acct"><small>QT Demo · USD</small><b>90.24</b></span>
        <span className="po__top">TOP UP</span><span className="po__menu">Bot Menu</span>
      </div>
      <div className="po__tabs">{TABS.map(([name, pay]) => <span className="po__tab" key={name}><b>{name}</b><i>+{pay}%</i></span>)}</div>
      <div className="po__body">
        <div className="po__chart"><canvas className="pzh-chart" /><span className="po__pair">CHF/JPY OTC</span></div>
        <div className="po__trade">
          <span className="l">Time</span><b>00:00:30</b><span className="l">Amount</span><b>$1</b>
          <span className="l">Payout</span><b className="po__pay">+92%</b><span className="po__buy">BUY</span><span className="po__sell">SELL</span>
        </div>
      </div>
    </div>
  );
}

function BotPanel() {
  return (
    <div className="avp" aria-hidden="true">
      <div className="avp__hd">
        <span className="avp__logo"><img src="/assets/presenter/avalisa-logo.webp" alt="" />Avalisa PO Bot</span>
        <span className="avp__x">✕</span>
      </div>
      <div className="avp__sec avp__user"><span className="avp__lab">you@email.com</span><span className="avp__plan">PRO</span><span className="avp__logout">Logout</span></div>
      <div className="avp__sec avp__set">
        {SETTINGS.map(([label, value, dropdown]) => (
          <div className="avp__row" key={label}><span className="avp__lab">{label}</span><span className={`avp__sel${dropdown ? ' avp__sel--dd' : ''}`}>{value}</span></div>
        ))}
        <div className="avp__row"><span className="avp__lab">Minimum payout %</span><span className="avp__pay"><span className="avp__sw" /><span className="avp__sel">90</span></span></div>
        <div className="avp__row"><span className="avp__lab" /><span className="avp__sel avp__sel--dd">Auto-switch favorite</span></div>
      </div>
      <div className="avp__sec avp__btns"><span className="avp__btn avp__btn--go is-off">▶ Start</span><span className="avp__btn avp__btn--stop">■ Stop</span></div>
      <div className="avp__sec">
        <div className="avp__status running">Status: Scanning Cardano OTC (92%)</div>
        <div className="avp__box">
          <div className="avp__boxhd"><span className="avp__pairname">BTCUSD_otc · mean-revert · PUT</span><span className="avp__score">1/2 rules</span></div>
          <ul className="avp__rules">{RULES.map((rule, i) => <li key={rule} className={i === 3 ? 'met' : undefined}>{rule}</li>)}</ul>
          <div className="avp__age">checked just now</div>
        </div>
        <div className="avp__cnt">Trade allowance: ∞ (Pro)</div>
        <div className="avp__cnt avp__trades">Trades this session: 0</div>
      </div>
    </div>
  );
}

export default function PresenterHero({ titleId, sub, cta, secondary, phoneSub, trust = [], risk }) {
  const frameRef = useRef(null);
  useEffect(() => startHeroShow(frameRef.current), []);

  return (
    <div className="pzh">
      <div className="pzh-frame" ref={frameRef}>
        <div className="pzh-bg" aria-hidden="true" /><div className="pzh-halo" aria-hidden="true" />
        <div className="pz-mascot">
          <img src="/assets/presenter/girl-f0.webp" alt="Avalisa, the Avalisa PO Bot mascot, in a champagne satin dress" width="738" height="1362" fetchPriority="high" decoding="async" />
          <canvas width="738" height="1362" aria-hidden="true" />
        </div>
        <div className="pzh-shade pzh-shade--top" aria-hidden="true" /><div className="pzh-shade pzh-shade--floor" aria-hidden="true" />
        <div className="pzh-copy">
          <h1 className="pzh-title" id={titleId}>Your Pocket Option trades, on autopilot.</h1>
          <p className="pzh-lede">{sub}</p>
          <div className="pzh-cta">
            <Link className="pz-btn" to={cta.href}>{cta.label}</Link>
            <a className="pz-link" href={secondary.href}>{secondary.label}</a>
          </div>
          {phoneSub && <p className="pzh-phonesub">{phoneSub}</p>}
          <ul className="pzh-trust">{trust.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="pzh-fine"><span>Works with</span><img src="/assets/presenter/po-logo.png" alt="Pocket Option" /><span>Independent tool, not made by Pocket Option.</span></p>
          <p className="pzh-risk">{risk}</p>
        </div>
        <PoWindow />
        <BotPanel />
      </div>
    </div>
  );
}
