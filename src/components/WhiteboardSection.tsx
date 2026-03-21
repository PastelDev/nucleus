import WhiteboardEngine from './WhiteboardEngine'

export default function WhiteboardSection() {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <WhiteboardEngine scope="whiteboards" title="Boards" />
    </div>
  )
}
