import WhiteboardEngine from './WhiteboardEngine'

export default function MeSection() {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <WhiteboardEngine scope="me" title="Me" />
    </div>
  )
}
