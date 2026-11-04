"""Regenerates public/icons/*.png from scripts/icon.html with headless Chrome.
Run: python3 scripts/make-icons.py   (CHROME=/path/to/chrome to override; defaults to Playwright's chrome-headless-shell, then google-chrome/chromium)."""
import glob, os, shutil, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'icons')
HTML = 'file://' + os.path.join(HERE, 'icon.html')


def find_chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for pat in ('~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell',):
        hits = sorted(glob.glob(os.path.expanduser(pat)))
        if hits:
            return hits[-1]
    for name in ('google-chrome', 'chromium', 'chromium-browser'):
        if shutil.which(name):
            return shutil.which(name)
    raise SystemExit('No Chrome found; set CHROME=')


def shot(chrome, variant, size, name):
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([chrome, '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={profile}',
                        '--default-background-color=00000000', '--force-device-scale-factor=1', f'--window-size={size},{size}',
                        f'--screenshot={os.path.join(OUT, name)}', f'{HTML}?v={variant}'], check=True, capture_output=True, timeout=60)


os.makedirs(OUT, exist_ok=True)
c = find_chrome()
shot(c, 'any', 192, 'icon-192.png')
shot(c, 'any', 512, 'icon-512.png')
shot(c, 'maskable', 512, 'icon-maskable-512.png')
shot(c, 'bleed', 180, 'apple-touch-icon.png')  # iOS rounds the corners itself
