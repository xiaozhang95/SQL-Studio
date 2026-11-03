import whale from '../../../../assets/deepseek/logo.svg'

export function DeepSeekLogo({ size = 24 }: { size?: number }) {
  return <img src={whale} alt="" aria-hidden width={size} height={size} style={{ display: 'block', flexShrink: 0 }} />
}
