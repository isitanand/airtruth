export const styles = /* css */ `
:host { display: block; font-family: var(--w-font-body); color: var(--w-color-ink); -webkit-font-smoothing: antialiased; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
p { margin: 0; }
ul { margin: 0; padding: 0; list-style: none; }

.w { display: grid; gap: 10px; font-variant-numeric: tabular-nums; padding: 14px; border-radius: var(--w-radius-surface);
  background: var(--w-color-surface); border: 1px solid var(--w-color-line);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--w-color-ink) 6%, transparent); }
.top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.badge.calm { background: var(--w-color-surface-2); color: var(--w-color-muted); }
.badge.check { background: var(--w-color-check-soft); color: var(--w-color-check); }
.badge.alert { background: var(--w-color-alert-soft); color: var(--w-color-alert); }
.badge.ok { background: var(--w-color-ok-soft); color: var(--w-color-ok); }
.payout-pill { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 8px;
  background: color-mix(in srgb, var(--w-color-action) 11%, transparent); color: var(--w-color-action); }

.headline { font-size: 16px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; }
.detail { font-size: 13px; color: var(--w-color-muted); line-height: 1.45; }

.radar-banner { padding: 10px 12px; border-radius: 10px; background: var(--w-color-surface-2);
  border-left: 3px solid var(--w-color-action); display: grid; gap: 3px; }
.radar-banner.rebutted { background: var(--w-color-alert-soft); border-left-color: var(--w-color-alert); }
.radar-kicker { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--w-color-alert); }
.radar-title { font-size: 13.5px; font-weight: 700; color: var(--w-color-ink); }
.radar-body { font-size: 12.5px; color: var(--w-color-ink); line-height: 1.4; }

.facts { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; }
.facts li { display: inline-flex; align-items: center; gap: 5px; color: var(--w-color-ink); }
.facts .warn { color: var(--w-color-alert); font-weight: 600; }
.facts .present svg { color: var(--w-color-ok); }

.actions { display: grid; gap: 8px; }
button { font: inherit; cursor: pointer; }
.btn { min-height: 40px; padding: 0 14px; border-radius: var(--w-radius-control); font-size: 13px; font-weight: 600;
  border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.btn.primary { background: var(--w-color-action); color: var(--w-color-action-ink); }
.btn.primary:hover { background: var(--w-color-action-strong); }
.btn.secondary { background: var(--w-color-surface); color: var(--w-color-ink); border-color: var(--w-color-line); }
.btn[disabled] { opacity: .6; cursor: progress; }

.packet { padding: 11px; border-radius: 10px; background: #0b0f17; color: #f3f4f2; display: grid; gap: 8px; }
.packet-head { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; }
.packet-head code { font-family: 'JetBrains Mono Variable', ui-monospace, monospace; color: #9a93ff; font-size: 11px; }
.packet-amount { font-size: 18px; font-weight: 800; color: #ffffff; }
.packet-meta { font-size: 11.5px; color: #b7becb; line-height: 1.4; }
.packet-sig { font-family: 'JetBrains Mono Variable', ui-monospace, monospace; font-size: 10.5px; color: #8be0b8; word-break: break-all;
  background: rgba(255,255,255,.06); padding: 6px 8px; border-radius: 6px; }
.copy-btn { background: rgba(255,255,255,.12); color: #fff; border: 0; border-radius: 6px; padding: 6px 10px;
  font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; justify-self: start; }
.copy-btn:hover { background: #3a2bff; }

@keyframes radarFlash {
  0% { box-shadow: 0 0 0 0 rgba(58,43,255,0.65); }
  40% { box-shadow: 0 0 0 8px rgba(200,16,46,0.35); border-color: #c8102e; }
  100% { box-shadow: 0 2px 8px color-mix(in srgb, var(--w-color-ink) 6%, transparent); }
}
.w.radar-flash { animation: radarFlash 1.4s cubic-bezier(.16,1,.3,1); }
`
