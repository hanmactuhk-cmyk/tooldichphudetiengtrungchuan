import React from 'react';
export function PropertySection({title,children,open=true}:{title:string;children:React.ReactNode;open?:boolean}) {
  return <details className="property-section" open={open}><summary>{title}<span>⌄</span></summary><div className="property-body">{children}</div></details>;
}
