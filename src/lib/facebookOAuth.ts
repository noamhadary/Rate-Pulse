const FB_APP_ID    = import.meta.env.VITE_FACEBOOK_APP_ID ?? '';
const REDIRECT_URI = `${window.location.origin}/auth/facebook/callback`;
const SCOPE        = 'pages_show_list,pages_read_user_content';

export interface FacebookPage {
  id:           string;
  name:         string;
  access_token: string;
  picture?:     { url: string };
}

export function openFacebookOAuth(): Promise<FacebookPage[]> {
  return new Promise((resolve, reject) => {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('fb_oauth_state', state);

    const url =
      `https://www.facebook.com/v19.0/dialog/oauth?` +
      `client_id=${FB_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${SCOPE}` +
      `&state=${state}` +
      `&response_type=code`;

    const popup = window.open(url, 'fb-oauth', 'width=600,height=700,left=300,top=100');
    if (!popup) { reject(new Error('popup_blocked')); return; }

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'FB_OAUTH_RESULT') return;
      window.removeEventListener('message', handler);
      clearInterval(pollClose);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.pages as FacebookPage[]);
    };

    window.addEventListener('message', handler);

    // Detect if the user closed the popup manually
    const pollClose = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClose);
        window.removeEventListener('message', handler);
        reject(new Error('popup_closed'));
      }
    }, 500);
  });
}

export { REDIRECT_URI as FB_REDIRECT_URI };
