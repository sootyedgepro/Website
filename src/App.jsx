import { useState, useEffect, useRef } from "react";

const MOBILE_IMG = "/MobileSooty.svg";
const DESKTOP_IMG = "/DesktopSooty.svg";
const L = {
  s: "https://buy.stripe.com/4gM6oI1aA2m5asCctQ7N60U",
  b: "https://buy.stripe.com/fZu00kbPe3q98kudxU7N619",
  c: "https://mee6.xyz/en/m/891686892997865532?subscribe=1094695320790630400&bundle=1157508030540283904"
};

function ConstellationBG() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    let W, H, pts = [], raf;
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    for (let i = 0; i < 40; i++) pts.push({ x: Math.random()*2000, y: Math.random()*1200, r: Math.random()*1.4+0.4, vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.15, o: Math.random()*0.4+0.1, h: Math.random()>0.5?[255,214,0]:Math.random()>0.4?[3,205,0]:[0,180,212] });
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W+20; if (p.x > W+20) p.x = -20;
        if (p.y < -20) p.y = H+20; if (p.y > H+20) p.y = -20;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle = "rgba("+p.h+","+p.o+")"; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,opacity:0.85}} />;
}

function Spotlight() {
  const ref = useRef(null);
  useEffect(() => {
    let mx = -500, my = -500, cx = -500, cy = -500;
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*0.05; cy += (my-cy)*0.05;
      if (ref.current) ref.current.style.background = "radial-gradient(700px circle at "+cx+"px "+cy+"px,rgba(255,214,0,.025),transparent 55%)";
      requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", move); tick();
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return <div ref={ref} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:2}} />;
}

function useTilt(n) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX-r.left)/r.width-0.5; const y = (e.clientY-r.top)/r.height-0.5; el.style.transform = "perspective(800px) rotateY("+x*n+"deg) rotateX("+-y*n+"deg)"; };
    const l = () => { el.style.transform = "none"; };
    el.addEventListener("mousemove", m); el.addEventListener("mouseleave", l);
    return () => { el.removeEventListener("mousemove", m); el.removeEventListener("mouseleave", l); };
  }, [n]);
  return ref;
}

function Counter({ value, color }) {
  const ref = useRef(null);
  const [d, setD] = useState("0");
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const num = parseInt(value) || 0;
        if (!num) { setD(value); io.disconnect(); return; }
        const t0 = performance.now();
        const tick = (now) => { const p = Math.min((now-t0)/1200,1); setD(Math.round((1-Math.pow(1-p,3))*num).toString()); if (p<1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick); io.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [value]);
  return <span ref={ref} className="counter" style={{color}}>{d}</span>;
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("vi"); io.unobserve(entry.target); }
    }), { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function MagBtn({ href, children, className = "btn-p", style }) {
  const handleClick = (e) => {
    if (href && href.startsWith("#")) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return (
    <a href={href || "#"} className={className + " hov"} onClick={handleClick} style={style}
       target={href && href.startsWith("http") ? "_blank" : undefined}
       rel={href && href.startsWith("http") ? "noopener noreferrer" : undefined}>
      {children}
    </a>
  );
}

function SmoothLink({ href, children, className = "", onClick }) {
  const handleClick = (e) => {
    if (onClick) { e.preventDefault(); onClick(); return; }
    if (href && href.startsWith("#")) { e.preventDefault(); const el = document.querySelector(href); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  return (
    <a href={href || "#"} className={className} onClick={handleClick}
       target={href && href.startsWith("http") ? "_blank" : undefined}
       rel={href && href.startsWith("http") ? "noopener noreferrer" : undefined}>
      {children}
    </a>
  );
}

function TermsModal({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{background:"#101012",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"40px 36px",maxWidth:600,maxHeight:"80vh",overflow:"auto",width:"90%"}} onClick={(e)=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h3 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:"#fff",letterSpacing:2}}>Terms of Service</h3>
          <button onClick={onClose} style={{background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#fff",padding:"6px 14px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>Close</button>
        </div>
        <div style={{color:"#606078",fontStyle:"italic",fontSize:14,lineHeight:1.8}}>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>1. Digital Product Delivery.</strong> SootyEdge Pro+ and all associated indicators are digital products delivered via TradingView invitation. Access is granted within 24 hours of purchase.</p>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>2. No Refund Policy.</strong> Due to the digital nature and immediate access, all sales are final.</p>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>3. Not Financial Advice.</strong> SootyEdge is a technical analysis tool. It does not constitute financial advice or trading signals.</p>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>4. Risk Disclosure.</strong> Trading involves substantial risk of loss. Past performance does not guarantee future results.</p>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>5. License.</strong> Purchase grants a single-user, non-transferable license. Redistribution is prohibited.</p>
          <p style={{marginBottom:16}}><strong style={{color:"#fff"}}>6. Updates.</strong> Lifetime access includes all future updates at no additional cost.</p>
          <p><strong style={{color:"#fff"}}>7. Support.</strong> Contact support@sootyedge.com. Response within 48 business hours.</p>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const [s, setS] = useState(false);
  useEffect(() => { const f = () => setS(window.scrollY > 40); f(); window.addEventListener("scroll", f, {passive:true}); return () => window.removeEventListener("scroll", f); }, []);
  return (
    <nav className={"nv" + (s ? " nvs" : "")}>
      <a href="#" className="nv-logo hov" onClick={(e) => { e.preventDefault(); window.scrollTo({top:0,behavior:"smooth"}); }}>
        <span className="logo-dot" /><span className="nv-s">SOOTY</span><span className="nv-e">EDGE</span>
      </a>
      <div className="nv-links">
        {[["#how","HOW IT WORKS"],["#system","SYSTEM"],["#benefits","BENEFITS"],["#pricing","PRICING"],["#faq","FAQ"]].map(([h,t]) => (
          <SmoothLink key={t} href={h} className="nv-a hov">{t}</SmoothLink>
        ))}
      </div>
      <MagBtn href={L.s} className="nv-cta">GET ACCESS</MagBtn>
    </nav>
  );
}

function Hero() {
  const pr = useTilt(6);
  return (
    <section className="hero">
      <div className="hero-grid-bg" /><div className="hero-glow" />
      <div className="hero-left">
        <div className="hero-ey rv"><span className="ey-line" />EDGE TRADING SYSTEM</div>
        <h1 className="hero-h1 rv"><span className="hw">TRADE</span><br /><span className="hg">WITH A</span><br /><span className="hy">REAL EDGE.</span></h1>
        <p className="hero-sub rv">A complete two-tool framework for clear, disciplined, consistent trading — powered by TradingView. Entry, SL, and 5 Take Profits drawn automatically.</p>
        <div className="hero-acts rv"><MagBtn href={L.s}>GET THE SYSTEM</MagBtn><MagBtn href="#system" className="btn-g">SEE IT LIVE</MagBtn></div>
        <div className="hero-stats rv">
          {[{v:"2",l:"TOOLS",c:"#FFD600"},{v:"7",l:"AUTO LEVELS",c:"#03CD00"},{v:"0",l:"GUESSWORK",c:"#00D4D4"}].map((item,i) => (
            <div key={i} className="h-stat"><Counter value={item.v} color={item.c} /><span className="h-stat-l">{item.l}</span></div>
          ))}
        </div>
      </div>
      <div className="hero-right rv">
        <div className="phone-wrap" ref={pr}>
          <div className="iphone"><div className="ip-notch" /><img src={MOBILE_IMG} alt="SootyEdge" className="ip-img" /></div>
        </div>
        <div className="fb fb1 hov"><span className="fbd" style={{background:"#03CD00"}} />Strong Buy</div>
        <div className="fb fb2 hov"><span className="fbd" style={{background:"#03CD00"}} />TP5 <span style={{color:"#03CD00",marginLeft:6}}>R:R 6.25</span></div>
        <div className="fb fb3 hov"><span className="fbd" style={{background:"#FFD600"}} />Entry <span style={{color:"#FFD600",marginLeft:6}}>5114.74</span></div>
        <div className="fb fb4 hov"><span className="fbd" style={{background:"#FF3333"}} />SL <span style={{color:"#FF3333",marginLeft:6}}>5038.62</span></div>
      </div>
    </section>
  );
}

const TK = [{s:"ETHUSD",p:"3,284",d:0,c:"-1.14%"},{s:"DXY",p:"184.62",d:1,c:"+0.88%"},{s:"SILVER",p:"28.74",d:1,c:"+2.18%"},{s:"AUDUSD",p:"0.6512",d:0,c:"-0.18%"},{s:"XAUUSD",p:"5,177",d:1,c:"+0.75%"},{s:"SPX500",p:"5,482",d:1,c:"+0.43%"},{s:"BTC",p:"94,220",d:1,c:"+3.4%"},{s:"NVDA",p:"132.88",d:1,c:"+1.8%"}];

function Ticker() {
  const a = [...TK,...TK,...TK,...TK];
  return (<div className="ticker"><div className="tt">{a.map((t,i) => (<span key={i} className="ti"><span className="tis">{t.s}</span><span className="tip">{t.p}</span><span className={t.d?"tiu":"tid"}>{t.c}</span></span>))}</div></div>);
}

function Sec({ id, ey, children, center }) {
  return (
    <section className="sec" id={id}>
      <div className={"sec-in" + (center ? " sec-c" : "")}>
        {ey && <div className="sec-ey rv"><span className="ey-line" />{ey}{center && <span className="ey-line" />}</div>}
        {children}
      </div>
    </section>
  );
}

function LiveScreenshot() {
  const r = useTilt(4);
  return (
    <Sec id="system" ey="LIVE SCREENSHOT">
      <h2 className="sec-h2 rv"><span className="hw">This is what the</span><br /><span className="hd">system looks like.</span></h2>
      <p className="sec-lead rv">XAUUSD on the 4H chart. The Flow Tracker reads <strong style={{color:"#03CD00"}}>Strong Buy</strong>. SootyEdge Pro+ has plotted Entry, Stop Loss, and all 5 Take Profit targets.</p>
      <div className="desktop-wrap rv" ref={r}>
        <div className="desktop-frame">
          <div className="desktop-bar"><span className="db-dot" style={{background:"#FF5F57"}} /><span className="db-dot" style={{background:"#FFBD2E"}} /><span className="db-dot" style={{background:"#28CA41"}} /><span className="db-title">XAUUSD · 4H · TRADINGVIEW</span></div>
          <img src={DESKTOP_IMG} alt="SootyEdge Desktop" style={{width:"100%",display:"block"}} />
        </div>
      </div>
    </Sec>
  );
}

function Problem() {
  const f = [{t:"No clear direction",b:"Mixed signals create paralysis on every entry.",c:"#FF3333"},{t:"No defined risk",b:"Traders enter without a stop loss — or move it.",c:"#FF3333"},{t:"Overtrading",b:"Forcing trades in low-probability conditions.",c:"#FFD600"},{t:"Emotional decisions",b:"Without rules, emotion always wins.",c:"#FFD600"}];
  return (
    <Sec ey="THE REALITY">
      <h2 className="sec-h2 rv"><span className="hw">Why most traders</span><br /><span className="hd">never succeed.</span></h2>
      <div className="prob-stat rv"><span className="ps-n">80%</span><div><strong className="ps-h">of retail traders lose money consistently.</strong><p className="ps-b">Not because markets are impossible — but because they lack a structured system.</p></div></div>
      <div className="fail-g">{f.map((item,i) => (<div key={i} className="fail-c rv hov" style={{"--fc":item.c}}><div className="fail-t">{item.t}</div><p className="fail-b">{item.b}</p></div>))}</div>
    </Sec>
  );
}

function TwoTools() {
  return (
    <Sec ey="THE SOLUTION" center>
      <h2 className="sec-h2 rv"><span className="hw">Two tools.</span><br /><span className="hd">One complete system.</span></h2>
      <p className="sec-lead rv">Each tool has a distinct role. Together they cover every decision a trader needs to make.</p>
      <div className="tools-g">
        {[{n:"01",name:"Sooty Flow Tracker",sub:"The Intelligence Layer",body:"Reads market conditions and produces a single, clear directional verdict.",a:"#FFD600"},{n:"02",name:"SootyEdge Pro+",sub:"The Execution Layer",body:"Automatically plots exact Entry, Stop Loss, and 5 Take Profit levels.",a:"#00D4D4"}].map((t,i) => (
          <div key={i} className="tool-c rv hov"><span className="tool-badge" style={{borderColor:t.a,color:t.a}}>Tool {t.n}</span><h3 className="tool-n">{t.name}</h3><span className="tool-sub" style={{color:t.a}}>{t.sub}</span><p className="tool-body">{t.body}</p></div>
        ))}
      </div>
    </Sec>
  );
}

function Workflow() {
  const steps = [{n:"01",t:"Market Opens",b:"Pivot-based levels plotted automatically.",c:"#FFD600"},{n:"02",t:"Flow Tracker Reads",b:"Three-layer bias produces an Overall verdict.",c:"#E8A317"},{n:"03",t:"Bias Gate Activates",b:"Favourable? Levels appear. If not, everything hides.",c:"#03CD00"},{n:"04",t:"Execute the Plan",b:"Enter at Entry, stop at SL, scale out at TP1-TP5.",c:"#E07B00"},{n:"05",t:"Alerts Do the Rest",b:"Smart alerts notify you at every key level.",c:"#00B4D8"}];
  return (
    <Sec id="how" ey="THE WORKFLOW">
      <h2 className="sec-h2 rv"><span className="hw">From market open</span><br /><span className="hd">to executed trade.</span></h2>
      <div className="wf-g rv">{steps.map((s,i) => (
        <div key={i} className="wf-s hov" style={{"--wc":s.c}}><div className="wf-top" style={{background:s.c}} /><span className="wf-n" style={{color:s.c}}>{s.n}</span><div className="wf-t">{s.t}</div><p className="wf-b">{s.b}</p></div>
      ))}</div>
    </Sec>
  );
}

function TD({ n, name, sub, body, accent, panel, feats }) {
  return (
    <Sec>
      <div className="td-lay">
        <div className="td-l rv"><span className="tool-badge" style={{borderColor:accent,color:accent}}>Tool {n}</span><h3 className="td-name">{name}</h3><span className="td-sub" style={{color:accent}}>{sub}</span><p className="td-body">{body}</p>{panel}</div>
        <div className="td-r">{feats.map((f,i) => (<div key={i} className="td-feat rv"><span className="td-dot" style={{background:f.d}} /><div><div className="td-ft">{f.t}</div><p className="td-fb">{f.b}</p></div></div>))}</div>
      </div>
    </Sec>
  );
}

function FlowTracker() {
  return (<TD n="01" name={<>Sooty Flow<br />Tracker</>} sub="The Intelligence Layer" accent="#FFD600" body="Reads the market across three independent layers and produces a weighted consensus verdict." panel={<div className="flow-p">{[["Pressure","Buy","fpb"],["Trend","Buy","fpb"],["Overall","Strong Buy","fps"]].map(([l,v,c],i) => (<div key={i} className="fp-r"><span className="fp-l">{l}</span><span className={"fp-v "+c}>{v}</span></div>))}</div>} feats={[{d:"#FFD600",t:"Three-Layer Bias Voting",b:"Pressure + Trend combine into one Overall verdict."},{d:"#FF3333",t:"DO NOT ENTER Protection",b:"No alignment? System outputs DO NOT ENTER."},{d:"#03CD00",t:"Strong Buy / Strong Sell",b:"Only fires when all layers agree."},{d:"#00B4D8",t:"Three Indicator Lines",b:"Yellow, Blue, Orange read market structure."}]} />);
}

function ProPlus() {
  return (<TD n="02" name={<>SootyEdge<br />Pro+</>} sub="The Execution Layer" accent="#00D4D4" body="Turns the verdict into an exact trade plan — every level drawn before the session begins." panel={<div className="neon-p">{[{n:"SL",c:"#FF3333"},{n:"ENTRY",c:"#FFD600"},{n:"TP 1",c:"#AADD00"},{n:"TP 2",c:"#03CD00"},{n:"TP 3",c:"#00B4D8"},{n:"TP 4",c:"#0077B6"},{n:"TP 5",c:"#6A4CE0"}].map((l,i) => (<div key={i} className="nr"><span className="nl" style={{color:l.c}}>{l.n}</span><div className="nw"><div className="nb" style={{background:l.c,boxShadow:"0 0 12px "+l.c+"55"}} /></div></div>))}</div>} feats={[{d:"#FFD600",t:"Automatic Entry, SL & 5 TPs",b:"Full trade plan plotted every session."},{d:"#03CD00",t:"Bias-Gated Display",b:"Levels disappear on DO NOT ENTER."},{d:"#00B4D8",t:"Risk:Reward on Every Target",b:"R:R ratios next to each TP."},{d:"#6A4CE0",t:"Multi-Timeframe Confluence",b:"Daily + weekly pivot alignment."}]} />);
}

function Benefits() {
  return (
    <Sec id="benefits" ey="KEY BENEFITS" center>
      <h2 className="sec-h2 rv"><span className="hw">What SootyEdge</span><br /><span className="hd">gives you.</span></h2>
      <div className="ben-g">{[{v:"1",l:"Clear Signal",b:"One table. One verdict.",c:"#FFD600"},{v:"7",l:"Levels Drawn",b:"Entry, SL, TP1-5 every session.",c:"#00B4D8"},{v:"0",l:"Guesswork",b:"Where to enter, stop, and exit.",c:"#03CD00"},{v:"\u221E",l:"Markets",b:"Stocks, forex, crypto, futures.",c:"#FFD600"},{v:"24",l:"Hour Alerts",b:"Webhooks monitor around the clock.",c:"#00B4D8"},{v:"2",l:"Tools, 1 Edge",b:"Intelligence + execution combined.",c:"#03CD00"}].map((b,i) => (
        <div key={i} className="ben-c rv hov"><Counter value={b.v} color={b.c} /><div className="ben-l">{b.l}</div><p className="ben-b">{b.b}</p></div>
      ))}</div>
    </Sec>
  );
}

function Reviews() {
  const reviews = [
    {name:"Marcus T.",role:"Forex \u00B7 2 years",text:"I was drowning in indicators. Now I open my chart, check the bias, and levels are already there. Win rate: 38% to 61% in three months.",color:"#FFD600"},
    {name:"Sarah K.",role:"Crypto & Indices",text:"The DO NOT ENTER feature alone saved my account. I used to overtrade every session. Now I only enter when the system says go.",color:"#03CD00"},
    {name:"James R.",role:"Day Trader \u00B7 US500",text:"Finally, exact levels \u2014 not vague zones. Entry, SL, five TPs. I know my risk before I click buy.",color:"#00D4D4"},
    {name:"Anika P.",role:"Swing Trader \u00B7 Gold",text:"The three-layer bias is incredibly accurate. When it says Strong Buy, I trust it. Confluence zones on weekly pivots are next level.",color:"#FFD600"},
  ];
  return (
    <Sec ey="REVIEWS">
      <h2 className="sec-h2 rv"><span className="hw">What traders</span><br /><span className="hd">are saying.</span></h2>
      <div className="rev-g">{reviews.map((r,i) => (
        <div key={i} className="rev-c rv hov">
          <div className="rev-stars">{String.fromCharCode(9733).repeat(5)}</div>
          <p className="rev-text">{'"'+r.text+'"'}</p>
          <div className="rev-author"><div className="rev-av" style={{background:r.color}}>{r.name[0]}</div><div><div className="rev-name">{r.name}</div><div className="rev-role">{r.role}</div></div></div>
        </div>
      ))}</div>
    </Sec>
  );
}

function Pricing() {
  return (
    <Sec id="pricing" ey="PRICING" center>
      <h2 className="sec-h2 rv"><span className="hw">Your level.</span><br /><span className="hd">Your access.</span></h2>
      <div className="pr-g">
        <div className="pr-c rv hov"><div className="prt">Monthly Access</div><div className="prn">Inner Circle</div><p className="prd">Signal chat + community. Live setups, weekly analysis.</p><div className="prp"><span className="prc">$</span><span className="prv">99<span style={{fontSize:"36%"}}>.99</span></span></div><span className="prper">/ month</span><MagBtn href={L.c} className="btn-g" style={{width:"100%",textAlign:"center",marginTop:20}}>JOIN INNER CIRCLE</MagBtn></div>
        <div className="pr-c pr-feat rv hov"><div className="pr-pop">HERO PRODUCT</div><div className="prt">One-Time Access</div><div className="prn">SootyEdge Pro+</div><p className="prd">The full indicator. Entry, SL, all 5 TPs forever.</p><div className="prp"><span className="prc">$</span><span className="prv">997</span></div><span className="prper">one-time \u00B7 lifetime</span><MagBtn href={L.s} style={{width:"100%",textAlign:"center",marginTop:20}}>GET LIFETIME ACCESS</MagBtn></div>
        <div className="pr-c rv hov"><div className="prt" style={{color:"#00D4D4"}}>Full Automation</div><div className="prn">Automated System</div><p className="prd">Pro+ connected to execution. Fully automated.</p><div className="prp"><span className="prc">$</span><span className="prv">3,500</span></div><span className="prper">one-time \u00B7 lifetime</span><MagBtn href={L.b} className="btn-g" style={{width:"100%",textAlign:"center",marginTop:20,borderColor:"rgba(0,212,212,.3)",color:"#00D4D4"}}>APPLY FOR ACCESS</MagBtn></div>
      </div>
    </Sec>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(-1);
  const qs = [{q:"What TradingView plan do I need?",a:"Works on all plans including free."},{q:"How is access delivered?",a:"Email within 24 hours with TradingView invite instructions."},{q:"Does it work on all assets?",a:"Yes \u2014 stocks, ETFs, forex, crypto, indices, futures."},{q:"Is the $997 a subscription?",a:"No. One-time payment, lifetime access, all future updates."},{q:"Can I upgrade from Inner Circle?",a:"Absolutely. Many join the community first, then upgrade."},{q:"Refund policy?",a:"Due to digital nature and immediate access, all sales are final."}];
  const toggle = (i) => { setOpenIdx(openIdx === i ? -1 : i); };
  return (
    <Sec id="faq" ey="FAQ">
      <h2 className="sec-h2 rv"><span className="hw">Common</span><br /><span className="hd">questions.</span></h2>
      <div style={{maxWidth:760,display:"flex",flexDirection:"column",gap:6,marginTop:28}}>
        {qs.map((q, i) => (
          <div key={i} className="rv" style={{marginBottom:0}}>
            <div className={"faq-i" + (openIdx === i ? " faq-o" : "")} style={{cursor:"pointer"}} onClick={() => toggle(i)}>
              <div className="faq-q"><span>{q.q}</span><span className="faq-arr">{openIdx === i ? "\u2212" : "+"}</span></div>
              <div className="faq-a" style={{maxHeight: openIdx === i ? 200 : 0, overflow:"hidden", padding: openIdx === i ? "0 20px 16px" : "0 20px", transition:"all 0.3s ease", opacity: openIdx === i ? 1 : 0}}>{q.a}</div>
            </div>
          </div>
        ))}
      </div>
    </Sec>
  );
}

function FinalCTA() {
  return (
    <section className="fcta">
      <div className="fcta-glow" />
      <div className="fcta-badge rv"><span className="ldot" />LIVE SYSTEM</div>
      <h2 className="fcta-h rv"><span className="hw">The only question is</span><br /><span className="hw">who uses it first.</span></h2>
      <p className="fcta-sub rv">Two tools. One framework. Full discipline from signal to exit.</p>
      <div className="fcta-acts rv"><MagBtn href={L.s}>ACCESS THE SYSTEM</MagBtn><MagBtn href="#system" className="btn-g">VIEW LIVE CHART</MagBtn></div>
    </section>
  );
}

function Footer({ onTerms }) {
  return (
    <footer className="ft">
      <div className="ft-in">
        <div><div className="ft-logo"><span className="logo-dot" /><span className="nv-s">SOOTY</span><span className="nv-e">EDGE</span></div><p className="ft-desc">Precision pivot-based trading levels for TradingView.</p></div>
        <div><div className="ft-ct">Product</div>{[["#how","How It Works"],["#system","System"],["#benefits","Benefits"],["#pricing","Pricing"],["#faq","FAQ"]].map(([h,t]) => (<SmoothLink key={t} href={h} className="ft-a hov">{t}</SmoothLink>))}</div>
        <div><div className="ft-ct">Access</div><SmoothLink href={L.s} className="ft-a hov">Pro+ $997</SmoothLink><SmoothLink href={L.b} className="ft-a hov">Automated $3,500</SmoothLink><SmoothLink href={L.c} className="ft-a hov">Inner Circle $99.99/mo</SmoothLink></div>
        <div><div className="ft-ct">Support</div><SmoothLink href="mailto:support@sootyedge.com" className="ft-a hov">Contact</SmoothLink><SmoothLink href={L.s} className="ft-a hov">Setup Guide</SmoothLink><SmoothLink className="ft-a hov" onClick={onTerms}>Terms</SmoothLink></div>
      </div>
      <div className="ft-bot"><span>\u00A9 2026 SootyEdge</span><span className="ft-leg">Trading involves substantial risk. Past performance does not guarantee future results. Not financial advice.</span></div>
    </footer>
  );
}


const CSS = `
:root{--y:#FFD600;--g:#03CD00;--r:#FF3333;--aq:#00D4D4;--dk:#060608;--sf:rgba(12,12,14,.75);--bd:rgba(255,255,255,.06);--tx:#D8D8E4;--mt:#606078;--R:16px;--R2:20px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--dk);color:var(--tx);font-family:'Crimson Pro',Georgia,serif;font-size:18px;line-height:1.65;overflow-x:hidden}
a{color:inherit;text-decoration:none}::selection{background:rgba(255,214,0,.18);color:#fff}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:var(--dk)}::-webkit-scrollbar-thumb{background:rgba(255,214,0,.12)}
@keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-25%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes float1{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px) translateX(5px)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 30px rgba(255,214,0,.08),0 0 0 1px rgba(255,214,0,.15)}50%{box-shadow:0 0 55px rgba(255,214,0,.16),0 0 0 1px rgba(255,214,0,.25)}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.rv{opacity:0;transform:translateY(28px);transition:opacity .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1)}.vi{opacity:1;transform:translateY(0)}
.hw{color:#fff}.hd{color:var(--mt);font-weight:300;font-style:italic}.hg{color:var(--mt);font-weight:300;font-style:italic}.hy{color:var(--y)}
.ey-line{display:inline-block;width:32px;height:1px;background:var(--y);box-shadow:0 0 10px rgba(255,214,0,.35)}
.ldot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--g);animation:pulse 1.5s ease infinite}
.logo-dot{width:26px;height:26px;background:var(--y);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;margin-right:10px}.logo-dot::after{content:'';width:9px;height:9px;background:rgba(0,0,0,.6);border-radius:50%}
.counter{font-family:'Bebas Neue',sans-serif;font-size:56px;line-height:1;display:block}
.nv{position:fixed;top:0;left:0;right:0;z-index:1000;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;background:rgba(6,6,8,.85);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,.03);transition:all .35s}
.nvs{background:rgba(6,6,8,.95)}
.nv-logo{display:flex;align-items:center}.nv-s{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--tx);letter-spacing:5px}.nv-e{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--y);letter-spacing:5px}
.nv-links{display:flex;gap:32px}.nv-a{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--mt);letter-spacing:2.5px;transition:color .25s;position:relative;padding:4px 0}.nv-a:hover{color:var(--y)}.nv-a::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1px;background:var(--y);transition:width .3s}.nv-a:hover::after{width:100%}
.nv-cta{font-family:'JetBrains Mono',monospace;font-size:9px;background:var(--y);color:#000;padding:10px 24px;font-weight:700;letter-spacing:2.5px;border-radius:24px;display:inline-block}
@media(max-width:1000px){.nv{padding:14px 20px}.nv-links{display:none}}
.btn-p{font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--y);color:#000;padding:16px 36px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;border-radius:var(--R);transition:all .3s;position:relative;overflow:hidden}.btn-p::before{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);animation:shimmer 3s ease infinite}.btn-p:hover{box-shadow:0 0 40px rgba(255,214,0,.22)}
.btn-g{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx);border:1px solid var(--bd);padding:16px 36px;letter-spacing:2px;text-transform:uppercase;display:inline-block;border-radius:var(--R);background:rgba(255,255,255,.015);transition:all .3s}.btn-g:hover{border-color:rgba(255,214,0,.25);color:var(--y)}
.hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:120px 48px 60px;position:relative;overflow:hidden;gap:40px;z-index:2}
.hero-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:64px 64px}
.hero-glow{position:absolute;top:5%;right:10%;width:700px;height:700px;background:radial-gradient(circle,rgba(255,214,0,.035) 0%,transparent 55%);filter:blur(50px);pointer-events:none}
.hero-left{position:relative;z-index:2}.hero-ey{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--y);letter-spacing:4px;margin-bottom:24px;display:flex;align-items:center;gap:14px}
.hero-h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(56px,7vw,108px);line-height:.95;margin-bottom:24px}
.hero-sub{font-size:17px;color:var(--mt);font-weight:300;font-style:italic;max-width:460px;margin-bottom:32px;line-height:1.75}
.hero-acts{display:flex;gap:16px;flex-wrap:wrap}
.hero-stats{display:flex;margin-top:36px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);overflow:hidden}
.h-stat{flex:1;padding:16px 20px;text-align:center;border-right:1px solid var(--bd)}.h-stat:last-child{border-right:none}
.h-stat-l{font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--mt);letter-spacing:3px;display:block;margin-top:4px}
.hero-right{position:relative;z-index:2;display:flex;justify-content:center}
.phone-wrap{position:relative}
.iphone{width:280px;height:560px;background:#0a0a0c;border-radius:44px;border:2.5px solid #222;position:relative;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)}
.ip-notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:110px;height:26px;background:#0a0a0c;border-radius:0 0 16px 16px;z-index:5}
.ip-img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:42px}
.fb{position:absolute;font-family:'JetBrains Mono',monospace;font-size:10px;background:rgba(8,8,10,.9);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:7px 14px;color:var(--tx);display:flex;align-items:center;gap:7px;white-space:nowrap;z-index:3}
.fbd{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.fb1{top:8%;left:-35%;animation:float1 4.5s ease infinite}.fb2{top:30%;left:-45%;animation:float2 5.5s ease infinite .4s}.fb3{bottom:25%;left:-30%;animation:float1 5s ease infinite .8s}.fb4{bottom:8%;left:-40%;animation:float2 6s ease infinite 1.2s}
@media(max-width:1000px){.hero{grid-template-columns:1fr;padding:100px 20px 40px}.hero-right{display:none}}
.ticker{background:rgba(6,6,8,.6);border-top:1px solid rgba(255,255,255,.025);border-bottom:1px solid rgba(255,255,255,.025);padding:10px 0;overflow:hidden;z-index:2;position:relative}
.tt{display:inline-flex;gap:44px;animation:ticker 28s linear infinite;white-space:nowrap}
.ti{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--mt);display:inline-flex;gap:7px;align-items:center}
.tis{color:var(--tx);font-weight:700}.tiu{color:var(--g);font-size:9px;background:rgba(3,205,0,.08);padding:1px 5px;border-radius:3px}.tid{color:var(--r);font-size:9px;background:rgba(255,51,51,.08);padding:1px 5px;border-radius:3px}
.sec{padding:80px 48px;position:relative;z-index:2}.sec-in{max-width:1200px;margin:0 auto}.sec-c{text-align:center}
.sec-ey{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--y);letter-spacing:4px;margin-bottom:14px;display:flex;align-items:center;gap:14px}
.sec-h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(44px,5.2vw,72px);line-height:.98;margin-bottom:16px}
.sec-lead{color:var(--mt);font-style:italic;font-weight:300;max-width:580px;font-size:17px;line-height:1.75;margin-bottom:40px}.sec-c .sec-lead{margin-left:auto;margin-right:auto}
@media(max-width:1000px){.sec{padding:56px 20px}}
.desktop-wrap{margin-top:36px}.desktop-frame{background:#0c0c0e;border:1px solid rgba(255,255,255,.06);border-radius:var(--R2);overflow:hidden;box-shadow:0 20px 80px rgba(0,0,0,.5)}
.desktop-bar{display:flex;align-items:center;gap:6px;padding:10px 16px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.04)}
.db-dot{width:8px;height:8px;border-radius:50%}.db-title{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--mt);letter-spacing:2px;margin-left:12px}
.prob-stat{display:flex;align-items:center;gap:40px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);padding:36px 44px;margin:32px 0}
.ps-n{font-family:'Bebas Neue',sans-serif;font-size:clamp(72px,9vw,130px);color:var(--y);flex-shrink:0;line-height:.85}
.ps-h{color:#fff;font-size:18px;display:block;margin-bottom:6px}.ps-b{color:var(--mt);font-style:italic;font-size:15px;line-height:1.7}
.fail-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fail-c{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);padding:24px 28px;border-left:3px solid var(--fc);transition:all .35s}.fail-c:hover{border-color:var(--fc)}
.fail-t{font-size:18px;font-weight:600;color:#fff;margin-bottom:4px}.fail-b{color:var(--mt);font-style:italic;font-size:14px;line-height:1.7}
@media(max-width:700px){.prob-stat{flex-direction:column;gap:16px;padding:24px 20px}.fail-g{grid-template-columns:1fr}}
.tools-g{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.tool-c{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);padding:36px 32px;text-align:left;transition:all .4s}.tool-c:hover{border-color:rgba(255,255,255,.1)}
.tool-badge{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;border:1px solid;border-radius:18px;padding:4px 14px;display:inline-block;margin-bottom:18px}
.tool-n{font-size:clamp(24px,2.5vw,32px);font-weight:600;color:#fff;line-height:1.15;margin-bottom:4px}
.tool-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;display:block;margin-bottom:14px}
.tool-body{color:var(--mt);font-style:italic;font-size:14px;line-height:1.75}
@media(max-width:700px){.tools-g{grid-template-columns:1fr}}
.wf-g{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-top:32px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);overflow:hidden}
.wf-s{padding:28px 20px;border-right:1px solid var(--bd)}.wf-s:last-child{border-right:none}.wf-s:hover{background:rgba(255,255,255,.015)}
.wf-top{height:3px;margin:-28px -20px 20px}.wf-n{font-family:'Bebas Neue',sans-serif;font-size:46px;line-height:1;display:block;margin-bottom:8px}
.wf-t{font-size:15px;font-weight:600;color:#fff;margin-bottom:6px}.wf-b{color:var(--mt);font-size:12px;font-style:italic;line-height:1.65}
@media(max-width:900px){.wf-g{grid-template-columns:1fr}.wf-s{border-right:none;border-bottom:1px solid var(--bd)}.wf-s:last-child{border-bottom:none}}
.td-lay{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}.td-r{display:flex;flex-direction:column;gap:28px}
.td-name{font-size:clamp(32px,3.5vw,46px);font-weight:600;color:#fff;line-height:1.1;margin:14px 0 4px}
.td-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;display:block;margin-bottom:18px}
.td-body{color:var(--mt);font-style:italic;font-size:15px;line-height:1.75;margin-bottom:28px}
.td-feat{display:flex;gap:12px;align-items:flex-start}.td-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:5px}
.td-ft{font-size:16px;font-weight:600;color:#fff;margin-bottom:3px}.td-fb{color:var(--mt);font-style:italic;font-size:13px;line-height:1.7}
.flow-p{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R);overflow:hidden}
.fp-r{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.03);font-family:'JetBrains Mono',monospace;font-size:11px}.fp-r:last-child{border-bottom:none}
.fp-l{color:var(--mt);letter-spacing:1px}.fp-v{padding:3px 12px;border-radius:5px;font-size:9px;font-weight:700}.fpb{background:var(--g);color:#000}.fps{background:var(--g);color:#000}
.neon-p{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R);padding:18px 22px;display:flex;flex-direction:column;gap:10px}
.nr{display:flex;align-items:center;gap:12px}.nl{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:2px;width:50px;flex-shrink:0}
.nw{flex:1;height:3px;background:rgba(255,255,255,.015);border-radius:4px}.nb{height:100%;width:100%;border-radius:4px}
@media(max-width:900px){.td-lay{grid-template-columns:1fr;gap:36px}}
.ben-g{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:40px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);overflow:hidden}
.ben-c{padding:32px 28px;border-right:1px solid var(--bd);border-bottom:1px solid var(--bd);text-align:left}.ben-c:nth-child(3n){border-right:none}.ben-c:nth-child(n+4){border-bottom:none}
.ben-l{font-size:17px;font-weight:600;color:#fff;margin-bottom:4px}.ben-b{color:var(--mt);font-size:13px;font-style:italic;line-height:1.65}
@media(max-width:700px){.ben-g{grid-template-columns:1fr}.ben-c{border-right:none !important}}
.rev-g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:40px}
.rev-c{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);padding:28px;transition:all .35s}.rev-c:hover{border-color:rgba(255,255,255,.1)}
.rev-stars{color:var(--y);font-size:13px;letter-spacing:2px;margin-bottom:12px}
.rev-text{color:var(--tx);font-style:italic;font-size:15px;line-height:1.7;margin-bottom:20px}
.rev-author{display:flex;align-items:center;gap:12px}
.rev-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:15px;color:#000;flex-shrink:0}
.rev-name{font-family:'JetBrains Mono',monospace;font-size:11px;color:#fff;font-weight:700}.rev-role{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--mt)}
@media(max-width:700px){.rev-g{grid-template-columns:1fr}}
.pr-g{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px;text-align:left}
.pr-c{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R2);padding:36px 28px;transition:all .35s;position:relative;display:flex;flex-direction:column}.pr-c:hover{border-color:rgba(255,255,255,.1)}
.pr-feat{border-color:rgba(255,214,0,.18);animation:glowPulse 4s ease infinite}
.pr-pop{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:7px;font-weight:700;letter-spacing:3px;background:var(--y);color:#000;padding:3px 14px;border-radius:14px}
.prt{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--y);letter-spacing:3px;margin-bottom:8px;margin-top:6px}
.prn{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#fff;letter-spacing:2px;margin-bottom:4px}
.prd{color:var(--mt);font-style:italic;font-size:13px;line-height:1.65;margin-bottom:16px;min-height:40px}
.prp{margin-bottom:2px}.prc{font-family:'JetBrains Mono',monospace;font-size:18px;color:var(--y);vertical-align:top;display:inline-block;margin-top:6px}
.prv{font-family:'Bebas Neue',sans-serif;font-size:60px;color:#fff;line-height:1}.prper{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--mt);letter-spacing:2px;display:block}
@media(max-width:700px){.pr-g{grid-template-columns:1fr}}
.faq-i{background:var(--sf);border:1px solid var(--bd);border-radius:var(--R);overflow:hidden;transition:all .3s}.faq-o{border-color:rgba(255,214,0,.12)}
.faq-q{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#fff;letter-spacing:.3px;line-height:1.4}
.faq-arr{color:var(--y);font-size:18px;flex-shrink:0;margin-left:14px}
.faq-a{color:var(--mt);font-size:14px;font-style:italic;line-height:1.75}
.fcta{padding:100px 48px;text-align:center;position:relative;z-index:2;overflow:hidden}
.fcta-glow{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);width:1000px;height:1000px;background:radial-gradient(circle,rgba(255,214,0,.035) 0%,transparent 50%);pointer-events:none;filter:blur(40px)}
.fcta-badge{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--g);letter-spacing:3px;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px}
.fcta-h{font-family:'Bebas Neue',sans-serif;font-size:clamp(44px,6vw,86px);line-height:.98;margin-bottom:14px}
.fcta-sub{color:var(--mt);font-style:italic;font-size:16px;max-width:600px;margin:0 auto 32px;line-height:1.75}
.fcta-acts{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.ft{background:rgba(6,6,8,.6);border-top:1px solid rgba(255,255,255,.03);padding:48px 48px 28px;position:relative;z-index:2}
.ft-in{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;max-width:1200px;margin:0 auto 36px}
.ft-logo{display:flex;align-items:center;margin-bottom:12px}.ft-desc{color:var(--mt);font-size:13px;font-style:italic;line-height:1.65;max-width:250px}
.ft-ct{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--y);letter-spacing:3px;margin-bottom:12px}
.ft-a{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--mt);display:block;margin-bottom:6px;cursor:pointer}.ft-a:hover{color:var(--y)}
.ft-bot{border-top:1px solid rgba(255,255,255,.03);padding-top:18px;display:flex;justify-content:space-between;max-width:1200px;margin:0 auto;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--mt)}
.ft-leg{text-align:right;max-width:400px;line-height:1.7}
@media(max-width:900px){.ft{padding:32px 20px 20px}.ft-in{grid-template-columns:1fr 1fr}.ft-bot{flex-direction:column;gap:10px;text-align:center}.ft-leg{text-align:center}}
`;


export default function SootyEdge() {
  const [showTerms, setShowTerms] = useState(false);
  useReveal();
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <style>{CSS}</style>
      <ConstellationBG />
      <Spotlight />
      <Nav />
      <Hero />
      <Ticker />
      <LiveScreenshot />
      <Problem />
      <TwoTools />
      <Workflow />
      <FlowTracker />
      <ProPlus />
      <Benefits />
      <Reviews />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer onTerms={() => setShowTerms(true)} />
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </>
  );
}
