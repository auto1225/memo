import{r as e}from"./rolldown-runtime-CkqCuyE9.js";import{i as t,t as n}from"./react-BkmU5sr7.js";var r=e(t(),1),i=n(),a=`https://unpkg.com/pagedjs/dist/paged.polyfill.js`;function o({html:e,title:t,onClose:n}){let a=(0,r.useRef)(null),[o,s]=(0,r.useState)(`페이지 분할 중...`);(0,r.useEffect)(()=>{function e(e){e.key===`Escape`&&n()}return document.addEventListener(`keydown`,e),()=>document.removeEventListener(`keydown`,e)},[n]),(0,r.useEffect)(()=>{let n=a.current;if(!n)return;n.srcdoc=l(e,t);let r=!1,i=()=>{let e=0,t=setInterval(()=>{e+=200;try{let e=n.contentDocument?.querySelectorAll(`.pagedjs_page`);e&&e.length>0&&(clearInterval(t),r||s(`${e.length} 페이지 — 인쇄/PDF 가능`))}catch{}e>15e3&&(clearInterval(t),r||s(`준비 완료`))},200)};return n.addEventListener(`load`,i),()=>{r=!0,n.removeEventListener(`load`,i)}},[e,t]);function c(){let e=a.current;e?.contentWindow&&(e.contentWindow.focus(),e.contentWindow.print())}return(0,i.jsx)(`div`,{className:`jan-print-modal`,onClick:n,children:(0,i.jsxs)(`div`,{className:`jan-print-shell`,onClick:e=>e.stopPropagation(),children:[(0,i.jsxs)(`div`,{className:`jan-print-bar`,children:[(0,i.jsx)(`span`,{className:`jan-print-title`,children:`인쇄 미리보기 — A4`}),(0,i.jsx)(`span`,{className:`jan-print-status`,children:o}),(0,i.jsx)(`div`,{style:{flex:1}}),(0,i.jsx)(`button`,{onClick:c,className:`jan-print-btn primary`,children:`인쇄 / PDF`}),(0,i.jsx)(`button`,{onClick:n,className:`jan-print-btn`,children:`닫기 (Esc)`})]}),(0,i.jsx)(`iframe`,{ref:a,className:`jan-print-iframe`,title:`인쇄 미리보기`})]})})}function s(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function c(e){return e.replace(/\\/g,`\\\\`).replace(/"/g,`\\"`)}function l(e,t){return`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${s(t)}</title>
<style>
@page { size: A4; margin: 20mm;
  @top-right { content: "${c(t)}"; font-size: 9pt; color:#888; }
  @bottom-right { content: "Page " counter(page) " / " counter(pages); font-size:9pt; color:#888; }
}
html,body{margin:0;padding:0;}
body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:11pt;line-height:1.65;color:#222;background:#ccc;}
.pagedjs_page{margin:16px auto !important;box-shadow:0 4px 16px rgba(0,0,0,0.18);background:#fff;}
h1{font-size:22pt;font-weight:700;margin:1em 0 0.5em;}
h2{font-size:17pt;font-weight:700;margin:1em 0 0.4em;}
h3{font-size:14pt;font-weight:600;margin:0.8em 0 0.3em;}
p{margin:0.5em 0;}
table{border-collapse:collapse;margin:0.6em 0;width:100%;}
th,td{border:1px solid #999;padding:4px 8px;}
th{background:#f0f0f0;font-weight:600;}
pre,code{font-family:"D2Coding",monospace;background:#f5f5f5;padding:0 4px;border-radius:3px;}
pre{padding:8px 12px;overflow-x:auto;}
blockquote{border-left:3px solid #D97757;padding:4px 12px;margin:0.6em 0;color:#555;background:rgba(217,119,87,0.05);}
img{max-width:100%;height:auto;}
@media print{body{background:white;}.pagedjs_page{box-shadow:none !important;margin:0 !important;}}
</style></head><body>
<div id="content">${e}</div>
<script src="${a}"><\/script>
</body></html>`}export{o as PrintPreview};
//# sourceMappingURL=PrintPreview-DSBT-ZDm.js.map