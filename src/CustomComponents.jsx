import React from 'react';

export const Modal = ({ open, onClose, title, size, children, footer }) => {
  if (!open) return null;
  return (
    <div className="ov" onClick={onClose}>
      <div className={`modal ${size || "modal-md"}`} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

export const Confirm = ({ open, msg, onYes, onNo }) => (
  <Modal open={open} onClose={onNo} title="⚠️ உறுதிப்படுத்தவும்" size="modal-sm"
    footer={<><button className="btn btn-berry btn-sm" onClick={onYes}>ஆம், அழி</button><button className="btn btn-ghost btn-sm" onClick={onNo}>ரத்து</button></>}>
    <div className="confirm-box">{msg}</div>
  </Modal>
);

export const AiDots = () => (
  <div className="ai-dots">
    <div className="ai-dot" /><div className="ai-dot" /><div className="ai-dot" />
    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>AI பதில் தயாரிக்கிறது...</span>
  </div>
);

export const Ring = ({ pct, color, size, label, sub }) => {
  const sz = size || 80; const r = sz / 2 - 7; const c = 2 * Math.PI * r; const p = Math.min(100, Math.max(0, pct || 0));
  return (
    <div style={{ textAlign: "center" }}>
      <div className="ring-wrap" style={{ width: sz, height: sz }}>
        <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#f0ede8" strokeWidth="7" />
          <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={c} strokeDashoffset={c - (c * p / 100)} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset .6s" }} />
        </svg>
        <div className="ring-inner">
          <div className="ring-num" style={{ color, fontSize: sz < 80 ? 13 : sz < 100 ? 16 : 20 }}>{p}%</div>
          {sub && <div className="ring-sub">{sub}</div>}
        </div>
      </div>
      {label && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600 }}>{label}</div>}
    </div>
  );
};

export const Prog = ({ pct, color }) => (
  <div className="prog"><div className="prog-bar" style={{ width: Math.min(100, pct || 0) + "%", background: color || "var(--primary)" }} /></div>
);

export default Modal;