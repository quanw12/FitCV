import spiderMask from "@/imports/spider-mask.png"

interface BrandMarkProps {
  size?: number
  className?: string
}

export default function BrandMark({ size = 24, className = "" }: BrandMarkProps) {
  return (
    <img
      className={`fc-spider-mark ${className}`.trim()}
      src={spiderMask}
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  )
}
