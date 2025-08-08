export const RESULTS = { UNAVAILABLE: 'unavailable', DENIED: 'denied', LIMITED: 'limited', GRANTED: 'granted', BLOCKED: 'blocked' };
export const PERMISSIONS = { ANDROID: {}, IOS: {} };
export const check = async () => RESULTS.GRANTED;
export const request = async () => RESULTS.GRANTED;
export default { RESULTS, PERMISSIONS, check, request };
