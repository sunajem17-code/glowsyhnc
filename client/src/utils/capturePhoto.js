// Keep the original bytes and dimensions; object URLs do not survive reloads.
export async function preserveCapture(source, capturedBlob = null) {
  if (!capturedBlob && typeof source === 'string' && source.startsWith('data:image/')) return source
  const blob = capturedBlob || (source instanceof Blob ? source : await fetch(source).then(response => {
    if (!response.ok) throw new Error('Photo could not be read')
    return response.blob()
  }))
  if (!blob.size) throw new Error('Photo is empty')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`
}
