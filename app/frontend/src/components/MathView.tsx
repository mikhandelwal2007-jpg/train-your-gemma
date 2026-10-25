import { useMemo, type FC } from 'react'
import katex from 'katex'

interface MathViewProps {
  content: string
  className?: string
}

export const MathView: FC<MathViewProps> = ({ content, className = '' }) => {
  // Parses inline $...$ or $$...$$ LaTeX math blocks safely with KaTeX
  const renderedContent = useMemo(() => {
    if (!content) return ''

    // Regular expression for inline math $...$
    const mathRegex = /\$([^\$]+)\$/g
    return content.replace(mathRegex, (_, mathExpr) => {
      try {
        return katex.renderToString(mathExpr, {
          throwOnError: false,
          displayMode: false,
        })
      } catch (e) {
        return mathExpr
      }
    })
  }, [content])

  return (
    <div
      className={`overflow-x-auto overflow-y-hidden text-slate-100 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
