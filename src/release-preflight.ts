import { isIP } from 'node:net';

type MiniProgramConfig = { apiBase?: unknown; developmentUser?: unknown };
type ProjectConfig = { appid?: unknown; setting?: { urlCheck?: unknown } };

export function validateMiniProgramRelease(config: MiniProgramConfig, project: ProjectConfig,
  privateProject?: ProjectConfig): string[] {
  const issues: string[] = [];
  let apiUrl: URL | null = null;
  try { if (typeof config.apiBase === 'string') apiUrl = new URL(config.apiBase); }
  catch { /* Report a single actionable API configuration issue below. */ }
  const host = apiUrl?.hostname.toLowerCase() ?? '';
  if (!apiUrl || apiUrl.protocol !== 'https:' || !host.includes('.') || isIP(host) !== 0 ||
    host === 'localhost' || /\.(localhost|local|test|invalid)$/.test(host) ||
    apiUrl.username || apiUrl.password)
    issues.push('小程序 API 地址必须是已配置合法域名的公开 HTTPS 地址。');
  if (config.developmentUser !== '') issues.push('正式小程序配置必须清空开发身份。');
  if (typeof project.appid !== 'string' || !/^wx[a-f0-9]{16}$/i.test(project.appid) ||
    project.appid === 'wxbbcab69099026d3f')
    issues.push('项目 AppID 必须替换本地测试号，并在微信后台核验真实主体。');
  if (project.setting?.urlCheck !== true)
    issues.push('开发者工具项目配置必须开启合法域名校验。');
  if (privateProject?.setting?.urlCheck === false)
    issues.push('本机开发者工具私有配置仍关闭合法域名校验。');
  return issues;
}
