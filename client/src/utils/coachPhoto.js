const MAX_REQUEST_DATA_URL_LENGTH = 1_390_000

// Keep the optional vision payload comfortably below the API's 2 MB JSON
// limit. Remote signed URLs are not copied into requests; the server can read
// those from the scan's private storage path instead.
export async function prepareCoachPhoto(photo) {
  if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(photo)) return null
  const image = new Image()
  image.src = photo
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('The scan photo could not be prepared'))
  })

  for (const size of [768, 640, 512]) {
    const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.76, 0.64, 0.52]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= MAX_REQUEST_DATA_URL_LENGTH) return dataUrl
    }
  }
  return null
}
