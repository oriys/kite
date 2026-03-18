import Conf from 'conf';
const config = new Conf({ projectName: 'kite-cli' });
function readEnv(key) {
    const value = process.env[key]?.trim();
    return value ? value : undefined;
}
export function getApiToken() {
    return config.get('apiToken');
}
export function setApiToken(token) {
    config.set('apiToken', token);
}
export function getBaseUrl() {
    return (config.get('baseUrl') ||
        readEnv('KITE_BASE_URL') ||
        readEnv('APP_BASE_URL') ||
        readEnv('AUTH_URL'));
}
export function setBaseUrl(url) {
    config.set('baseUrl', url);
}
export function clearConfig() {
    config.clear();
}
