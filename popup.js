// Popup script for X Article Helper
// Minimal - just opens links in new tabs

document.querySelectorAll('a[target="_blank"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: link.href });
  });
});
