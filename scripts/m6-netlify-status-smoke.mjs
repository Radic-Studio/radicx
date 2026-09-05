const repository = String(process.env.GITHUB_REPOSITORY ?? '').trim();
const headSha = String(process.env.M6_HEAD_SHA ?? '').trim();
const previewUrl = String(process.env.M6_PREVIEW_URL ?? '').replace(/\/+$/, '');
const token = String(process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
const expectedContext = 'netlify/radicx/deploy-preview';

if (repository !== 'Radic-Studio/radicx') {
  throw new Error('GITHUB_REPOSITORY must identify Radic-Studio/radicx.');
}
if (!/^[a-f0-9]{40}$/i.test(headSha)) {
  throw new Error('M6_HEAD_SHA must be the full PR head commit SHA.');
}
if (!/^https:\/\/deploy-preview-\d+--radicx\.netlify\.app$/.test(previewUrl)) {
  throw new Error('M6_PREVIEW_URL must be the expected RadicX Netlify Deploy Preview HTTPS origin.');
}

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'radicx-m6-preview-validator',
  'X-GitHub-Api-Version': '2022-11-28'
};
if (token) headers.Authorization = `Bearer ${token}`;

const response = await fetch(`https://api.github.com/repos/${repository}/commits/${headSha}/status`, {
  headers,
  cache: 'no-store'
});
if (!response.ok) {
  throw new Error(`GitHub commit-status API returned HTTP ${response.status}.`);
}

const payload = await response.json();
if (payload.sha !== headSha) {
  throw new Error(`GitHub returned status for ${payload.sha ?? 'an unknown SHA'}, not ${headSha}.`);
}

const status = payload.statuses?.find((entry) => entry.context === expectedContext);
if (!status) {
  throw new Error(`Netlify has not attached ${expectedContext} to current PR head ${headSha}.`);
}
if (status.state !== 'success') {
  throw new Error(`Netlify Deploy Preview status for current PR head is ${status.state}.`);
}
if (String(status.target_url ?? '').replace(/\/+$/, '') !== previewUrl) {
  throw new Error(`Netlify status targets ${status.target_url ?? 'no URL'}, not ${previewUrl}.`);
}

console.log(
  `Netlify reports the protected Deploy Preview READY for exact PR head ${headSha}: ${previewUrl}. `
  + 'Authenticated browser inspection remains a separate mandatory acceptance gate.'
);
