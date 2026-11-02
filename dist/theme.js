// Run before styles load so a saved dark theme never flashes a light page.
try {
  document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('js-theme-v1')) === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
