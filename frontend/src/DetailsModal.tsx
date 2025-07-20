import React from 'react';
import './modal.css';

interface Props{
  visible:boolean;
  title:string;
  children:React.ReactNode;
  onClose:()=>void;
}
export const DetailsModal:React.FC<Props>=({visible,title,children,onClose})=>{
  if(!visible) return null;
  return(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h4>{title}</h4>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};
