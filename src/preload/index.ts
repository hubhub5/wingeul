import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('wg', {
  call: (name: string, args: unknown[]) => ipcRenderer.invoke('api', name, args),
  onProgress: (cb: (msg: string) => void) => {
    const fn = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on('progress', fn)
    return () => ipcRenderer.removeListener('progress', fn)
  },
})
