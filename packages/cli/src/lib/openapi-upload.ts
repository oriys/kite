export function buildOpenapiUploadBody(name: string, rawContent: string) {
  const formData = new FormData()
  formData.set('name', name)
  formData.set('rawContent', rawContent)
  return formData
}
