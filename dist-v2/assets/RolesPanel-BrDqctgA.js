import{r as e}from"./rolldown-runtime-CkqCuyE9.js";import{i as t,t as n}from"./react-BkmU5sr7.js";var r=e(t(),1),i=()=>{let e=new Date;return`${e.getFullYear()}. ${e.getMonth()+1}. ${e.getDate()}.`},a=()=>`<h1>PRD — [기능명]</h1>
<table><tbody>
<tr><th>문서 ID</th><td>PRD-${new Date().getFullYear()}-001</td><th>상태</th><td>초안</td></tr>
<tr><th>작성자</th><td></td><th>업데이트</th><td>${i()}</td></tr>
</tbody></table>
<h2>문제 정의</h2>
<table><tbody>
<tr><th>문제</th><td>고객의 어떤 문제를 해결하나</td></tr>
<tr><th>대상 사용자</th><td>세그먼트·볼륨</td></tr>
<tr><th>현재 우회책</th><td>지금은 어떻게 해결?</td></tr>
<tr><th>안 하면 잃는 것</th><td>기회비용</td></tr>
</tbody></table>
<h2>성공 지표</h2>
<table><tbody>
<tr><th>지표</th><th>Baseline</th><th>목표</th><th>측정</th></tr>
<tr><td>Primary</td><td></td><td></td><td></td></tr>
<tr><td>Secondary</td><td></td><td></td><td></td></tr>
<tr><td>Guardrail</td><td></td><td></td><td></td></tr>
</tbody></table>
<h2>요구사항</h2>
<table><tbody>
<tr><th>우선순위</th><th>요구사항</th><th>수용 기준</th></tr>
<tr><td>MUST</td><td></td><td>Given/When/Then</td></tr>
<tr><td>SHOULD</td><td></td><td></td></tr>
<tr><td>COULD</td><td></td><td></td></tr>
</tbody></table>
<h2>릴리스 계획</h2>
<ul><li>디자인 리뷰: </li><li>개발 시작: </li><li>QA: </li><li>출시: </li></ul>`,o=()=>`<h1>스프린트 #__</h1>
<table><tbody>
<tr><th>기간</th><td>${i()} ~ </td><th>골</th><td>한 문장</td></tr>
<tr><th>Capacity</th><td>__일 × __명</td><th>Velocity</th><td>지난 평균 __</td></tr>
</tbody></table>
<h2>커밋 티켓</h2>
<table><tbody>
<tr><th>#</th><th>티켓</th><th>담당</th><th>SP</th><th>리스크</th></tr>
<tr><td>1</td><td></td><td></td><td></td><td></td></tr>
<tr><td>2</td><td></td><td></td><td></td><td></td></tr>
</tbody></table>
<h2>리스크 & 완화책</h2>
<ul><li></li></ul>`,s=()=>`<h1>[논문 제목]</h1>
<p><b>저자:</b> __ &nbsp; <b>소속:</b> __ &nbsp; <b>이메일:</b> __</p>
<h2>Abstract</h2>
<p>3~5문장. 배경·문제·기여·결과를 요약.</p>
<p><b>Keywords:</b> __, __, __</p>
<h2>1. Introduction</h2>
<p>연구 동기와 기여를 제시.</p>
<h2>2. Related Work</h2>
<p>관련 연구 비교.</p>
<h2>3. Method</h2>
<p>제안 기법 설명.</p>
<h2>4. Experiments</h2>
<p>실험 설정과 결과.</p>
<h2>5. Conclusion</h2>
<p>결론과 향후 연구.</p>
<h2>References</h2>
<p>인용 도구로 자동 채워짐.</p>`,c=()=>`<h1>회의록 — [주제]</h1>
<table><tbody>
<tr><th>일시</th><td>${i()}</td><th>장소</th><td></td></tr>
<tr><th>참석</th><td></td><th>주관</th><td></td></tr>
</tbody></table>
<h2>안건</h2>
<ol><li></li><li></li></ol>
<h2>논의 내용</h2>
<p></p>
<h2>결정 사항</h2>
<ul><li></li></ul>
<h2>액션 아이템</h2>
<table><tbody>
<tr><th>담당</th><th>내용</th><th>마감</th></tr>
<tr><td></td><td></td><td></td></tr>
</tbody></table>`,l=()=>`<h1>개발 일지 — ${i()}</h1>
<h2>오늘 한 일</h2><ul><li></li></ul>
<h2>막힌 곳 / 의문점</h2><ul><li></li></ul>
<h2>내일 할 일</h2><ul><li></li></ul>
<h2>학습 메모</h2><p></p>
<h2>커밋 / PR</h2><ul><li></li></ul>`,u=()=>`<h1>학습 노트 — [주제]</h1>
<h2>핵심 개념</h2>
<ul><li></li></ul>
<h2>예제</h2>
<pre><code>// 코드 예제</code></pre>
<h2>이해 점검</h2>
<ol><li></li><li></li></ol>
<h2>참고 자료</h2>
<ul><li></li></ul>`,d=()=>`<h1>주간 보고 — ${i()}</h1>
<h2>이번 주 성과</h2>
<ul><li></li></ul>
<h2>지표</h2>
<table><tbody><tr><th>지표</th><th>이번주</th><th>지난주</th><th>Δ</th></tr>
<tr><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>리스크</h2>
<ul><li></li></ul>
<h2>다음 주 계획</h2>
<ul><li></li></ul>`,f=()=>`<h1>디자인 리뷰 — [프로젝트]</h1>
<table><tbody>
<tr><th>일시</th><td>${i()}</td><th>Figma</th><td>link</td></tr>
<tr><th>참석자</th><td></td><th>단계</th><td>와이어/시안/고충실도</td></tr>
</tbody></table>
<h2>리뷰 목표</h2><p></p>
<h2>좋았던 점</h2><ul><li></li></ul>
<h2>개선 포인트</h2>
<table><tbody><tr><th>P</th><th>이슈</th><th>제안</th><th>결정</th></tr>
<tr><td>P0</td><td></td><td></td><td></td></tr>
<tr><td>P1</td><td></td><td></td><td></td></tr></tbody></table>`,p=()=>`<h1>유저 인터뷰 — [참여자]</h1>
<table><tbody>
<tr><th>일시</th><td>${i()}</td><th>인터뷰어</th><td></td></tr>
<tr><th>참여자</th><td>익명코드</td><th>녹음</th><td>예/아니오</td></tr>
</tbody></table>
<h2>배경</h2><p></p>
<h2>주요 발언 (인용)</h2><blockquote>" "</blockquote>
<h2>인사이트</h2><ul><li></li></ul>
<h2>다음 액션</h2><ul><li></li></ul>`,m=()=>`<h1>독서 메모 — [책 제목]</h1>
<p><b>저자:</b> __ &nbsp; <b>출판사:</b> __ &nbsp; <b>읽은 날:</b> ${i()}</p>
<h2>핵심 메시지 (한 문장)</h2><blockquote></blockquote>
<h2>인상 깊은 구절</h2>
<ul><li>p.__: ""</li></ul>
<h2>나의 적용</h2><ul><li></li></ul>
<h2>별점</h2><p>__/5</p>`,h=[{id:`pm`,name:`PM / PO`,desc:`제품·스프린트·지표`,templates:[{name:`PRD`,html:a()},{name:`스프린트 계획`,html:o()},{name:`주간 보고`,html:d()}]},{id:`researcher`,name:`연구자`,desc:`논문·실험·리뷰`,templates:[{name:`논문 골조 (IMRaD)`,html:s()},{name:`학습 노트`,html:u()},{name:`독서 메모`,html:m()}]},{id:`developer`,name:`개발자`,desc:`개발 일지·회고`,templates:[{name:`개발 일지`,html:l()},{name:`학습 노트`,html:u()},{name:`회의록`,html:c()}]},{id:`designer`,name:`디자이너`,desc:`리뷰·인터뷰`,templates:[{name:`디자인 리뷰`,html:f()},{name:`유저 인터뷰`,html:p()}]},{id:`student`,name:`학생`,desc:`학습·과제`,templates:[{name:`학습 노트`,html:u()},{name:`독서 메모`,html:m()}]},{id:`lifestyle`,name:`라이프`,desc:`일상·취미`,templates:[{name:`레시피`,html:`<h1>레시피 — [요리명]</h1>
<table><tbody>
<tr><th>인분</th><td>__</td><th>시간</th><td>__분</td><th>난이도</th><td>★★☆</td></tr>
</tbody></table>
<h2>재료</h2>
<table><tbody><tr><th>재료</th><th>분량</th></tr>
<tr><td></td><td></td></tr></tbody></table>
<h2>조리 순서</h2>
<ol><li></li></ol>
<h2>팁</h2><ul><li></li></ul>`},{name:`여행 일정`,html:`<h1>여행 일정 — [목적지]</h1>
<table><tbody>
<tr><th>기간</th><td>${i()} ~ </td><th>인원</th><td></td></tr>
<tr><th>예산</th><td></td><th>숙소</th><td></td></tr>
</tbody></table>
<h2>일정</h2>
<table><tbody><tr><th>Day</th><th>오전</th><th>오후</th><th>저녁</th></tr>
<tr><td>1</td><td></td><td></td><td></td></tr>
<tr><td>2</td><td></td><td></td><td></td></tr></tbody></table>
<h2>준비물</h2><ul><li></li></ul>`},{name:`회의록`,html:c()}]}],g=n();function _({editor:e,onClose:t}){let[n,i]=(0,r.useState)(h[0].id),a=h.find(e=>e.id===n)||h[0];if(!e)return null;function o(n){e&&(e.chain().focus().insertContent(n).run(),t())}return(0,g.jsx)(`div`,{className:`jan-modal-overlay`,onClick:t,children:(0,g.jsxs)(`div`,{className:`jan-modal jan-roles-modal`,onClick:e=>e.stopPropagation(),children:[(0,g.jsxs)(`div`,{className:`jan-modal-head`,children:[(0,g.jsx)(`h3`,{children:`역할 팩 — 템플릿 삽입`}),(0,g.jsx)(`button`,{className:`jan-modal-close`,onClick:t,children:`닫기`})]}),(0,g.jsxs)(`div`,{className:`jan-modal-body jan-roles-body`,children:[(0,g.jsx)(`aside`,{className:`jan-roles-sidebar`,children:h.map(e=>(0,g.jsxs)(`button`,{className:`jan-roles-tab`+(e.id===n?` is-active`:``),onClick:()=>i(e.id),children:[(0,g.jsx)(`div`,{className:`jan-roles-name`,children:e.name}),(0,g.jsx)(`div`,{className:`jan-roles-desc`,children:e.desc})]},e.id))}),(0,g.jsxs)(`section`,{className:`jan-roles-content`,children:[(0,g.jsx)(`div`,{className:`jan-roles-title`,children:a.name}),(0,g.jsx)(`div`,{className:`jan-roles-templates`,children:a.templates.map((e,t)=>(0,g.jsx)(`button`,{className:`jan-roles-template`,onClick:()=>o(e.html),title:`클릭하면 현재 메모에 삽입`,children:e.name},t))}),(0,g.jsx)(`div`,{className:`jan-roles-hint`,children:`템플릿을 클릭하면 현재 커서 위치에 삽입됩니다.`})]})]})]})})}export{_ as RolesPanel};
//# sourceMappingURL=RolesPanel-BrDqctgA.js.map