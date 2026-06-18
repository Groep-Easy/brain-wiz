import React from 'react'

function logoSrc(): string {
  const underClient =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/client')
  return `${underClient ? '/client' : ''}/brainwiz-logo.png`
}

export function WizardLogo({
  size = 48,
  className = '',
}: {
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <img
      src={logoSrc()}
      alt="BrainWiz logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}
