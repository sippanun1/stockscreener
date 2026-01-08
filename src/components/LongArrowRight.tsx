import React from 'react'

export const LongArrowRight: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      width="32"
      height="16"
      viewBox="0 0 32 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Long horizontal line */}
      <line 
        x1="4" 
        y1="8" 
        x2="24" 
        y2="8" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      {/* Arrow head */}
      <path 
        d="M24 8L20 5M24 8L20 11" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )
}
