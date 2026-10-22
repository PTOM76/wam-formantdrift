// 画面の部品で共通の、色と要素の作り方。
export const ACCENT = '#4fc3f7'

// 複数の場所で使う色
export const COLORS = {
  text: '#cfd8dc',
  textDim: '#8fb7cc',
  textBright: '#cfe8f5',
  border: '#05090c',
  screen: '#0b1a22',
  button: '#2b363e',
  grid: '#17323f',
}

const SVG = 'http://www.w3.org/2000/svg'

export const el = (tag, style, text) => {
  const node = document.createElement(tag)
  if (style) node.style.cssText = style
  if (text !== undefined) node.textContent = text
  return node
}
export const svg = (tag, attrs) => {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  return node
}
