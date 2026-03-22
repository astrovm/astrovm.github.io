const LANGUAGES = {
  supported: ["en", "es", "ja", "zh"],
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
  const browserLang = navigator.language?.split("-")[0];
  return LANGUAGES.supported.includes(browserLang)
    ? browserLang
    : LANGUAGES.default;
};

// Handle language redirection
const path = window.location.pathname;
const lang = getLanguage();
const isOnLangPath = LANGUAGES.supported.some(
  (l) => l !== LANGUAGES.default && path.startsWith(`/${l}/`)
);
if (lang !== LANGUAGES.default && !isOnLangPath) {
  window.location.replace(`/${lang}${path}`);
}
