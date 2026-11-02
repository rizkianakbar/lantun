// Lives inside our shadow root, so nothing here can leak into the page. Colours come in as
// custom properties set on .lt from the publisher's `color` option.
export const UI_CSS = `
:host{all:initial}
.lt{
  --bg:#161513;--bg2:#201e1b;--bg3:#2c2a26;--ln:rgba(255,244,228,.08);--ln2:rgba(255,244,228,.16);
  --tx:#f7f4ee;--mu:#aba69c;--hv:rgba(255,244,228,.07);
  --sh:0 1px 2px rgba(0,0,0,.2),0 18px 44px -10px rgba(0,0,0,.5);
  --ease:cubic-bezier(.2,.8,.2,1);--out:cubic-bezier(.4,0,1,1);
  --gap:12px;--cell:32px;--pad:4px;--rw:calc(var(--cell) + var(--pad)*2);--dx:16px;--dy:0px;--safe:env(safe-area-inset-bottom,0px);color-scheme:dark;
  font:400 14px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  color:var(--tx);letter-spacing:normal;word-spacing:normal;text-align:left;text-transform:none;
  white-space:normal;font-style:normal;direction:ltr;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
.lt[data-side=left]{--dx:-16px}
.lt[data-side=top]{--dx:0px;--dy:-16px}
.lt[data-side=bottom]{--dx:0px;--dy:16px}
.lt *,.lt *::before,.lt *::after{box-sizing:border-box}
/* Resets wrapped in :where() so they carry zero specificity and never beat component rules. */
:where(.lt) :where(button,input,h2,h3,p){font:inherit;color:inherit;letter-spacing:inherit;margin:0}
:where(.lt) button{background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:background-color .15s,color .15s,border-color .15s,transform .16s var(--ease),opacity .15s}
:where(.lt) button:where(:active:not(:disabled)){transform:scale(.94)}
:where(.lt) button:where(:disabled){cursor:default}
.lt :focus{outline:none}
.lt :focus-visible{outline:2px solid #fff;outline-offset:0;box-shadow:0 0 0 4px #0b0b0d}
.lt svg{display:block;flex:none}
.sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

.surface{background:var(--bg);border:1px solid var(--ln);box-shadow:var(--sh);pointer-events:auto}
.ghost{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--tx)}
.ghost.sm{width:32px;height:32px}
.ghost:disabled{opacity:.35}
@media (hover:hover){.ghost:not(:disabled):hover,.opt:hover{background:var(--hv)}}

/* Dock: the listening rail and, set apart, the reading-aids puck. Placed in px by useDockPlacement
   (0 and 1 sit flush on an edge); upright on a side, flat along the top or bottom. After a drag it
   glides to its resting place instead of jumping. */
.dock{position:fixed;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;animation:lt-in .36s var(--ease) both}
.dock[data-ready]{transition:left .32s var(--ease),top .32s var(--ease)}
.dock[data-o=h]{flex-direction:row}
.dock[data-drag]{transition:none}
.dock[data-leave]{animation:lt-out .16s var(--out) both}
.dock[data-leave] *{pointer-events:none!important}
/* Every control in the rail is one --cell square on the same grid, with --pad all round, so the
   spacing is identical between icons and at both ends, upright or flat. */
.rail{width:var(--rw);padding:var(--pad) 0;border-radius:calc(var(--rw)/2);display:flex;flex-direction:column;align-items:center}
.dock[data-o=h] .rail{width:auto;height:var(--rw);padding:0 var(--pad);flex-direction:row}
.rail .ghost,.grip,.playwrap,.time,.speed,.hide{width:var(--cell);height:var(--cell);flex:none}
.dock[data-drag] .rail,.dock[data-drag] .puck{box-shadow:0 1px 2px rgba(0,0,0,.2),0 26px 60px -12px rgba(0,0,0,.6)}
/* The handle's dots run across the dock, so it reads as a grip and not as more content. */
.grip{display:grid;place-items:center;color:var(--mu);opacity:.6;cursor:grab;touch-action:none;transition:opacity .15s}
.dock[data-o=v] .grip svg{transform:rotate(90deg)}
@media (hover:hover){.grip:hover{opacity:1}}
.dock[data-drag] .grip{cursor:grabbing;opacity:1}
/* Session-only controls unfold instead of popping in, so the dock grows smoothly. */
.xtra{display:flex;flex:none;max-height:var(--cell);max-width:var(--cell);overflow:hidden;transition:max-height .34s var(--ease),max-width .34s var(--ease),opacity .22s .1s}
.rail:not([data-active]) .xtra{opacity:0;visibility:hidden;transition:max-height .3s var(--ease),max-width .3s var(--ease),opacity .1s,visibility 0s .3s}
.dock[data-o=v] .rail:not([data-active]) .xtra{max-height:0}
.dock[data-o=h] .rail:not([data-active]) .xtra{max-width:0}
.playwrap{position:relative;display:grid;place-items:center}
.play{width:calc(var(--cell) - 6px);height:calc(var(--cell) - 6px);border-radius:50%;background:var(--a);color:var(--ai);display:grid;place-items:center;box-shadow:0 3px 10px -4px color-mix(in srgb,var(--a) 75%,transparent);transition:width .3s var(--ease),height .3s var(--ease),transform .16s var(--ease),background-color .2s,color .2s}
/* Preparing a lifelike voice: the button steps back and the ring carries the download. */
.play.load{background:var(--bg3);color:var(--a);box-shadow:none}
.play svg{animation:lt-swap .2s var(--ease)}
.ring{position:absolute;inset:0;pointer-events:none;animation:lt-fade .3s both}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring circle{fill:none;stroke:var(--ln2);stroke-width:2.5}
.ring .prg{stroke:var(--a);stroke-linecap:round;transition:stroke-dashoffset .6s var(--ease)}
.ring.load .prg{animation:lt-breathe 1.6s ease-in-out infinite}
.time{display:grid;place-items:center;font-size:10px;font-weight:600;letter-spacing:-.02em;color:var(--mu);font-variant-numeric:tabular-nums;white-space:nowrap;transition:color .2s}
.time.load{color:var(--a)}
.sep{width:16px;height:1px;flex:none;background:var(--ln2);margin:var(--pad) 0}
.dock[data-o=h] .sep{width:1px;height:16px;margin:0 var(--pad)}
.vb{position:relative}
.vb[aria-expanded=true]{background:var(--hv)}
/* The one-time voice hint points here. */
.vb[data-hint]{background:color-mix(in srgb,var(--a) 16%,transparent);color:var(--a);box-shadow:0 0 0 2px color-mix(in srgb,var(--a) 40%,transparent)}
.speed{border-radius:50%;font-size:10px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;white-space:nowrap}
.speed[aria-expanded=true]{background:var(--hv)}
.hide{color:var(--mu)}
.dot{position:absolute;top:5px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--a);box-shadow:0 0 0 2px var(--bg);animation:lt-pop-dot .25s var(--ease)}
.puck{position:relative;width:var(--rw);height:var(--rw);flex:none;border-radius:14px;display:grid;place-items:center;color:var(--tx)}
.puck[aria-expanded=true]{background:var(--bg3);border-color:var(--ln2)}
.puck .dot{top:7px;right:7px;width:7px;height:7px}
.puck[aria-expanded=true] .dot{box-shadow:0 0 0 2px var(--bg3)}
@media (hover:hover){.speed:hover{background:var(--hv)}.hide:hover{color:var(--tx)}.puck:not([aria-expanded=true]):hover{background:var(--bg2)}}

/* Tooltips name each icon for pointer users; screen readers get the aria-label instead. They open
   away from the dock's edge. */
@media (hover:hover) and (pointer:fine){
  .dock [data-tip]::after{content:attr(data-tip);position:absolute;top:50%;right:calc(100% + 14px);padding:6px 10px;border-radius:9px;background:var(--bg);border:1px solid var(--ln2);box-shadow:var(--sh);color:var(--tx);font-size:12.5px;font-weight:500;letter-spacing:0;white-space:nowrap;pointer-events:none;opacity:0;transform:translate(4px,-50%);transition:opacity .12s,transform .15s var(--ease)}
  .dock [data-tip]{position:relative}
  .dock [data-tip]:hover::after{opacity:1;transform:translate(0,-50%);transition-delay:.4s}
  .lt[data-side=left] .dock [data-tip]::after{right:auto;left:calc(100% + 14px);transform:translate(-4px,-50%)}
  .lt[data-side=left] .dock [data-tip]:hover::after{transform:translate(0,-50%)}
  .lt[data-side=bottom] .dock [data-tip]::after,.lt[data-side=top] .dock [data-tip]::after{right:auto;left:50%;top:auto;bottom:calc(100% + 14px);transform:translate(-50%,4px)}
  .lt[data-side=top] .dock [data-tip]::after{bottom:auto;top:calc(100% + 14px);transform:translate(-50%,-4px)}
  .lt[data-side=bottom] .dock [data-tip]:hover::after,.lt[data-side=top] .dock [data-tip]:hover::after{transform:translate(-50%,0)}
  .dock[data-drag] [data-tip]::after,.dock [aria-expanded=true]::after{display:none}
}

/* Hidden: a small tab on the nearest edge. While audio plays it shows only the playing bars. */
.tab{position:fixed;top:clamp(40px,calc(var(--y,.5)*100%),calc(100% - 40px));right:0;width:28px;height:56px;transform:translateY(-50%);border-radius:14px 0 0 14px;border-right:0;display:grid;place-items:center;color:var(--tx);transition:width .2s var(--ease),height .2s var(--ease);animation:lt-tab .3s .08s var(--ease) both}
.lt[data-side=left] .tab{right:auto;left:0;border-radius:0 14px 14px 0;border-right:1px solid var(--ln);border-left:0}
.lt[data-side=bottom] .tab,.lt[data-side=top] .tab{top:auto;bottom:0;right:auto;left:clamp(40px,calc(var(--x,.5)*100%),calc(100% - 40px));width:56px;height:28px;transform:translateX(-50%);border-radius:14px 14px 0 0;border:1px solid var(--ln);border-bottom:0}
.lt[data-side=top] .tab{bottom:auto;top:0;border-radius:0 0 14px 14px;border-top:0;border-bottom:1px solid var(--ln)}
.tab:active{transform:translateY(-50%)}
.lt[data-side=bottom] .tab:active,.lt[data-side=top] .tab:active{transform:translateX(-50%)}
.tab[data-leave]{animation:lt-tab-out .14s var(--out) both;pointer-events:none}
@media (hover:hover){.lt[data-side=left] .tab:hover,.lt[data-side=right] .tab:hover{width:34px}.lt[data-side=bottom] .tab:hover,.lt[data-side=top] .tab:hover{height:34px}}

/* Popovers sit next to the dock (placed by useAnchor) and grow out of it: --px/--py point back
   toward the dock. */
.pop,.toast{position:fixed;top:var(--top,50%);left:var(--left,auto);animation:lt-pop .22s var(--ease) both}
.pop[data-leave],.toast[data-leave]{animation:lt-pop-out .14s var(--out) both;pointer-events:none}
.pop{width:min(320px,calc(100% - 24px));max-height:calc(100% - 24px);border-radius:20px;display:flex;flex-direction:column}
.speedpop{width:min(300px,calc(100% - 24px));padding:16px 16px 14px}
.label{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;font-weight:600;color:var(--mu);margin-bottom:8px}
.label b{font-size:15px;font-weight:650;color:var(--tx);font-variant-numeric:tabular-nums}
.stepper{display:flex;align-items:center;gap:8px}
.range{flex:1;-webkit-appearance:none;appearance:none;height:28px;background:transparent;cursor:pointer}
.range::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(to right,var(--a) var(--p),var(--ln2) var(--p))}
.range::-moz-range-track{height:4px;border-radius:4px;background:linear-gradient(to right,var(--a) var(--p),var(--ln2) var(--p))}
.range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7px;border-radius:50%;background:#fff;border:0;box-shadow:0 1px 4px rgba(0,0,0,.45)}
.range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;border:0;box-shadow:0 1px 4px rgba(0,0,0,.45)}
.range:focus-visible{box-shadow:none;outline:2px solid #fff;outline-offset:2px;border-radius:6px}
.presets{display:flex;gap:4px;margin-top:8px}
.presets button{flex:1;height:30px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--mu);font-variant-numeric:tabular-nums}
.presets button[aria-pressed=true]{background:var(--bg3);color:var(--tx)}
@media (hover:hover){.presets button:hover{color:var(--tx)}}

.voicepop{padding:6px}
.voices{display:flex;flex-direction:column;gap:2px;min-height:0;max-height:min(540px,calc(100vh - 40px));overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(255,244,228,.22) transparent;scroll-padding-top:58px}
.group{position:sticky;top:0;z-index:1;display:flex;flex-direction:column;gap:1px;padding:10px 10px 6px;background:var(--bg)}
.group+.opt{margin-top:0}
.opt+.group{margin-top:6px;box-shadow:0 -1px 0 var(--ln)}
.group b{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--mu)}
.group b svg{color:var(--a)}
.group:first-child b{color:var(--tx)}
.group span{font-size:11.5px;color:var(--mu);opacity:.8}
.opt{display:flex;align-items:center;gap:11px;width:100%;min-height:50px;padding:6px 10px;border-radius:14px;text-align:left}
.opt[aria-checked=true]{background:var(--bg2)}
.av{flex:none;width:32px;height:32px;border-radius:50%;background:var(--bg3);display:grid;place-items:center;font-size:13.5px;font-weight:700;color:var(--tx);transition:background-color .2s,color .2s}
.opt[aria-checked=true] .av{background:var(--a);color:var(--ai)}
.opt .n{flex:1;min-width:0}
.opt .n b{display:block;font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opt .sub{display:block;font-size:12px;color:var(--mu);margin-top:1px}
.opt .tick{color:var(--a);opacity:0;transform:scale(.6);transition:opacity .15s,transform .2s var(--ease)}
.opt[aria-checked=true] .tick{opacity:1;transform:none}
.tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:5px;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;vertical-align:1px;color:var(--a);background:color-mix(in srgb,var(--a) 16%,transparent)}
.empty,.tip{font-size:12.5px;color:var(--mu);line-height:1.5}
.empty{padding:10px}
.tip{margin:6px;padding:10px 12px;border-radius:12px;background:var(--bg2)}

/* Accessibility panel */
.panel{width:min(368px,calc(100% - 24px))}
.phead{display:flex;align-items:center;gap:4px;padding:12px 10px 4px 18px}
.phead h2{flex:1;font-size:16px;font-weight:650;letter-spacing:-.01em}
.reset{height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:600;color:var(--a)}
.reset:disabled{color:var(--mu);opacity:.5}
@media (hover:hover){.reset:not(:disabled):hover{background:var(--hv)}}
.body{overflow:auto;padding:0 14px 16px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(255,244,228,.22) transparent}
.panel h3{margin:16px 2px 8px;font-size:12.5px;font-weight:600;color:var(--mu)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.pchip{height:34px;padding:0 13px 0 10px;border-radius:999px;display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;background:var(--bg2);border:1px solid var(--ln)}
.pchip svg{color:var(--mu)}
.pchip[aria-pressed=true]{background:var(--a);color:var(--ai);border-color:transparent}
.pchip[aria-pressed=true] svg{color:inherit}
@media (hover:hover){.pchip[aria-pressed=false]:hover{border-color:var(--ln2)}}
.hint{margin:8px 2px 0;min-height:36px;font-size:12.5px;line-height:1.45;color:var(--mu)}

.size{display:flex;align-items:center;gap:6px;padding:6px;border-radius:14px;background:var(--bg2);border:1px solid var(--ln);margin-bottom:6px}
.step{width:44px;height:44px;border-radius:10px;background:var(--bg3);display:grid;place-items:center}
.step:disabled{opacity:.35}
@media (hover:hover){.step:not(:disabled):hover{background:#33333b}}
.step .a{font-weight:700;line-height:1}
.step .sm{font-size:13px}
.step .lg{font-size:20px}
.val{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
.val span{font-size:11.5px;color:var(--mu)}
.val b{font-size:15px;font-weight:650;font-variant-numeric:tabular-nums;line-height:1.1}
.pips{display:flex;gap:3px}
.pips i{display:block;width:12px;height:3px;border-radius:2px;background:var(--ln2);transition:background-color .15s}
.pips i.f{background:var(--a)}

.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.tiles.two{grid-template-columns:repeat(2,1fr)}
.tile{position:relative;min-height:76px;padding:12px 6px 10px;border-radius:14px;background:var(--bg2);border:1px solid var(--ln);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:12.5px;font-weight:600;line-height:1.2;text-align:center}
.tile svg{color:var(--mu);transition:color .15s}
.tile[aria-checked=true],.tile[data-on]{background:color-mix(in srgb,var(--a) 15%,var(--bg2));border-color:color-mix(in srgb,var(--a) 65%,transparent)}
.tile[aria-checked=true] svg,.tile[data-on] svg{color:var(--a)}
.tile .ck{position:absolute;top:7px;right:7px;width:16px;height:16px;border-radius:50%;background:var(--a);color:var(--ai);display:grid;place-items:center;transform:scale(0);transition:transform .18s var(--ease)}
.tile[aria-checked=true] .ck{transform:scale(1)}
.tile .ck svg{color:inherit;stroke-width:3.2}
.tl{display:flex;flex-direction:column;align-items:center;gap:6px}
/* Text tiles sit two to a row, so they lie flat to keep the panel short. */
.tiles.two .tile{flex-direction:row;justify-content:flex-start;min-height:54px;padding:8px 12px;gap:10px;text-align:left}
.tiles.two .tl{align-items:flex-start;gap:5px}
@media (hover:hover){.tile:hover{border-color:var(--ln2)}}

.swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.sw{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 2px 7px;border-radius:12px;font-size:11.5px;font-weight:600;color:var(--mu);white-space:nowrap}
.sw .prev{width:100%;max-width:48px;aspect-ratio:1;border-radius:11px;display:grid;place-items:center;font-size:16px;font-weight:700;border:1px solid var(--ln2);transition:box-shadow .15s}
.sw .invert span{background:linear-gradient(135deg,#18181b 50%,#f4f4f5 50%);-webkit-background-clip:text;background-clip:text}
.sw[aria-checked=true]{color:var(--tx)}
.sw[aria-checked=true] .prev{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--a)}
@media (hover:hover){.sw[aria-checked=false]:hover{color:var(--tx)}}
.toggle{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;margin-top:6px;padding:0 12px;border-radius:14px;background:var(--bg2);border:1px solid var(--ln);font-size:13px;font-weight:600;text-align:left}
.toggle svg{color:var(--mu)}
.toggle span:first-of-type{flex:1}
.knobs{position:relative;flex:none;width:36px;height:22px;border-radius:999px;background:var(--bg3);transition:background-color .18s}
.knobs::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s var(--ease)}
.toggle[aria-checked=true] .knobs{background:var(--a)}
.toggle[aria-checked=true] .knobs::after{transform:translateX(14px)}

/* Toast beside the dock (placed like a popover) */
.toast{max-width:min(340px,calc(100% - 24px));display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border-radius:16px;font-size:13px;font-weight:500}
.toast span{flex:1;min-width:0}
.btn{height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap}
.btn.primary{background:var(--a);color:var(--ai)}

/* Equaliser bars: animate only while audio plays */
.bars{display:inline-flex;align-items:center;gap:2px;height:12px}
.bars i{display:block;width:2.5px;height:100%;border-radius:2px;background:var(--a);transform:scaleY(.35);transform-origin:50% 50%}
.on .bars i{animation:lt-bar .9s ease-in-out infinite alternate}
.on .bars i:nth-child(2){animation-delay:-.45s;animation-duration:.7s}
.on .bars i:nth-child(3){animation-delay:-.2s;animation-duration:1.1s}
.on .bars i:nth-child(4){animation-delay:-.6s;animation-duration:.8s}

/* Play from here */
.here{position:fixed;top:0;left:0;width:28px;height:28px;border-radius:50%;background:var(--a);color:var(--ai);display:grid;place-items:center;box-shadow:0 4px 12px -2px rgba(0,0,0,.35);pointer-events:auto;opacity:0;transform:scale(.6);transition:opacity .15s,transform .18s var(--ease)}
.here.on{opacity:1;transform:scale(1)}
.selchip{position:fixed;top:0;left:0;height:34px;padding:0 13px 0 9px;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;animation:lt-in-soft .2s var(--ease) both}
.selchip .disc{width:20px;height:20px;border-radius:50%;background:var(--a);color:var(--ai);display:grid;place-items:center}

/* Reading guide & mask */
.guide{position:fixed;left:0;right:0;top:0;height:30px;margin-top:-15px;pointer-events:none;background:rgba(255,214,90,.16);border-top:2px solid rgba(240,180,0,.85);border-bottom:2px solid rgba(240,180,0,.85);will-change:transform}
.shade{position:fixed;left:0;right:0;top:0;height:100%;pointer-events:none;background:rgba(8,8,10,.66);will-change:transform}

@keyframes lt-in{from{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.96)}}
@keyframes lt-out{to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.96)}}
@keyframes lt-tab{from{opacity:0}}
@keyframes lt-tab-out{to{opacity:0}}
@keyframes lt-pop{from{opacity:0;transform:translate(var(--px,0px),var(--py,0px)) scale(.97)}}
@keyframes lt-pop-out{to{opacity:0;transform:translate(calc(var(--px,0px)*.6),calc(var(--py,0px)*.6)) scale(.98)}}
@keyframes lt-sheet{from{opacity:0;transform:translateY(24px)}}
@keyframes lt-sheet-out{to{opacity:0;transform:translateY(16px)}}
@keyframes lt-in-soft{from{opacity:0;transform:translateY(8px) scale(.97)}}
@keyframes lt-swap{from{opacity:0;transform:scale(.7)}}
@keyframes lt-fade{from{opacity:0}}
@keyframes lt-pop-dot{from{transform:scale(0)}}
@keyframes lt-bar{to{transform:scaleY(1)}}
@keyframes lt-breathe{50%{opacity:.45}}

/* Phones: panels become bottom sheets */
@media (max-width:540px){
  .lt{--gap:8px;--cell:40px}
  /* The flat bottom dock is fixed on phones: no handle, and thumb-sized targets. */
  .grip{display:none}
  .speed,.time{font-size:11px}
  .puck{border-radius:16px}
  .pop,.toast{top:auto;bottom:calc(8px + var(--safe));left:8px;right:8px;width:auto;max-width:none;transform-origin:center bottom;animation-name:lt-sheet}
  .pop[data-leave],.toast[data-leave]{animation-name:lt-sheet-out}
  .pop{max-height:min(80vh,640px);border-radius:24px}
}
/* Motion off: every animation and transition takes no time. Zero durations rather than
   animation:none, which would replay every entrance animation (the dock and an open panel sliding
   in again) the moment "pause animations" is switched back off. */
@media (prefers-reduced-motion:reduce){.lt *,.lt *::before,.lt *::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}}
.lt[data-still] *,.lt[data-still] *::before,.lt[data-still] *::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}
/* Printing the article prints the article: no dock, guide, mask or panels on every page. */
@media print{.lt{display:none!important}}
@media (forced-colors:active){
  .surface,.play,.speed,.pchip,.tile,.size,.toggle,.sw .prev,.disc{border:1px solid CanvasText}
  .ring .prg,.pips i.f,.knobs,.dot{background:Highlight;stroke:Highlight}
  .tile[aria-checked=true],.tile[data-on],.pchip[aria-pressed=true]{outline:2px solid Highlight}
}
`;
