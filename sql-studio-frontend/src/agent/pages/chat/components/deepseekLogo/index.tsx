import whale from '../../../../assets/deepseek/logo.svg'

export function DeepSeekLogo({ size = 24, className }: { size?: number; className?: string }) {
  return <img className={className} src={whale} alt="" aria-hidden width={size} height={size} style={{ display: 'block', flexShrink: 0 }} />
}
