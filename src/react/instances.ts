import type { GlassScrollInstance } from '../core/types'

// Client-only registry for the document overlay so `useGlassScroll()` can reach it from
// anywhere in the tree without a provider. Module state is fine here: there is one document.
let documentInstance: GlassScrollInstance | null = null

export const setDocumentInstance = (instance: GlassScrollInstance | null): void => {
  documentInstance = instance
}

export const getDocumentInstance = (): GlassScrollInstance | null => documentInstance
