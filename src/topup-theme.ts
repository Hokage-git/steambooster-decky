export const TOPUP_ID='booster-checkout__sb_topup';
export const TOPUP_WIDTH=680;
export const TOPUP_HEIGHT=600;
const css=`
[data-sb-decky-topup] .decky-help { margin:16px 0 0; text-align:center; color:#a7bed1; font-size:13px; }
html[data-sb-decky-topup],html[data-sb-decky-topup] body { background:#101923; height:100%; overflow:auto; color:#f3f7fb; }
[data-sb-decky-topup] body { padding:20px; font:16px/1.45 "Motiva Sans",Arial,sans-serif; }
[data-sb-decky-topup] .stack { width:100%; max-width:640px; margin:0 auto; }
[data-sb-decky-topup] .root { width:100%; height:auto; min-height:440px; padding:24px; border:1px solid #36495d; border-radius:16px; background:linear-gradient(145deg,#223348,#172330); box-shadow:0 12px 32px #0004; gap:16px; }
[data-sb-decky-topup] .root::before { content:'Пополнение Steam'; font-size:26px; font-weight:700; line-height:1.2; }
[data-sb-decky-topup] .header { height:48px; }
[data-sb-decky-topup] .logo { height:24px; }
[data-sb-decky-topup] button { font:600 16px/1.3 "Motiva Sans",Arial,sans-serif; border-radius:8px; cursor:pointer; transition:background .12s ease; }
[data-sb-decky-topup] button:focus-visible,[data-sb-decky-topup] input:focus-visible { outline:3px solid #66c9ff; outline-offset:3px; }
[data-sb-decky-topup] button:disabled { cursor:default; }
[data-sb-decky-topup] .menu-trigger { font-size:14px; padding:12px 16px; height:48px; color:#deebf7; background:#31465b; }
[data-sb-decky-topup] .menu-overlay { top:124px; right:24px; z-index:20; }
[data-sb-decky-topup] .menu-overlay button { min-height:44px; }
[data-sb-decky-topup] .body-slot > .row { height:56px; margin:0; gap:12px; }
[data-sb-decky-topup] .amount-cell { height:56px; border-radius:8px; background:#101a26; border:1px solid #49617a; padding:0 16px; }
[data-sb-decky-topup] .amount-input { font-size:22px; line-height:1.3; }
[data-sb-decky-topup] .picker .trigger { height:56px; padding:12px 16px; background:#31465b; color:#f3f7fb; border:1px solid #49617a; border-radius:8px; }
[data-sb-decky-topup] .picker .menu { top:64px; z-index:30; border-radius:8px; background:#26394d; box-shadow:0 10px 28px #0008; }
[data-sb-decky-topup] .picker .menu button { min-height:48px; padding:12px; }
[data-sb-decky-topup] .picker .name { font-size:16px; }
[data-sb-decky-topup] .info-rows { margin:0; display:flex; flex-direction:column; gap:10px; }
[data-sb-decky-topup] .info-rows .row { height:26px; }
[data-sb-decky-topup] .info-rows .label,[data-sb-decky-topup] .info-rows .value { font-size:16px; line-height:24px; }
[data-sb-decky-topup] .info-rows .label { opacity:.75; }
[data-sb-decky-topup] .box { height:52px; margin:0; }
[data-sb-decky-topup] .box .label-cell { flex:1 1 auto; border-color:#31465b; padding:0 14px; }
[data-sb-decky-topup] .box .label { font-size:15px; }
[data-sb-decky-topup] .box .input-cell { flex:0 1 180px; background:#31465b; }
[data-sb-decky-topup] .desired-input { font-size:20px; }
[data-sb-decky-topup] .pay { border-radius:8px; min-height:56px; margin:0; padding:14px 20px; font-size:18px; color:white; background:linear-gradient(100deg,#2089dd,#116dc0); box-shadow:0 4px 14px #0074cc33; }
[data-sb-decky-topup] .pay:hover:not(:disabled) { background:#259ced; }
[data-sb-decky-topup] .pay:disabled { background:#2b3c4d; color:#a3b5c7; box-shadow:none; }
[data-sb-decky-topup] .promo-gap,[data-sb-decky-topup] .promo { display:none; }
[data-sb-decky-topup] .promo { width:100%; height:64px; padding:8px 16px; border:1px solid #36495d; border-radius:12px; background:#1d2c3c; }
[data-sb-decky-topup] .promo-btn { font-size:15px; min-height:44px; height:auto; padding:12px 18px; color:#e5f5ff; background:#314d65; }
[data-sb-decky-topup] .promo-money { display:none; }
[data-sb-decky-topup] .footer { font-size:12px; height:auto; min-height:20px; }
@media(max-width:520px){ [data-sb-decky-topup] body{padding:12px;} [data-sb-decky-topup] .root{padding:16px;gap:12px;} [data-sb-decky-topup] .box .label{font-size:12px;} [data-sb-decky-topup] .box .input-cell{flex-basis:110px;} }
`;
export function topupHTML(html:string):string {
 return html.replace('<html ', '<html data-sb-decky-topup ').replace('</head>',`<style data-sb-decky-theme>${css}</style></head>`).replace('</body>','<p class="decky-help">A — выбрать или ввести сумму · B — назад</p></body>');
}
