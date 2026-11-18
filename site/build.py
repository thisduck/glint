from pathlib import Path
from shutil import copyfile
from string import Template
import markdown

root = Path(__file__).resolve().parents[1]
site = root / "site"
output = root / "dist" / "pages"
output.mkdir(parents=True, exist_ok=True)
layout = Template((site / "layout.html").read_text())
copyfile(site / "style.css", output / "style.css")
copyfile(root / "build/icon.png", output / "icon.png")
(output / "index.html").write_text(layout.substitute(
    title="glint · Screen recording for Mac", content=(site / "home.html").read_text()
))
for slug, title in [("privacy", "Privacy policy"), ("terms", "Terms of service")]:
    source = (root / f"{slug.upper()}.md").read_text()
    content = markdown.markdown(source.replace("](PRIVACY.md)", "](/glint/privacy/)"))
    folder = output / slug
    folder.mkdir(exist_ok=True)
    (folder / "index.html").write_text(layout.substitute(title=f"{title} · glint", content=content))
