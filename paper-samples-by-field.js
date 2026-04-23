/* paper-samples-by-field.js — v1
 * 분야별 예시 논문 템플릿. paper-template-data.js 의 physicsScience (3페이지 풀 샘플)
 * 외에, 경량 1~2페이지 스켈레톤 4종을 추가.
 *
 * window.JANPaperTemplate.byField = {
 *   physics:    { title, summary, html }  -- 물리학 (alias: physicsScience 의 경량 요약본)
 *   biomedical: { title, summary, html }  -- 생물·의학 (CAR-T for ALL)
 *   cs:         { title, summary, html }  -- 컴퓨터과학 (ML/시스템)
 *   engineering:{ title, summary, html }  -- 공학 (재료/제어)
 *   economics:  { title, summary, html }  -- 경제학 (실증 분석)
 * }
 *
 * loadPaperSample() 에서 필드 picker 로 사용. 풀 버전은 physicsScience 에 유지.
 */
(function () {
  'use strict';
  window.JANPaperTemplate = window.JANPaperTemplate || {};

  const COMMON_STYLE = `<style>
    .jan-skel { font-family: 'Charter', 'Iowan Old Style', Georgia, serif; line-height:1.6; color:#222; max-width:820px; margin:0 auto; }
    .jan-skel h1.jan-ptitle { font-size:22px; text-align:center; margin:8px 0 4px; font-weight:700; letter-spacing:-0.01em; }
    .jan-skel .jan-psub { font-size:13px; text-align:center; color:#666; margin-bottom:6px; }
    .jan-skel .jan-pauthors { font-size:13px; text-align:center; margin:6px 0 2px; }
    .jan-skel .jan-paffil { font-size:11.5px; text-align:center; color:#666; font-style:italic; margin-bottom:14px; }
    .jan-skel .jan-abstract { border-left:3px solid #D97757; padding:8px 14px; background:#fef9f6; margin:14px 0; font-size:12.5px; line-height:1.55; }
    .jan-skel .jan-abstract strong { color:#8B4513; letter-spacing:0.5px; font-size:11px; }
    .jan-skel .jan-keywords { font-size:11.5px; color:#555; margin:4px 0 18px; padding-bottom:10px; border-bottom:1px solid #eee; }
    .jan-skel .jan-keywords strong { color:#8B4513; letter-spacing:0.5px; font-size:10.5px; margin-right:6px; }
    .jan-skel h2 { font-size:14.5px; margin:20px 0 6px; font-weight:700; border-bottom:1px solid #eee; padding-bottom:3px; }
    .jan-skel h3 { font-size:13px; margin:14px 0 4px; font-weight:600; color:#444; }
    .jan-skel p { font-size:12.5px; margin:8px 0; text-align:justify; hyphens:auto; }
    .jan-skel ul, .jan-skel ol { font-size:12.5px; margin:8px 0 8px 20px; }
    .jan-skel ul li, .jan-skel ol li { margin:3px 0; }
    .jan-skel .jan-fig, .jan-skel figure { background:#fafafa; border:1px solid #eee; padding:12px; margin:14px 0; border-radius:4px; }
    .jan-skel figcaption { font-size:11px; color:#666; text-align:center; margin-top:6px; font-style:italic; }
    .jan-skel .jan-refs { font-size:11.5px; color:#555; padding:10px 14px 10px 30px; background:#fafafa; border-radius:4px; margin-top:20px; }
    .jan-skel .jan-refs ol { padding-left:20px; }
    .jan-skel .jan-refs li { margin:4px 0; }
  </style>`;

  /* ============================================================
     1. 생물·의학 — CAR-T for relapsed/refractory B-ALL
     ============================================================ */
  window.JANPaperTemplate.biomedical = {
    title: 'CD19 CAR-T 세포 치료 (재발/불응성 B-ALL)',
    summary: 'Cell 저널 포맷 · 1.5페이지 · 생물·의학 논문 스켈레톤. 임상시험 결과, OS/PFS 곡선, 독성 분석 섹션 구조.',
    html: COMMON_STYLE + `
<div class="jan-skel">
  <h1 class="jan-ptitle">Durable Remission with CD19 CAR-T Cell Therapy in Relapsed/Refractory B-cell Acute Lymphoblastic Leukemia: A Phase II Multicenter Trial</h1>
  <div class="jan-psub">Preliminary Analysis · N = 142 · Median follow-up 24 months</div>
  <div class="jan-pauthors"><strong>Jane Doe<sup>1,2</sup></strong>, John Smith<sup>1</sup>, Minji Park<sup>3</sup>, et al.</div>
  <div class="jan-paffil">
    <sup>1</sup>Department of Hematology, Seoul National University Hospital ·
    <sup>2</sup>Cancer Research Institute, SNU College of Medicine ·
    <sup>3</sup>Center for Translational Immunotherapy, Asan Medical Center
  </div>
  <div class="jan-abstract">
    <strong>ABSTRACT</strong> — CD19 키메릭 항원 수용체 T세포 (CAR-T) 치료는 재발/불응성 B세포 급성 림프구성 백혈병 (r/r B-ALL) 에서 높은 초기 관해율을 보이나, 장기 반응 지속성 및 독성 프로파일은 여전히 불명확하다. 본 연구는 142명의 성인 r/r B-ALL 환자를 대상으로 단일군 2상 다기관 시험을 수행했다. 주요 평가변수는 완전 관해율 (CR), 전체 생존 (OS), 무진행 생존 (PFS) 및 Grade ≥3 사이토카인 방출 증후군 (CRS) 발생률이다. CAR-T 주입 후 28일 시점 CR 은 89.4% (95% CI 83.2–94.0) 였고, 24개월 OS 와 PFS 는 각각 61.3% 및 44.8% 였다. Grade ≥3 CRS 는 22.5%, 신경독성은 12.0% 에서 발생했으며, 치료 관련 사망은 3예 (2.1%) 였다. CD19 CAR-T 는 r/r B-ALL 에서 지속적이고 임상적으로 유의한 반응을 제공하며, 관리 가능한 독성 프로파일을 보인다.
  </div>
  <div class="jan-keywords">
    <strong>KEYWORDS</strong> CAR-T cell therapy · CD19 · B-cell acute lymphoblastic leukemia · relapsed/refractory · cytokine release syndrome · long-term remission
  </div>

  <h2>1. Introduction</h2>
  <p>재발/불응성 B-ALL 은 전통적인 화학요법 후 5년 생존율이 10% 미만으로 예후가 극히 불량하다. 자가 T세포에 CD19-특이 CAR 유전자를 도입한 CAR-T 치료는 1차 임상시험에서 90% 전후의 완전 관해율을 보였으나, 반응 지속성과 안전성에 대한 다기관 장기 데이터는 제한적이었다 [1, 2].</p>
  <p>본 연구는 국내 3개 3차 의료기관에서 수행된 단일군 2상 시험의 24개월 중간 분석 결과를 보고한다. 주요 목적은 (i) 관해 유도율 및 지속성 평가, (ii) CRS·신경독성·B세포 무형성증 등의 장기 안전성 프로파일 확립, (iii) 치료 실패 예측인자 탐색이다.</p>

  <h2>2. Methods</h2>
  <h3>2.1. Study design and patients</h3>
  <p>2023년 3월부터 2025년 9월까지 연속 142명의 성인 (18–75세) r/r B-ALL 환자를 모집했다. 등록 기준: (a) 2회 이상 표준 화학요법 후 재발 또는 불응, (b) ECOG 성능 상태 0–2, (c) 좌심실 박출률 ≥45%. 제외 기준: 활성 CNS 질환, 이전 CD19 지향 치료, 공여자 불일치 동종 조혈모세포이식 후 12주 미만.</p>
  <h3>2.2. CAR-T manufacturing and infusion</h3>
  <p>백혈구 성분채집술로 환자 자가 T세포를 분리한 후, 렌티바이러스 벡터 (4-1BB · CD3ζ 공자극 도메인) 로 CAR 유전자를 도입하고 9–12일 동안 확장 배양했다. 플루다라빈 (30 mg/m²) · 시클로포스파미드 (500 mg/m²) 림프구 제거 요법 후, 1 × 10⁶ CAR-T 세포/kg 를 단회 정맥 주입했다.</p>
  <h3>2.3. Endpoints and statistical analysis</h3>
  <p>주요 평가변수: 28일 시점 CR + CR with incomplete hematologic recovery (CRi). 부차: OS, PFS, 독성 (CTCAE v5.0 및 ASTCT CRS grading). Kaplan-Meier 추정 및 log-rank 검정을 적용했고, 다변량 Cox 비례위험 모델로 예후 인자를 평가했다 (α = 0.05).</p>

  <h2>3. Results</h2>
  <h3>3.1. Patient characteristics and response</h3>
  <p>기준 시점 중앙 연령은 42세 (범위 19–74), 남성 비율 58%, 이전 치료선 중앙 4선 (2–9). 주입 후 28일 시점 CR/CRi 는 127/142 (89.4%) 였고, 이 중 MRD-음성은 108/127 (85.0%) 이었다.</p>
  <figure class="jan-fig">
    <div style="height:120px; background:linear-gradient(to bottom right, #fef5f1 0%, #fae4dd 100%); display:flex; align-items:center; justify-content:center; color:#8B4513; font-size:12px; font-style:italic;">[Kaplan-Meier OS · PFS 곡선 영역 — 실제 그래프는 mermaid / 이미지로 삽입]</div>
    <figcaption>Figure 1. 전체 생존 (OS) 및 무진행 생존 (PFS) 의 Kaplan-Meier 추정치 (N = 142, 중앙 추적기간 24개월).</figcaption>
  </figure>
  <h3>3.2. Toxicity profile</h3>
  <p>CRS 는 126명 (88.7%) 에서 발생, Grade ≥3 은 32명 (22.5%) 이었다. 토실리주맙 투여율은 78.1%, 고용량 코르티코스테로이드는 24.6% 였다. 면역효과세포 관련 신경독성증후군 (ICANS) 은 42명 (29.6%) 에서, Grade ≥3 은 17명 (12.0%) 에서 나타났다. 치료 관련 사망 3예 중 2예는 Grade 5 CRS, 1예는 장기 B세포 무형성증 관련 중증 감염이었다.</p>

  <h2>4. Discussion</h2>
  <p>본 다기관 코호트는 기존 단일기관 보고 (CR 81–93%, 24개월 OS 50–62%) 와 일치하는 결과를 재현했다. 관리 가능한 독성 프로파일과 더불어, MRD-음성 달성 여부가 장기 반응의 강력한 예측 인자임을 확인했다 (24개월 PFS: MRD-음성 52.4% vs MRD-양성 18.9%, p &lt; 0.001). 한계는 단일군 설계와 비교 대조군 부재로, 향후 무작위 3상 시험 (NCT05xxxxxx) 에서 기존 blinatumomab ± 화학요법 대비 우월성을 검증 중이다.</p>

  <div class="jan-refs">
    <strong style="color:#8B4513; letter-spacing:0.5px; font-size:10.5px;">REFERENCES</strong>
    <ol>
      <li>Maude SL, et al. Tisagenlecleucel in children and young adults with B-cell lymphoblastic leukemia. <em>N Engl J Med</em>. 2018;378(5):439–448.</li>
      <li>Park JH, et al. Long-term follow-up of CD19 CAR therapy in acute lymphoblastic leukemia. <em>N Engl J Med</em>. 2018;378(5):449–459.</li>
      <li>Shah BD, et al. KTE-X19 for relapsed or refractory adult B-cell ALL: phase 2 results. <em>Lancet</em>. 2021;398(10299):491–502.</li>
    </ol>
  </div>
</div>
`};

  /* ============================================================
     2. 컴퓨터과학 — Transformer 효율 개선
     ============================================================ */
  window.JANPaperTemplate.cs = {
    title: '트랜스포머 효율 개선 (Sparse Attention)',
    summary: 'NeurIPS 포맷 · 1.5페이지 · 컴퓨터과학 논문 스켈레톤. 방법·실험·벤치마크 비교 섹션 구조.',
    html: COMMON_STYLE + `
<div class="jan-skel">
  <h1 class="jan-ptitle">Sparse Mixture-of-Attention: Reducing Transformer Inference Cost via Learnable Head Gating</h1>
  <div class="jan-psub">Accepted to NeurIPS 2026 (Spotlight) · Camera-ready draft</div>
  <div class="jan-pauthors"><strong>Hyejin Kim<sup>1,2</sup></strong>, Raj Patel<sup>1</sup>, Jun Park<sup>3</sup></div>
  <div class="jan-paffil"><sup>1</sup>KAIST · <sup>2</sup>Google DeepMind · <sup>3</sup>Seoul National University</div>
  <div class="jan-abstract">
    <strong>ABSTRACT</strong> — 트랜스포머의 다중 헤드 어텐션은 모든 헤드를 모든 토큰에 대해 계산하여 추론 비용의 주된 병목을 이룬다. 본 연구는 입력에 따라 활성 헤드를 동적으로 선택하는 <em>Sparse Mixture-of-Attention</em> (SMoA) 을 제안한다. 학습 가능한 게이트가 각 토큰에서 Top-k 헤드만 활성화하며, 나머지는 0으로 마스크된다. WMT14 영·독 번역, GLUE, LongBench 에서 SMoA 는 full attention 대비 -2.3× FLOPs 감소, +0.4 BLEU 향상을 달성했다. 라우팅 엔트로피 페널티가 헤드 붕괴를 방지하며, 7B 모델로의 스케일링에서도 이득이 유지됨을 보인다.
  </div>
  <div class="jan-keywords">
    <strong>KEYWORDS</strong> Transformer · efficient attention · mixture-of-experts · head pruning · LLM inference
  </div>

  <h2>1. Introduction</h2>
  <p>다중 헤드 자기 어텐션 (MHA) 은 입력 길이 <em>n</em> 에 대해 O(n²·h·d) 의 비용을 가지며 (h: 헤드 수, d: 헤드 차원), 긴 컨텍스트 추론에서 지배적 병목이다. 최근 연구들은 헤드 프루닝 [1, 2] 이나 KV 캐시 압축 [3] 으로 접근했으나, 입력 특성을 무시한 정적 마스킹은 일반화에 취약하다.</p>
  <p>우리는 MoE 의 토큰-전문가 라우팅 아이디어를 어텐션 헤드로 이식한 SMoA 를 제안한다. 핵심 기여: (i) 학습 가능한 게이팅, (ii) 라우팅 엔트로피 정규화로 헤드 붕괴 방지, (iii) 동일 성능에서 1.9~2.3× 추론 속도 향상.</p>

  <h2>2. Method: Sparse Mixture-of-Attention</h2>
  <h3>2.1. Gating function</h3>
  <p>각 토큰 x<sub>t</sub> 에 대해 게이트 G(x<sub>t</sub>) = softmax(W<sub>g</sub>x<sub>t</sub>) 가 h 차원 확률 벡터를 출력한다. Top-k 연산으로 k ≪ h 개 헤드만 유지하고, 해당 헤드의 출력을 게이트 가중치로 선형 결합한다. 학습 시 straight-through estimator 로 미분 가능하게 만들었다.</p>
  <h3>2.2. Load balancing loss</h3>
  <p>모든 토큰이 소수 헤드로 몰리는 붕괴를 방지하기 위해 배치 내 헤드별 선택 분포와 균등분포 간 KL 발산을 auxiliary loss (λ = 0.01) 로 추가했다.</p>

  <h2>3. Experiments</h2>
  <h3>3.1. Setup</h3>
  <p>BERT-base · RoBERTa-large · Llama-2-7B 세 가지 크기에서 SMoA 를 적용했다. k = 4 (총 h = 16) 를 기본값으로, Top-k 값과 λ 를 탐색했다. 하드웨어는 A100 80GB × 8 로 통일.</p>
  <h3>3.2. Main results</h3>
  <p>GLUE 평균 정확도에서 SMoA 는 dense baseline 대비 -0.1p 의 근사 무손실을 유지하면서 FLOPs 를 45.2% 감소시켰다. 7B 모델 ShareGPT 평가 (MT-Bench) 에서는 6.8 → 6.9 로 소폭 상승했다. 속도는 A100 에서 1.9× (batch=1), 2.3× (batch=8) 빠름.</p>
  <figure class="jan-fig">
    <div style="height:110px; background:linear-gradient(135deg, #eef4fb 0%, #dbe8f5 100%); display:flex; align-items:center; justify-content:center; color:#2c5282; font-size:12px; font-style:italic;">[Table · SMoA vs Dense · Dense-Top-k=all | FLOPs / 속도 / GLUE / MT-Bench 비교]</div>
    <figcaption>Figure 1. 세 규모 모델에서 SMoA 와 dense baseline 비교. 회귀선은 파라미터 수에 대한 기울기.</figcaption>
  </figure>

  <h2>4. Ablation and Analysis</h2>
  <p>헤드별 활성화 빈도는 입력 길이가 증가할수록 특정 헤드(주로 위치 기반 헤드)에 집중되는 경향을 보였다. 이는 SMoA 의 동적 특성이 긴 컨텍스트에서 특히 이득을 내는 이유를 설명한다.</p>

  <div class="jan-refs">
    <strong style="color:#8B4513; letter-spacing:0.5px; font-size:10.5px;">REFERENCES</strong>
    <ol>
      <li>Michel P, et al. Are Sixteen Heads Really Better than One? <em>NeurIPS</em>. 2019.</li>
      <li>Voita E, et al. Analyzing Multi-Head Self-Attention. <em>ACL</em>. 2019.</li>
      <li>Zhang Z, et al. H2O: Heavy-Hitter Oracle for Efficient Generative Inference. <em>NeurIPS</em>. 2023.</li>
    </ol>
  </div>
</div>
`};

  /* ============================================================
     3. 공학 — 3D 프린팅 Ti-6Al-4V 피로 특성
     ============================================================ */
  window.JANPaperTemplate.engineering = {
    title: '적층 제조 Ti-6Al-4V 피로 강도',
    summary: '공학 저널 포맷 · 1.5페이지 · 재료·기계공학 논문 스켈레톤. 실험·결과·FEM 분석 구조.',
    html: COMMON_STYLE + `
<div class="jan-skel">
  <h1 class="jan-ptitle">Fatigue Performance of Additively Manufactured Ti-6Al-4V under Combined HIP and Laser Shock Peening Treatment</h1>
  <div class="jan-psub">Journal of Materials Processing Technology · Accepted 2026</div>
  <div class="jan-pauthors"><strong>Donghyun Lee<sup>1</sup></strong>, Maria Silva<sup>2</sup>, Tanaka Hiroshi<sup>3</sup></div>
  <div class="jan-paffil"><sup>1</sup>POSTECH · <sup>2</sup>University of Sheffield · <sup>3</sup>University of Tokyo</div>
  <div class="jan-abstract">
    <strong>ABSTRACT</strong> — 선택적 레이저 용융 (SLM) 으로 제조된 Ti-6Al-4V 는 우수한 정적 강도에도 피로 수명이 단조재의 40~60% 수준에 머문다. 본 연구는 열간 등압 성형 (HIP) 후 레이저 쇼크 피닝 (LSP) 을 적용한 2중 후처리가 피로 강도에 미치는 영향을 정량화했다. R = 0.1 축방향 피로 시험 결과, 10⁷ 사이클 피로 한도는 as-built 380 MPa → HIP+LSP 695 MPa 로 83% 향상되었고, 단조재 (720 MPa) 수준에 근접했다. XRD 잔류 응력 측정과 FEM 해석은 표면 500 μm 깊이의 압축 응력장이 피로 크랙 개시를 지연시킨 주 메커니즘임을 뒷받침한다.
  </div>
  <div class="jan-keywords">
    <strong>KEYWORDS</strong> Ti-6Al-4V · SLM · HIP · laser shock peening · fatigue strength · residual stress
  </div>

  <h2>1. Introduction</h2>
  <p>적층 제조 (AM) Ti-6Al-4V 는 항공우주·의료 임플란트 산업에서 복잡 형상 부품 제작에 사용되나, 공정 내 가스 포획 기공 (Ø 10–50 μm) 과 기계적 이방성으로 피로 수명이 단조재보다 낮다 [1]. HIP 후처리는 기공을 닫아 정적 특성을 회복시키지만 피로 개시에 핵심적인 표면 결함은 제거하지 못한다. LSP 는 표면 잔류 압축 응력장을 도입해 크랙 개시를 억제하며, HIP 와의 조합 효과는 아직 체계적으로 보고되지 않았다.</p>

  <h2>2. Experimental Procedure</h2>
  <h3>2.1. Specimen preparation</h3>
  <p>ASTM E466 규격 원형 피로 시편을 SLM (EOS M290, 파워 280 W, 속도 1200 mm/s) 으로 제조했다. 후처리 조건: (a) As-built, (b) HIP (920 °C, 100 MPa, 2 h), (c) HIP + LSP (Nd:YAG, 5 GW/cm², 50% overlap, 10 passes).</p>
  <h3>2.2. Fatigue testing and residual stress measurement</h3>
  <p>MTS 810 유압식 시험기로 R = 0.1, 주파수 10 Hz 축방향 피로 시험을 진행했다. 잔류 응력은 sin²ψ 방식 X선 회절 (Cu Kα, 6 각도) 로 깊이 0–800 μm 구간에서 측정했다.</p>

  <h2>3. Results and Discussion</h2>
  <h3>3.1. S-N curves and fatigue limits</h3>
  <p>10⁷ 사이클 기준 피로 한도 (as-built 380 MPa · HIP 520 MPa · HIP+LSP 695 MPa) 는 각 처리 단계별로 뚜렷한 개선을 보였다. HIP 만으로는 기공 제거 효과 (+37%) 가 있었고, LSP 추가가 주요 기여 (+34%p) 를 했다.</p>
  <h3>3.2. Residual stress profile and fracture analysis</h3>
  <p>HIP+LSP 시편의 표면 잔류 압축 응력은 -650 MPa 로 as-built (-120 MPa) 대비 5.4× 컸고, 500 μm 깊이까지 압축장이 유지되었다. SEM 파단면 분석 결과, 크랙 개시점이 표면 → 내부 기공으로 이동했으며, 이는 LSP 가 표면 개시를 억제하여 내부 결함이 한계 요소가 되었음을 의미한다.</p>
  <figure class="jan-fig">
    <div style="height:110px; background:linear-gradient(to right, #e9f5e9 0%, #c8e6c9 100%); display:flex; align-items:center; justify-content:center; color:#1b5e20; font-size:12px; font-style:italic;">[Figure 1. S-N 곡선 3조건 비교 + 잔류 응력 깊이 프로파일 병치]</div>
    <figcaption>Figure 1. 세 후처리 조건의 S-N 곡선 (좌) 과 잔류 응력 깊이 프로파일 (우, XRD 측정).</figcaption>
  </figure>

  <h2>4. Conclusions</h2>
  <p>HIP + LSP 조합 후처리는 SLM Ti-6Al-4V 의 피로 한도를 단조재 수준 (96%) 까지 끌어올릴 수 있다. 실제 항공우주 부품 인증에서 AM 공정을 채택할 때 이 조합을 표준 후처리로 검토할 수 있다.</p>

  <div class="jan-refs">
    <strong style="color:#8B4513; letter-spacing:0.5px; font-size:10.5px;">REFERENCES</strong>
    <ol>
      <li>Li P, et al. Critical assessment of AM Ti-6Al-4V fatigue performance. <em>Int J Fatigue</em>. 2023;167:107378.</li>
      <li>Kumar P, Ramamurty U. Effect of heat treatment and HIP on SLM Ti-6Al-4V. <em>Acta Mater</em>. 2019;180:90–105.</li>
      <li>Sundar R, et al. Laser shock peening for fatigue enhancement: review. <em>Mater Today</em>. 2022;52:100–120.</li>
    </ol>
  </div>
</div>
`};

  /* ============================================================
     4. 경제학 — 최저임금 인상과 청년 고용
     ============================================================ */
  window.JANPaperTemplate.economics = {
    title: '최저임금 인상이 청년 고용에 미치는 영향',
    summary: 'AEJ: Applied Economics 포맷 · 1.5페이지 · 경제학 실증 논문 스켈레톤. DiD · RDD 식별전략.',
    html: COMMON_STYLE + `
<div class="jan-skel">
  <h1 class="jan-ptitle">The Employment Effects of Minimum Wage Increases on Youth: Evidence from South Korea's 2018 Reform</h1>
  <div class="jan-psub">American Economic Journal: Applied Economics · Submitted 2026</div>
  <div class="jan-pauthors"><strong>Jaehyun Choi<sup>1</sup></strong>, Seoyoung Baek<sup>2</sup>, David Chen<sup>3</sup></div>
  <div class="jan-paffil"><sup>1</sup>Korea Development Institute · <sup>2</sup>Yonsei University · <sup>3</sup>University of California, Berkeley</div>
  <div class="jan-abstract">
    <strong>ABSTRACT</strong> — 2018년 한국의 최저임금은 전년 대비 16.4% 인상되어 OECD 국가 중 역대 최대 단년도 상승폭을 기록했다. 본 논문은 15~24세 청년 근로자를 대상으로 이 충격의 고용 효과를 추정한다. 월별 경제활동인구조사 (KLIPS) 미시자료와 지역별 최저임금 변동 강도를 결합한 이중차분 (DiD) 및 경계 회귀 불연속 (RDD) 을 활용한다. 주 요인 분석 결과, 최저임금 인상 지역에서 청년 고용률이 -2.1 % 포인트 (95% CI -3.4 to -0.7) 감소했으며, 이 효과는 편의점·음식업 등 저숙련 서비스 부문에 집중되었다. 임금 분포 분석은 최저임금 대비 110% 수준의 근로자까지 spillover 효과가 확인됨을 보여준다. 해석은 고용 이질성과 기존 문헌 (Neumark & Wascher 2008) 과의 관계 맥락에서 논의한다.
  </div>
  <div class="jan-keywords">
    <strong>KEYWORDS</strong> minimum wage · youth employment · difference-in-differences · regression discontinuity · South Korea · labor demand elasticity
  </div>

  <h2>1. Introduction</h2>
  <p>최저임금이 저숙련 고용에 미치는 영향은 경제학에서 가장 논쟁적인 주제 중 하나다. Card & Krueger (1994) 의 New Jersey 연구 이래, 미국·영국 증거는 소규모 인상의 경우 고용 효과가 통계적으로 0 에 가까움을 시사했다. 그러나 대규모 인상이나 young worker 집단 특정 추정에서는 여전히 부정적 효과가 보고된다. 한국의 2018년 개혁은 (i) 큰 인상폭 (16.4%), (ii) 짧은 시행 유예 (90일), (iii) 지역 편차 부재로 인해, 기존 bite 기반 식별의 한계를 극복한 자연 실험을 제공한다.</p>

  <h2>2. Empirical Strategy</h2>
  <h3>2.1. Data</h3>
  <p>2015–2022 월별 KLIPS 개인 패널 (N = 42,138, 관측 = 2.4M) 과 고용노동부 사업체 조사 (EIS) 를 결합했다. 주요 결과 변수는 (i) 15–24세 고용률, (ii) 평균 근로시간, (iii) 시급 분위수 전환.</p>
  <h3>2.2. Identification</h3>
  <p>식별 전략 두 가지. (A) 이중차분: 2018년 인상 전후 × 인상 효과가 큰 산업 (bite 상위 25%) vs 낮은 산업. (B) 경계 RDD: 근로자 시급이 인상 전 최저임금 (7,530원) 주변 ±500원 구간에서의 고용 연속성 검정. 병행 테스트로 사건 연구 (event-study) 와 placebo (2017년 "가짜 인상") 를 실행했다.</p>

  <h2>3. Results</h2>
  <p>DiD 추정치: 청년 고용률은 고bite 지역·산업에서 -2.1 p.p. 감소 (SE 0.7, p = 0.002). 사건 연구 계수는 인상 시점부터 단조 감소하며, 사전 추세 (placebo) 는 0에서 유의하지 않게 흔들렸다. 근로시간은 주당 -1.8시간 감소로, 외연적 (취업 여부) + 내포적 (시간) 두 경로가 모두 작동했다.</p>
  <figure class="jan-fig">
    <div style="height:110px; background:linear-gradient(135deg, #fff8e1 0%, #ffe082 100%); display:flex; align-items:center; justify-content:center; color:#5d4037; font-size:12px; font-style:italic;">[Figure 1. Event-study plot + RDD 불연속 산점도]</div>
    <figcaption>Figure 1. 2018 최저임금 인상 전후 청년 고용률의 사건 연구 추정치 (상단) 와 RDD 산점도 (하단).</figcaption>
  </figure>

  <h2>4. Robustness and Heterogeneity</h2>
  <p>결과는 (a) 산업 고정효과 확장, (b) 회계 결측치 다중대입, (c) 통제 지역 매칭 방법론 (Mahalanobis + IPW) 변경에 모두 견고했다. 남성·고졸 이하 하위그룹에서 효과가 2배 이상 컸다.</p>

  <div class="jan-refs">
    <strong style="color:#8B4513; letter-spacing:0.5px; font-size:10.5px;">REFERENCES</strong>
    <ol>
      <li>Card D, Krueger AB. Minimum Wages and Employment: A Case Study of the Fast-Food Industry in New Jersey and Pennsylvania. <em>Am Econ Rev</em>. 1994;84(4):772–793.</li>
      <li>Neumark D, Wascher W. Minimum Wages and Employment. <em>Found Trends Microecon</em>. 2008;3(1–2):1–182.</li>
      <li>Cengiz D, et al. The Effect of Minimum Wages on Low-Wage Jobs. <em>Q J Econ</em>. 2019;134(3):1405–1454.</li>
    </ol>
  </div>
</div>
`};

  /* ============================================================
     5. 물리학 — 경량 요약본 (풀 버전은 physicsScience)
     ============================================================ */
  window.JANPaperTemplate.physics = {
    title: '광격자 SOC-BEC 비등방 초유체 수송 (경량 요약)',
    summary: 'Science 포맷 · 1페이지 요약 스켈레톤. 풀 3페이지 버전은 "Science 풀 샘플" 메뉴 참조.',
    html: COMMON_STYLE + `
<div class="jan-skel">
  <h1 class="jan-ptitle">Anisotropic Superfluid Transport of Spin-Orbit-Coupled Bose-Einstein Condensates in Optical Lattices</h1>
  <div class="jan-psub">Science · Research Article (Draft · 1-page skeleton)</div>
  <div class="jan-pauthors"><strong>Minho Park<sup>1,2</sup></strong>, Jiyeon Kang<sup>1</sup>, Thomas Weber<sup>3</sup></div>
  <div class="jan-paffil"><sup>1</sup>Dept. of Physics, SNU · <sup>2</sup>Center for Ultracold Matter, KAIST · <sup>3</sup>MPQ Garching</div>
  <div class="jan-abstract">
    <strong>ABSTRACT</strong> — 1D 삼각 광격자 속에 가둔 스핀-궤도 결합 (SOC) 루비듐-87 BEC 의 수송 측정을 보고한다. 격자 깊이 V₀ 와 SOC 결합 강도 γ 의 2차원 위상도에서, 초유체 드리프트 속도가 격자 축에 대해 비등방적으로 변조됨을 관측했다. 비등방성 계수 η = (v<sub>∥</sub> − v<sub>⊥</sub>)/v<sub>∥</sub> 는 γ = 0.4 E<sub>R</sub> 근방에서 최대 0.37 에 도달하며, 유효 Peierls 모델로 정량 재현된다. 이 결과는 신텐 게이지장과 격자의 복합 효과가 초유체 수송에 기하학적 이방성을 부여함을 시사한다.
  </div>
  <div class="jan-keywords">
    <strong>KEYWORDS</strong> spin-orbit coupling · optical lattice · BEC · anisotropic transport · synthetic gauge field
  </div>

  <h2>1. Introduction</h2>
  <p>초저온 원자 기체에서 레이저 유도 스핀-궤도 결합은 응집물질의 토폴로지 효과를 양자 시뮬레이터로 연구할 수 있게 했다. 본 연구는 SOC 와 주기 격자의 결합이 초유체 수송의 방향 의존성을 어떻게 조직하는지를 실험적으로 정량화한다.</p>

  <h2>2. Methods and Results</h2>
  <p>⁸⁷Rb BEC 를 1064 nm 트리포드 격자 + 795 nm Raman 빔으로 구성된 SOC 환경에 로드했다. 위상 대비 측정 시간-비행 이미징으로 정적 드리프트 속도를 추출했다. γ 를 0 → 0.8 E<sub>R</sub> 범위로 스위프한 결과, η 는 γ 에 대해 비단조적이며 0.4 E<sub>R</sub> 근처에서 피크가 나타났다.</p>

  <h2>3. Discussion</h2>
  <p>유효 Peierls 모델은 실험 η 곡선의 피크 위치와 폭 (FWHM = 0.15 E<sub>R</sub>) 을 오차 2% 이내로 재현했다. 피크 위치는 SOC-유도 밴드 nesting 조건과 일치한다.</p>

  <div class="jan-refs">
    <strong style="color:#8B4513; letter-spacing:0.5px; font-size:10.5px;">REFERENCES (abbrev.)</strong>
    <ol>
      <li>Lin Y-J, et al. Spin-orbit-coupled Bose-Einstein condensates. <em>Nature</em>. 2011;471:83–86.</li>
      <li>Galitski V, Spielman IB. Spin-orbit coupling in quantum gases. <em>Nature</em>. 2013;494:49–54.</li>
    </ol>
  </div>
</div>
<p style="font-size:11px; color:#888; text-align:center; margin-top:18px;">
  완성된 3페이지 Science 포맷 풀 버전은 <strong>논문 메뉴 › Science 풀 샘플 (물리학)</strong> 에서 확인할 수 있습니다.
</p>
`};

  /* 분야별 메타 리스트 (picker 에서 사용).
     아이콘은 반드시 app.html 의 <symbol id="..."> 에 존재하는 것만 사용.
     검증 가능한 id: i-sparkles, i-heart, i-code, i-building, i-stats, i-book, i-book-open */
  window.JANPaperTemplate.byFieldList = [
    { key: 'physics',     icon: 'i-sparkles',  field: '물리학',        label: '광격자 SOC-BEC 수송',           summary: 'Science 포맷 · 경량 1페이지 스켈레톤' },
    { key: 'biomedical',  icon: 'i-heart',     field: '생물·의학',      label: 'CD19 CAR-T (r/r B-ALL)',       summary: 'Cell 포맷 · 임상시험 2상 결과 1.5페이지' },
    { key: 'cs',          icon: 'i-code',      field: '컴퓨터과학',     label: 'Sparse MoA Transformer',        summary: 'NeurIPS 포맷 · 효율 개선 방법 1.5페이지' },
    { key: 'engineering', icon: 'i-building',  field: '공학',          label: 'AM Ti-6Al-4V 피로 (HIP+LSP)',  summary: 'JMPT 포맷 · 재료/기계 실험 1.5페이지' },
    { key: 'economics',   icon: 'i-stats',     field: '경제학',        label: '최저임금 → 청년 고용 (2018 KR)', summary: 'AEJ:Applied 포맷 · DiD·RDD 실증 1.5페이지' }
  ];
})();
