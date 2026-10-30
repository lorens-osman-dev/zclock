<h1 align="center">ZCLOCK</h1>
<h3 align="center">Gnome clock extension with smooth UI/UX </h3><br>

<p align="center"> <img src="assets/Z-CLOCK-LOGO.png" style="height: 200px !important;width: 200px !important;" > </p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/xml?url=https%3A%2F%2Fextensions.gnome.org%2Fextension%2F6768%2Flomotion%2F&query=%2Fhtml%2Fbody%2Fdiv%5B2%5D%2Fdiv%2Fdiv%5B2%5D%2Fdiv%5B1%5D%2Fspan%5B3%5D&logo=gnome&label=GNOME%20extensions&cacheSeconds=86400" alt="GNOME Extensions download">
</p>


<p align="left"> <img src="assets/ccc.png" style="height: 300px !important;" > </p>

<p align="left"> <img src="assets/ubuntu.jpg" style="height: 300px !important;" > </p>




## Install

To install the latest version of the extension head to the Official GNOME Extensions website.

<a href="https://extensions.gnome.org/extension/7831/zclock/">
  <img height="80" src="assets/ego.png">
</a>

### Install directly from GitHub

This downloads the latest `main` source, packages it, and installs the extension.
It requires `curl`, `tar`, and `gnome-extensions`.

```sh
set -euo pipefail
tmpdir="$(mktemp -d)"
curl -fL https://github.com/lorens-osman-dev/zclock/archive/refs/heads/main.tar.gz |
  tar -xz --strip-components=1 -C "$tmpdir"
(
  cd "$tmpdir"
  gnome-extensions pack --force --out-dir="$tmpdir" \
    --extra-source=src --extra-source=LICENSE --extra-source=README.md .
)
gnome-extensions install --force "$tmpdir/zclock@lorens.shell-extension.zip"
rm -rf "$tmpdir"
```

On Wayland, log out and back in after installing, then enable and configure it:

```sh
gnome-extensions enable zclock@lorens
gnome-extensions prefs zclock@lorens
```





## Technical information

For architecture, rendering and animation details, development checks, and
testing notes, see [technical_info.md](technical_info.md).


## Support

<a href="https://www.buymeacoffee.com/lorens" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>