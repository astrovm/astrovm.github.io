const LANGUAGES = {
  supported: ["en", "es", "ja", "zh", "zh-tw"],
  default: "en",
  cookieName: "preferredLanguage",
};

const setLanguage = (lang) => {
  if (LANGUAGES.supported.includes(lang)) {
    document.cookie = `${LANGUAGES.cookieName}=${lang}; path=/; max-age=31536000`;
  }
};

const getLanguage = () => {
  // Check cookie
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(LANGUAGES.cookieName + "="));
  const cookieLang = cookie?.split("=")[1];
  if (LANGUAGES.supported.includes(cookieLang)) return cookieLang;

  // Check browser language
  const browserTag = navigator.language?.toLowerCase();
  // Traditional Chinese: Taiwan, Hong Kong, Macau or an explicit Hant script.
  if (/^zh-(tw|hk|mo|hant)/.test(browserTag)) return "zh-tw";
  const browserLang = browserTag?.split("-")[0];
  return LANGUAGES.supported.includes(browserLang)
    ? browserLang
    : LANGUAGES.default;
};

// Handle language redirection
const path = window.location.pathname;
const lang = getLanguage();
const isOnLangPath = LANGUAGES.supported.some(
  (l) => path.startsWith(`/${l}/`) || path === `/${l}`
);
if (!isOnLangPath) {
  window.location.replace(`/${lang}${path}`);
}
