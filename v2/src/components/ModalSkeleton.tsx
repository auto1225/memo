/**
 * Phase 13 — 모달 lazy load 시 표시되는 skeleton.
 * 단순 "로딩 중..." 보다 시각적으로 부드러움.
 */
export function ModalSkeleton() {
  return (
    <div className="jan-modal-overlay" aria-busy="true">
      <div className="jan-modal jan-modal-skeleton" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <div className="jan-skel jan-skel-title" />
          <div className="jan-skel jan-skel-btn" />
        </div>
        <div className="jan-modal-body">
          <div className="jan-skel jan-skel-line" style={{ width: '70%' }} />
          <div className="jan-skel jan-skel-line" style={{ width: '90%' }} />
          <div className="jan-skel jan-skel-line" style={{ width: '60%' }} />
          <div className="jan-skel jan-skel-line" style={{ width: '80%' }} />
        </div>
      </div>
    </div>
  )
}
