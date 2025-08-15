import type { Page } from '../types/page';

interface CookieData {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export async function cookieAction(
  page: Page,
  cookieData: CookieData | CookieData[],
  description?: string,
  options?: { variable?: string; defaultValue?: string }
): Promise<boolean> {
  let actionSuccess = false;

  const cookies = Array.isArray(cookieData) ? cookieData : [cookieData];

  let actionDescription = description;
  if (!actionDescription) {
    if (cookies.length === 1) {
      actionDescription = `Injected cookie ${cookies[0].name}`;
    } else {
      const cookieNames = cookies.map(c => c.name).join(', ');
      actionDescription = `Injected cookies: ${cookieNames}`;
    }
  }

  const escapeCookieValue = (value: string): string => {
    return value.replace(/[";,\s]/g, (match) => {
      switch (match) {
        case '"': return '\\"';
        case ';': return '\\;';
        case ',': return '\\,';
        case ' ': return '%20';
        default: return match;
      }
    });
  };

  const processedCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: escapeCookieValue(cookie.value),
    domain: cookie.domain,
    path: cookie.path || '/',
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite
  }));

  const shouldInjectCookies = !options?.variable || !options?.defaultValue ||
    (options.variable === options.defaultValue);

  if (shouldInjectCookies) {
    try {
      await page.context().addCookies(processedCookies);
      actionSuccess = true;
    } catch (e) {
      actionSuccess = false;
    }
  } else {
    actionSuccess = true;
  }

  page.progressTracker.addStep(actionDescription, actionSuccess);
  return actionSuccess;
} 