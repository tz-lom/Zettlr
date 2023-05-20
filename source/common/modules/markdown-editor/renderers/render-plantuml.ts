/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        PlantUMLRendeder
 * CVM-Role:        View
 * Maintainer:      Yury Nuzhdin
 * License:         GNU GPL v3
 *
 * Description:     This renderer displays plantuml diagrams.
 *
 * END HEADER
 */

import { renderBlockWidgets } from './base-renderer'
import { type SyntaxNode, type SyntaxNodeRef } from '@lezer/common'
import { WidgetType, type EditorView } from '@codemirror/view'

// import plantuml from '@sakirtemel/plantuml.js'
import { type EditorState } from '@codemirror/state'
import clickAndSelect from './click-and-select'

// Initialize PlantUML
// plantuml.initialize()

function initialize (): void {
  let cheerpj = document.createElement('script')
  cheerpj.src = '/plantuml/cjrtnc.leaningtech.com/2.3/loader.js'
  cheerpj.type = 'text/javascript'
  cheerpj.onload = function (): void {
    cheerpjInit()
    cheerpjRunMain('com.plantuml.wasm.v1.RunInit', '/app/plantuml/plantuml.github.io/plantuml.js/plantuml-wasm/plantuml-core.jar', '/app/plantuml/plantuml.github.io/plantuml.js/plantuml-wasm')
  }
  document.body.append(cheerpj)
}

const renderPng = async (pumlContent: any): Promise<Blob> => {
  return await new Promise((resolve, reject) => {
    const renderingStartedAt = new Date()
    const resultFileSuffix = renderingStartedAt.getTime().toString()
    cjCall('com.plantuml.wasm.v1.Png', 'convert', 'light', `/files/result-${resultFileSuffix}.png`, pumlContent).then((result: any) => {
      const obj = JSON.parse(result)
      if (obj.status === 'ok') {
        cjFileBlob(`result-${resultFileSuffix}.png`).then((blob: Blob) => {
          const transaction = cheerpjGetFSMountForPath('/files/').dbConnection.transaction('files', 'readwrite')
          transaction.objectStore('files').delete(`/result-${resultFileSuffix}.png`)

          transaction.oncomplete = () => {
            // console.log('Rendering finished in', (new Date()).getTime() - renderingStartedAt.getTime(), 'ms')
            resolve(blob)
          }
        })
      } else {
        reject(Error('Failed to render PlanUML'))
      }
    })
  })
}

initialize()

class PlantUMLWidget extends WidgetType {
  constructor (readonly graph: string, readonly node: SyntaxNode) {
    super()
  }

  eq (other: PlantUMLWidget): boolean {
    return other.graph === this.graph &&
      other.node.from === this.node.from &&
      other.node.to === this.node.to
  }

  toDOM (view: EditorView): HTMLElement {
    const elem = document.createElement('figure')
    elem.className = 'editor-image-container'
    const img = document.createElement('img')
    const msg = document.createElement('span')
    elem.append(msg)
    elem.append(img)
    msg.innerText = 'Rendering PlantUML'

    renderPng(this.graph).then((blob: any) => {
      img.src = window.URL.createObjectURL(blob)
      msg.innerText = ''
    }).catch((err: any) => {
      elem.classList.add('error')
      msg.innerText = `Could not render Graph:\n\n${err.str as string}`
    })
    elem.addEventListener('click', clickAndSelect(view))
    return elem
  }

  ignoreEvent (event: Event): boolean {
    return false // By default ignore all events
  }
}

function shouldHandleNode (node: SyntaxNodeRef): boolean {
  // This parser should look for InlineCode and FencedCode and then immediately
  // check its first CodeMark child to ensure its contents only include $ or $$.
  if (node.type.name !== 'FencedCode') {
    return false
  }

  // We've got some code. Ensure we have an info string that happens to be 8
  // chars long (= `plantuml`)
  const firstChild = node.node.getChildren('CodeInfo')[0]
  if (firstChild === undefined) {
    return false
  }

  const markSpan = firstChild.to - firstChild.from

  if (markSpan !== 8) {
    return false
  }

  return true // There's reason to assume we are indeed dealing with a math equation
}

function createWidget (state: EditorState, node: SyntaxNodeRef): PlantUMLWidget|undefined {
  // Get the node's text contents, determine if this is a displayMode equation,
  // and then remove the leading and trailing dollars. Also, pass a stable node
  // reference (SyntaxNodeRef will be dropped, but the SyntaxNode itself will
  // stay, and keep its position updated depending on what happens in the doc)
  const nodeText = state.sliceDoc(node.from, node.to)
  if (!nodeText.startsWith('```plantuml') && !nodeText.startsWith('~~~plantuml')) {
    return undefined
  }

  const graph = nodeText.replace(/^[`~]{1,3}plantuml\n(.+?)\n[`~]{1,3}$/s, '$1') // NOTE the s flag
  return new PlantUMLWidget(graph, node.node)
}

export const renderPlantUML = renderBlockWidgets(shouldHandleNode, createWidget)

declare function cjFileBlob (hello: string): Promise<Blob>
declare function cheerpjInit (): void
declare function cheerpjRunMain (arg0: string, arg1: string, arg2: string): void
declare function cheerpjGetFSMountForPath (arg0: string): any
declare function cjCall (arg0: string, arg1: string, arg2: string, arg3: string, pumlContent: any): Promise<any>
