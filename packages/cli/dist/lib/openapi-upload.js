export function buildOpenapiUploadBody(name, rawContent) {
    const formData = new FormData();
    formData.set('name', name);
    formData.set('rawContent', rawContent);
    return formData;
}
