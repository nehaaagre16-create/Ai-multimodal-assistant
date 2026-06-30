export default function Layout({ children, leftSidebar, rightSidebar }) {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      background: '#0A0A0A',
      color: '#F5F5F5',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div className="aurora-bg" />
      {leftSidebar}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
      }}>
        {children}
      </div>
      {rightSidebar}
    </div>
  )
}
