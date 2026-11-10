// Keeps the Human Quest night (data-theme on <html>) and System Designer's own dark mode
// (.dark class, "theme" cookie and localStorage) in step on the /path preview.

/** Runs before first paint: the site's saved theme wins, then the family one, then the system setting. */
export const PATH_THEME_SCRIPT = `try{var r=document.documentElement,c=document.cookie.match(/(?:^|; )theme=(dark|light)/),s=localStorage.getItem("theme"),h=localStorage.getItem("hq-theme");var n=c?c[1]==="dark":s?s==="dark":h?h==="night":matchMedia("(prefers-color-scheme: dark)").matches;r.dataset.theme=n?"night":"day";r.classList.toggle("dark",n);r.style.colorScheme=n?"dark":"light"}catch(e){}`;

/** The same writes the site's own theme toggle makes, so every other page follows the moon button. */
export function syncSiteTheme(night: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", night);
  root.style.colorScheme = night ? "dark" : "light";
  try {
    localStorage.setItem("theme", night ? "dark" : "light");
    document.cookie = `theme=${night ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}
