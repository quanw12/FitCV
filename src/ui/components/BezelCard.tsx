import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  className?: string
  innerClassName?: string
  as?: "div" | "section" | "article"
}

export default function BezelCard({
  children,
  className = "",
  innerClassName = "",
  as: Tag = "div",
}: Props) {
  return (
    <Tag className={`fc-bezel ${className}`}>
      <div className={`fc-bezel__inner ${innerClassName}`}>
        {children}
      </div>
    </Tag>
  )
}
