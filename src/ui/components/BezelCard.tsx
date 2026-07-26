import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  className?: string
  innerClassName?: string
  style?: React.CSSProperties
  as?: "div" | "section" | "article"
}

export default function BezelCard({
  children,
  className = "",
  innerClassName = "",
  style,
  as: Tag = "div",
}: Props) {
  return (
    <Tag className={`fc-bezel ${className}`} style={style}>
      <div className={`fc-bezel__inner ${innerClassName}`}>{children}</div>
    </Tag>
  )
}
