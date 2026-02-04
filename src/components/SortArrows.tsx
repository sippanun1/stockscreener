import React from 'react'

interface SortArrowsProps {
  sortDirection?: 'asc' | 'desc' | false
  className?: string
}

export const SortArrows: React.FC<SortArrowsProps> = ({ sortDirection, className = '' }) => {
  const getArrowColor = (direction: 'up' | 'down') => {
    // Custom logic: up arrow = descending (มาก→น้อย), down arrow = ascending (น้อย→มาก)
    if (sortDirection === 'desc' && direction === 'up') return '#F8FAFC'
    if (sortDirection === 'asc' && direction === 'down') return '#F8FAFC'
    return '#7588A3'
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Down Arrow */}
      <g>
        {/* Arrow line - made longer */}
        <line x1="4" y1="5" x2="4" y2="13" stroke={getArrowColor('down')} strokeWidth="1.5" strokeLinecap="round"/>
        {/* Arrow head */}
        <path d="M4 13L2 11M4 13L6 11" stroke={getArrowColor('down')} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      
      {/* Up Arrow */}
      <g>
        {/* Arrow line - made longer */}
        <line x1="10" y1="11" x2="10" y2="3" stroke={getArrowColor('up')} strokeWidth="1.5" strokeLinecap="round"/>
        {/* Arrow head */}
        <path d="M10 3L8 5M10 3L12 5" stroke={getArrowColor('up')} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  )
}
