import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljs from 'highlight.js'
import { useEffect } from 'react'
import 'highlight.js/styles/github-dark.css'

export default function MessageContent({ content }) {
  useEffect(() => {
    hljs.highlightAll()
  }, [content])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        p: ({ children }) => <p style={{ margin: 0, lineHeight: 1.5 }}>{children}</p>,
        code: ({ inline, className, children, ...props }) => {
          if (inline) {
            return (
              <code
                style={{
                  background: '#2A2A2A',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: '0.95em'
                }}
                {...props}
              >
                {children}
              </code>
            )
          }
          return (
            <pre
              style={{
                background: '#0A0A0A',
                border: '1px solid #2A2A2A',
                borderRadius: 8,
                padding: 12,
                overflowX: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9em',
                margin: '8px 0'
              }}
            >
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
